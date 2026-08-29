"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ChatMessageEntry, ChatThreadMessages } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { RequireAuth } from "@/components/require-auth";
import { API_URL, api } from "@/lib/api-client";
import { auth } from "@/lib/firebase";
import { formatDateTime } from "@/lib/format";

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
        <p className="text-red-700">{error}</p>
        <Link href="/chat" className="btn-ghost mt-4">
          {t("backToMessages")}
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-zinc-500">{tCommon("loading")}</p>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4 py-6">
      <Link href="/chat" className="text-sm text-zinc-500 hover:text-zinc-900">
        {t("backToMessages")}
      </Link>

      <Link
        href={`/catalog/${data.thread.listingSlug}`}
        className="mt-2 font-semibold text-zinc-900 hover:underline"
      >
        {data.thread.listingTitle}
      </Link>

      <div className="card mt-4 flex-1 space-y-3 overflow-y-auto p-4">
        {data.messages.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">{t("writeFirstMessage")}</p>
        ) : (
          data.messages.map((message) => (
            <div key={message.id} className={message.mine ? "text-right" : "text-left"}>
              <p
                className={`inline-block max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${
                  message.mine ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800"
                }`}
              >
                {message.body}
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                {formatDateTime(message.createdAt, locale)}
              </p>
            </div>
          ))
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
