"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ChatMessageEntry, ChatThreadMessages } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { RequireAuth } from "@/components/require-auth";
import { API_URL, api } from "@/lib/api-client";
import { auth } from "@/lib/firebase";
import { formatDate } from "@/lib/format";

// Messages in one thread are read top to bottom in a single sitting, so the
// full "02.09.2026, 14:31" under every bubble repeated the same date dozens
// of times to say one thing that changes twice a day at most. The date moves
// up into a rule between days, and each bubble keeps only the clock — mono,
// like every other timestamp in the app.
function formatClock(value: string, locale: Locale): string {
  return new Date(value).toLocaleTimeString(locale === "en" ? "en-US" : "uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayKey(value: string): string {
  return new Date(value).toDateString();
}

export default function ChatThreadPage() {
  return (
    <RequireAuth>
      <ChatThreadScreen />
    </RequireAuth>
  );
}

function ChatThreadScreen() {
  const t = useTranslations("chatThread");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const params = useParams<{ id: string }>();
  const threadId = params.id;

  const [data, setData] = useState<ChatThreadMessages | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get<ChatThreadMessages>(`/chat/threads/${threadId}/messages`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("notFound"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [data?.messages.length]);

  // Live updates while the thread is open: a message sent by the other
  // side appears without a manual refresh. Reusing the same "/chat"
  // socket namespace the API exposes — see ChatGateway.
  useEffect(() => {
    let socket: Socket | undefined;
    let cancelled = false;

    void auth.currentUser?.getIdToken().then((token) => {
      if (cancelled || !token) return;

      socket = io(`${API_URL}/chat`, {
        auth: { token },
        transports: ["websocket"],
      });

      socket.on("message", (message: ChatMessageEntry & { threadId: string }) => {
        if (message.threadId !== threadId) return;
        setData((current) =>
          current
            ? { ...current, messages: [...current.messages, { ...message, mine: false }] }
            : current,
        );
      });
    });

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [threadId]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;

    setSending(true);
    setText("");
    try {
      const message = await api.post<ChatMessageEntry>(
        `/chat/threads/${threadId}/messages`,
        { body },
      );
      setData((current) =>
        current
          ? { ...current, messages: [...current.messages, { ...message, mine: true }] }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("sendFailed"));
      setText(body);
    } finally {
      setSending(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-[var(--danger)]">{error}</p>
        <Link href="/chat" className="btn-ghost mt-4">
          {t("backToMessages")}
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4 py-6">
      <Link href="/chat" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        {t("backToMessages")}
      </Link>

      <Link
        href={`/catalog/${data.thread.listingSlug}`}
        className="mt-2 font-semibold text-[var(--foreground)] hover:underline"
      >
        {data.thread.listingTitle}
      </Link>

      {/* The thread was a flat stack of evenly spaced bubbles, each with its
          own full timestamp, so five messages fired off in a row looked like
          five separate exchanges and a two-week-old conversation looked like
          today's. Consecutive messages from the same side now close up into
          one run that is timestamped once, at its end, and a day rule marks
          where the conversation was picked up again. */}
      <div className="card mt-4 flex-1 overflow-y-auto p-4">
        {data.messages.length === 0 ? (
          <p className="text-center text-sm text-[var(--muted)]">{t("writeFirstMessage")}</p>
        ) : (
          data.messages.map((message, index) => {
            const previous = index > 0 ? data.messages[index - 1] : null;
            const next = index + 1 < data.messages.length ? data.messages[index + 1] : null;
            const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
            const startsRun = newDay || !previous || previous.mine !== message.mine;
            const endsRun =
              !next ||
              next.mine !== message.mine ||
              dayKey(next.createdAt) !== dayKey(message.createdAt);

            return (
              <Fragment key={message.id}>
                {newDay ? (
                  <div className={`flex items-center gap-3 ${index === 0 ? "pb-3" : "py-4"}`}>
                    <span className="h-px flex-1 bg-[var(--line)]" />
                    <span className="font-mono text-[11px] tracking-wide text-[var(--muted)]">
                      {formatDate(message.createdAt, locale)}
                    </span>
                    <span className="h-px flex-1 bg-[var(--line)]" />
                  </div>
                ) : null}
                <div
                  className={`${newDay ? "" : startsRun ? "mt-4" : "mt-1"} ${
                    message.mine ? "text-right" : "text-left"
                  }`}
                >
                  <p
                    className={`inline-block max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-left text-sm ${
                      message.mine
                        ? `bg-[var(--foreground)] text-white ${endsRun ? "rounded-br-sm" : ""}`
                        : `bg-[var(--neutral-bg)] text-[var(--foreground)] ${endsRun ? "rounded-bl-sm" : ""}`
                    }`}
                  >
                    {message.body}
                  </p>
                  {endsRun ? (
                    <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
                      {formatClock(message.createdAt, locale)}
                    </p>
                  ) : null}
                </div>
              </Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          className="input"
          placeholder={t("messagePlaceholder")}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={sending}>
          {t("send")}
        </button>
      </form>
    </div>
  );
}
