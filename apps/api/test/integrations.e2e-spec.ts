import {
  createTestApp,
  resetDatabase,
  type TestContext,
} from './utils/test-app';
import {
  createApprovedSeller,
  makeAdmin,
  publishListing,
} from './utils/fixtures';

const ADMIN = 'admin@test.dev';
const SELLER = 'seller@test.dev';

describe('Assistant and Book_Creality bridge (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    await makeAdmin(ctx, ADMIN);
    await createApprovedSeller(ctx, {
      email: SELLER,
      adminEmail: ADMIN,
      displayName: 'Fusion Lab',
    });

    await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: {
        title: 'Курс Fusion для викладачів STEAM',
        summary: 'Для вчителів фізики, хімії та математики',
        description:
          'Як інтегрувати 3D-моделювання і друк у шкільні предмети: ' +
          'наочні макети, міжпредметні STEAM-проєкти, підготовка до друку.',
        priceMinor: 690000,
      },
    });
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('AI assistant', () => {
    // No ANTHROPIC_API_KEY in the test environment, so the assistant runs
    // its catalogue-only path. That is the point: the feature answers even
    // when the model is unreachable, and the assertion is deterministic.
    it('answers a buyer question from the catalogue', async () => {
      const response = await ctx
        .http()
        .post('/assistant/chat')
        .send({ message: 'Що порадите вчителю фізики?' })
        .expect(201);

      expect(response.body.source).toBe('catalog');
      expect(response.body.threadId).toBeTruthy();
      expect(response.body.suggestions.length).toBeGreaterThan(0);
      expect(response.body.reply).toContain('STEAM');
    });

    it('says plainly when it has nothing to offer', async () => {
      const response = await ctx
        .http()
        .post('/assistant/chat')
        .send({ message: 'Продаєте акваріумних равликів?' })
        .expect(201);

      expect(response.body.suggestions).toHaveLength(0);
      expect(response.body.reply).toContain('нічого не знайшлося');
    });

    it('keeps a conversation in one thread', async () => {
      const first = await ctx
        .http()
        .post('/assistant/chat')
        .send({ message: 'Цікавить ЧПУ' })
        .expect(201);

      await ctx
        .http()
        .post('/assistant/chat')
        .send({ message: 'А для школи?', threadId: first.body.threadId })
        .expect(201);

      const history = await ctx
        .http()
        .get(`/assistant/threads/${first.body.threadId}`)
        .expect(200);

      expect(history.body).toHaveLength(4);
      expect(history.body.map((row: { role: string }) => row.role)).toEqual([
        'user',
        'assistant',
        'user',
        'assistant',
      ]);
    });

    it('validates the message instead of accepting anything', async () => {
      await ctx
        .http()
        .post('/assistant/chat')
        .send({ message: '' })
        .expect(400);
      await ctx.http().post('/assistant/chat').send({}).expect(400);
    });
  });

  describe('Book_Creality bridge', () => {
    const book = {
      externalId: 'book-42',
      title: 'Практика 3D-друку: від STL до готової деталі',
      subtitle: 'Книга лабораторії',
      summary: 'Матеріали, температури, дефекти друку та їх причини',
      description:
        'Практичний посібник з 3D-друку: підбір матеріалів, налаштування ' +
        'параметрів, типові дефекти та способи їх усунення.',
      priceMinor: 45000,
      sellerSlug: 'fusion-lab',
    };

    it('refuses a request without the shared key', async () => {
      await ctx.http().post('/bridge/books').send(book).expect(401);

      await ctx
        .http()
        .post('/bridge/books')
        .set('x-bridge-key', 'wrong-key')
        .send(book)
        .expect(401);
    });

    it('publishes a book straight into the catalogue and updates it in place', async () => {
      const created = await ctx
        .http()
        .post('/bridge/books')
        .set('x-bridge-key', 'test-bridge-key')
        .send(book)
        .expect(201);

      expect(created.body.created).toBe(true);
      expect(created.body.listing.kind).toBe('book');
      expect(created.body.listing.status).toBe('published');

      const inCatalog = await ctx
        .http()
        .get('/catalog')
        .query({ kind: 'book' })
        .expect(200);
      expect(inCatalog.body.total).toBe(1);

      // Re-publishing the same book updates the existing listing rather
      // than creating a second copy of it.
      const updated = await ctx
        .http()
        .post('/bridge/books')
        .set('x-bridge-key', 'test-bridge-key')
        .send({
          ...book,
          title: `${book.title} (2-ге видання)`,
          priceMinor: 52000,
        })
        .expect(201);

      expect(updated.body.created).toBe(false);
      expect(updated.body.listing.priceMinor).toBe(52000);
      expect(await ctx.prisma.listing.count({ where: { kind: 'book' } })).toBe(
        1,
      );

      const archived = await ctx
        .http()
        .delete(`/bridge/books/${book.externalId}`)
        .set('x-bridge-key', 'test-bridge-key')
        .expect(200);

      expect(archived.body.archived).toBe(true);
      await ctx.http().get(`/catalog/${archived.body.slug}`).expect(404);
    });

    it('rejects a book with no seller to attach it to', async () => {
      await ctx
        .http()
        .post('/bridge/books')
        .set('x-bridge-key', 'test-bridge-key')
        .send({ ...book, externalId: 'book-99', sellerSlug: 'no-such-seller' })
        .expect(400);
    });
  });

  describe('health', () => {
    it('proves the database is reachable and migrated', async () => {
      const response = await ctx.http().get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        database: 'up',
        schema: 'ready',
      });
    });
  });
});
