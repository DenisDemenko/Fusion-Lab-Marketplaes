"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

type InviteStatus = "pending" | "accepted" | "expired";

type Invite = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  status: InviteStatus;
};

type CreatedInvite = {
  id: string;
  email: string;
  expiresAt: string;
  emailed: boolean;
  notifiedInApp: boolean;
};

// Phase H2.4. The writer's side of the only door into the sales_manager
// role — it is absent from SELF_SELECTABLE_ROLES, so nobody arrives here by
// choosing it in their profile.
export function SalesManagerInvites() {
  const t = useTranslations("salesManagerInvites");
  const locale = useLocale() as Locale;

  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when an invite was created but no letter left the building, so the
  // writer is told to pass the link on rather than assuming it arrived.
  const [undelivered, setUndelivered] = useState<string | null>(null);

  async function load() {
    try {
      setInvites(await api.get<Invite[]>("/me/sales-manager-invites"));
    } catch {
      setInvites([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function invite() {
    if (!email.trim()) return;

    setBusy(true);
    setError(null);
    setUndelivered(null);

    try {
      const created = await api.post<CreatedInvite>("/me/sales-manager-invites", {
        email: email.trim(),
      });
      setEmail("");
      if (!created.emailed) setUndelivered(created.email);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await api.delete(`/me/sales-manager-invites/${id}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("failed"));
    }
  }

  return (
    <section className="card mt-6 p-5">
      <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--foreground)]">
        {t("title")}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
        {t("body")}
      </p>

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void invite();
        }}
      >
        <input
          type="email"
          required
          className="input flex-1"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={busy}>
          {busy ? t("sending") : t("send")}
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-2.5 text-sm text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}

      {undelivered ? (
        <p className="mt-3 rounded-xl border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-3.5 py-2.5 text-sm text-[var(--warning)]">
          {t("notEmailed", { email: undelivered })}
        </p>
      ) : null}

      {invites && invites.length > 0 ? (
        <ul className="mt-5 divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {invites.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">
                  {item.email}
                </p>
                <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">
                  {item.status === "accepted" && item.acceptedAt
                    ? formatDateTime(item.acceptedAt, locale)
                    : formatDateTime(item.expiresAt, locale)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <StatusBadge status={item.status} label={t(item.status)} />
                {item.status === "pending" ? (
                  <button
                    type="button"
                    className="text-sm text-[var(--danger)] hover:underline"
                    onClick={() => void revoke(item.id)}
                  >
                    {t("revoke")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: InviteStatus;
  label: string;
}) {
  const tone =
    status === "accepted"
      ? "bg-[var(--success-soft)] text-[var(--success)]"
      : status === "expired"
        ? "bg-[var(--neutral-bg)] text-[var(--muted)]"
        : "bg-[var(--warning-soft)] text-[var(--warning)]";

  return <span className={`badge ${tone}`}>{label}</span>;
}
