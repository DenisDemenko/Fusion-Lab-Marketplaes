"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ChatThreadSummary } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

export default function ChatInboxPage() {
  return (
    <RequireAuth>
      <ChatInboxScreen />
    </RequireAuth>
  );
}

function ChatInboxScreen() {
  const t = useTranslations("chatInbox");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [threads, setThreads] = useState<ChatThreadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ChatThreadSummary[]>("/chat/threads")
      .then(setThreads)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : tCommon("loadError")),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="mx-auto max-w-2xl px-4 py-16 text-center text-red-700">{error}</p>;
  }

  if (!threads) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-zinc-500">{tCommon("loading")}</p>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="section-title">{t("emptyTitle")}</h1>
        <p className="mt-2 text-zinc-500">{t("emptyBody")}</p>
        <Link href="/catalog" className="btn-primary mt-6">
          {tCommon("toCatalog")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="section-title">{t("title")}</h1>

      <div className="card mt-6 divide-y divide-[var(--line)]">
        {threads.map((thread) => (
          <Link
            key={thread.id}
            href={`/chat/${thread.id}`}
            className="flex items-center justify-between gap-3 p-4 hover:bg-zinc-50"
          >
            <div className="min-w-0">
              <p className="font-medium text-zinc-900">{thread.counterpartName}</p>
              <p className="truncate text-sm text-zinc-500">
                {thread.listing.title}
              </p>
              {thread.lastMessage ? (
                <p className="truncate text-sm text-zinc-400">
                  {thread.lastMessage}
                </p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-zinc-400">
                {formatDateTime(thread.updatedAt, locale)}
              </p>
              {thread.unreadCount > 0 ? (
                <span className="mt-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-xs font-semibold text-white">
                  {thread.unreadCount}
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
