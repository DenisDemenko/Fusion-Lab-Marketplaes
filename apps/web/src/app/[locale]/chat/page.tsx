"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ChatThreadSummary } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
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
    return <p className="mx-auto max-w-2xl px-4 py-16 text-center text-[var(--danger)]">{error}</p>;
  }

  if (!threads) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="section-title">{t("emptyTitle")}</h1>
        <p className="mt-2 text-[var(--muted)]">{t("emptyBody")}</p>
        <Link href="/catalog" className="btn-primary mt-6">
          {tCommon("toCatalog")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader title={t("title")} />

      {/* Every row looked the same: the counterpart, the listing and the
          last message all sat in the same size and the same grey, and the
          only thing separating a thread waiting on a reply from a finished
          one was a small counter at the far right edge. An unread thread now
          carries its state across the whole row — accent edge, warm ground,
          and the message itself in reading colour — while the listing drops
          to a context line under the name, since it says which conversation
          this is, not what was said. */}
      <div className="card divide-y divide-[var(--line)]">
        {threads.map((thread) => {
          const unread = thread.unreadCount > 0;

          return (
            <Link
              key={thread.id}
              href={`/chat/${thread.id}`}
              className={`flex items-start justify-between gap-3 border-l-2 p-4 transition-colors ${
                unread
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-transparent hover:bg-[var(--neutral-bg)]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-[var(--foreground)] ${unread ? "font-semibold" : "font-medium"}`}
                >
                  {thread.counterpartName}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                  {thread.listing.title}
                </p>
                {thread.lastMessage ? (
                  <p
                    className={`mt-1.5 truncate text-sm ${unread ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}
                  >
                    {thread.lastMessage}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {/* A timestamp is a figure — mono keeps the column aligned
                    down the list instead of ragged. */}
                <p className="font-mono text-xs text-[var(--muted)]">
                  {formatDateTime(thread.updatedAt, locale)}
                </p>
                {unread ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono text-xs font-semibold text-white">
                    {thread.unreadCount}
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
