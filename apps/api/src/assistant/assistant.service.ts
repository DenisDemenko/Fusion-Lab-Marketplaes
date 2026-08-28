import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';

const MODEL = process.env.ASSISTANT_MODEL ?? 'claude-sonnet-5';

// Words that carry no signal in a question and would match half the
// catalogue. Kept short on purpose: over-filtering loses real terms, and
// the ranking already sorts weak matches to the bottom.
const STOPWORDS = new Set([
  'який',
  'яка',
  'яке',
  'які',
  'порадите',
  'потрібно',
  'треба',
  'хочу',
  'шукаю',
  'можна',
  'будь',
  'ласка',
  'мене',
  'мені',
  'цікавить',
  'підкажіть',
  'skilky',
  'коштує',
  'краще',
]);
const MAX_HISTORY = 10;

const SYSTEM_PROMPT = [
  'Ти — консультант маркетплейсу Fusion Lab: курси з Fusion 360, 3D-друку,',
  'ЧПУ та інженерної творчості, книги і фізичні вироби.',
  'Відповідай українською, стисло (до 120 слів), по-людськи.',
  'Спирайся ЛИШЕ на надані нижче позиції каталогу: якщо потрібного немає,',
  'чесно скажи про це і запропонуй найближче з наявного.',
  'Не вигадуй цін, назв і посилань.',
].join(' ');

interface CatalogMatch {
  slug: string;
  title: string;
  kind: string;
  priceLabel: string;
  summary: string | null;
}

// Buyer-facing chat. The retrieval half (catalog search) always runs; the
// LLM half is optional. Without ANTHROPIC_API_KEY the assistant still
// answers — from the same search results, in a fixed format — which keeps
// the feature working in the deployed demo and makes the e2e suite
// deterministic instead of dependent on a live model.
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private client?: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  get llmEnabled(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async chat(input: { message: string; threadId?: string; userId?: string }) {
    const thread = await this.resolveThread(input.threadId, input.userId);

    await this.prisma.assistantMessage.create({
      data: { threadId: thread.id, role: 'user', content: input.message },
    });

    const matches = await this.catalog.search({
      q: this.searchTermFor(input.message),
      perPage: 6,
    });
    const suggestions = matches.items;

    const reply = this.llmEnabled
      ? await this.askClaude(thread.id, suggestions)
      : this.templateAnswer(suggestions);

    await this.prisma.assistantMessage.create({
      data: { threadId: thread.id, role: 'assistant', content: reply },
    });

    return {
      threadId: thread.id,
      reply,
      source: this.llmEnabled ? ('llm' as const) : ('catalog' as const),
      suggestions,
    };
  }

  async history(threadId: string) {
    return this.prisma.assistantMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  private async askClaude(
    threadId: string,
    suggestions: {
      slug: string;
      title: string;
      kind: string;
      priceLabel: string;
      summary: string | null;
    }[],
  ): Promise<string> {
    try {
      this.client ??= new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const history = await this.prisma.assistantMessage.findMany({
        where: { threadId },
        orderBy: { createdAt: 'desc' },
        take: MAX_HISTORY,
      });

      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 600,
        system: `${SYSTEM_PROMPT}\n\nПозиції каталогу:\n${this.catalogContext(suggestions)}`,
        messages: history.reverse().map((row) => ({
          role:
            row.role === 'assistant'
              ? ('assistant' as const)
              : ('user' as const),
          content: row.content,
        })),
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      return text || this.templateAnswer(suggestions);
    } catch (error) {
      // A model outage must not take the chat window down with it: the
      // catalog answer is worse, but it is an answer.
      this.logger.warn(
        `Anthropic call failed, falling back to catalog answer: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.templateAnswer(suggestions);
    }
  }

  private catalogContext(matches: CatalogMatch[]): string {
    if (matches.length === 0) return '(нічого не знайдено за запитом)';

    return matches
      .map(
        (item) =>
          `- ${item.title} [${item.kind}] — ${item.priceLabel} — /catalog/${item.slug}` +
          (item.summary ? `\n  ${item.summary}` : ''),
      )
      .join('\n');
  }

  private templateAnswer(matches: CatalogMatch[]): string {
    if (matches.length === 0) {
      return (
        'На жаль, за цим запитом у каталозі нічого не знайшлося. ' +
        'Спробуйте інші слова — наприклад «Fusion 360», «3D-друк», «ЧПУ» ' +
        'або перегляньте весь каталог.'
      );
    }

    const lines = matches
      .slice(0, 3)
      .map(
        (item) =>
          `• ${item.title} — ${item.priceLabel} (/catalog/${item.slug})`,
      );

    return `Знайшов у каталозі ${matches.length} відповідн${
      matches.length === 1 ? 'ий варіант' : 'і варіанти'
    }:\n${lines.join('\n')}`;
  }

  // A question is not a search box. Postgres full-text search ANDs the
  // words it is given, so "Що порадите вчителю фізики?" as-is matches
  // nothing at all — every listing would have to contain all four words.
  // Content words joined with OR is what turns a sentence into a query
  // the index can answer; ts_rank then puts the listing that matched the
  // most of them first.
  private searchTermFor(message: string): string {
    const tokens = message
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
      .slice(0, 8);

    return tokens.length > 0 ? tokens.join(' or ') : message;
  }

  private async resolveThread(threadId?: string, userId?: string) {
    if (threadId) {
      const existing = await this.prisma.assistantThread.findUnique({
        where: { id: threadId },
      });
      if (existing) return existing;
    }

    return this.prisma.assistantThread.create({ data: { userId } });
  }
}
