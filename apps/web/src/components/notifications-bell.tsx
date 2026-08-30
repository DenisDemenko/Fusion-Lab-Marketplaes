"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Locale } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format";
import { useNotifications } from "@/lib/notifications-context";

// Note on scope: only this widget's chrome is translated. `item.title` and
// `item.body` are generated server-side (NotificationsService) in
// Ukrainian regardless of UI locale — same boundary as the AI assistant's
// replies, see assistant-widget.tsx.
export function NotificationsBell() {
  const t = useTranslations("notifications");
  const locale = useLocale() as Locale;
  const { items, unread, connected, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-xl px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--neutral-bg)]"
        onClick={() => setOpen((current) => !current)}
        aria-label={unread ? t("labelWithUnread", { unread }) : t("label")}
        aria-expanded={open}
      >
        {t("label")}
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--danger)] px-1 text-[11px] font-semibold text-white">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="card absolute right-0 mt-2 w-80 overflow-hidden shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
            <span className="text-sm font-semibold">{t("label")}</span>
            <span className="flex items-center gap-2">
              {/* Live vs polled is worth showing: it explains why a new
                  notification did or did not appear without a reload. */}
              <span
                title={connected ? t("live") : t("notLive")}
                className={`h-2 w-2 rounded-full ${connected ? "bg-[var(--success)]" : "bg-[var(--line)]"}`}
              />
              {unread > 0 ? (
                <button
                  type="button"
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                  onClick={() => void markAllRead()}
                >
                  {t("markAllRead")}
                </button>
              ) : null}
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">
                {t("empty")}
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => item.readAt || void markRead(item.id)}
                  className={`block w-full border-b border-[var(--line)] px-4 py-3 text-left last:border-0 hover:bg-[var(--neutral-bg)] ${
                    item.readAt ? "opacity-60" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-[var(--foreground)]">{item.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">{item.body}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatDateTime(item.createdAt, locale)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
