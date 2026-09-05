"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PayoutLedger } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDate, formatUah } from "@/lib/format";

export default function AdminSellerPayoutsPage() {
  return (
    <RequireAuth role="admin">
      <AdminSellerPayoutsScreen />
    </RequireAuth>
  );
}

function uaLabel(label: string, locale: Locale) {
  return locale === "en" ? label.replace("грн", "UAH") : label;
}

// The three totals repeated the same label/value markup three times over,
// and all three were set at one size in the body font — money, in a system
// that keeps the mono face for money. Outstanding is the figure this page
// exists to act on, so it carries the size; when it is zero the card stops
// shouting in accent and says the account is square instead.
function LedgerTotal({
  label,
  value,
  tone = "plain",
  note,
}: {
  label: string;
  value: string;
  tone?: "plain" | "due" | "settled";
  note?: string;
}) {
  // Written out per tone rather than assembled from a token name: Tailwind
  // only ever sees class strings that appear literally in the source.
  const TONES = {
    plain: {
      card: "card p-5",
      value: "mt-1 font-mono text-xl font-semibold text-[var(--foreground)]",
      note: "badge mt-2 bg-[var(--neutral-bg)] text-[var(--muted)]",
    },
    due: {
      card: "card border-[var(--accent)] p-5",
      value: "mt-1 font-mono text-2xl font-semibold text-[var(--accent)]",
      note: "badge mt-2 bg-[var(--accent-soft)] text-[var(--accent)]",
    },
    settled: {
      card: "card border-[var(--success)] p-5",
      value: "mt-1 font-mono text-2xl font-semibold text-[var(--success)]",
      note: "badge mt-2 bg-[var(--success-soft)] text-[var(--success)]",
    },
  }[tone];

  return (
    <div className={TONES.card}>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className={TONES.value}>{value}</p>
      {note ? <span className={TONES.note}>{note}</span> : null}
    </div>
  );
}

function AdminSellerPayoutsScreen() {
  const t = useTranslations("adminSellerPayouts");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const params = useParams<{ id: string }>();
  const [ledger, setLedger] = useState<PayoutLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    try {
      setLedger(await api.get<PayoutLedger>(`/admin/sellers/${params.id}/payouts`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("loadError"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function record(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.post(`/admin/sellers/${params.id}/payouts`, {
        amountMinor: Math.round(Number(amount.replace(",", ".")) * 100),
        note: note.trim() || undefined,
      });
      setAmount("");
      setNote("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("recordFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (error && !ledger) {
    return <p className="mx-auto max-w-2xl px-4 py-16 text-center text-[var(--danger)]">{error}</p>;
  }

  if (!ledger) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/admin/sellers" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        {t("backToSellers")}
      </Link>

      <PageHeader title={t("title")} />

      <div className="grid gap-4 sm:grid-cols-3">
        <LedgerTotal label={t("earned")} value={uaLabel(ledger.earnedLabel, locale)} />
        <LedgerTotal label={t("paidOut")} value={uaLabel(ledger.paidOutLabel, locale)} />
        <LedgerTotal
          label={t("outstanding")}
          value={uaLabel(ledger.outstandingLabel, locale)}
          tone={ledger.outstandingMinor > 0 ? "due" : "settled"}
          note={ledger.outstandingMinor > 0 ? undefined : t("settled")}
        />
      </div>

      <form onSubmit={record} className="card mt-6 space-y-4 p-6">
        <p className="font-medium text-[var(--foreground)]">{t("recordPayout")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="amount">
              {t("amountLabel")}
            </label>
            <input
              id="amount"
              className="input"
              inputMode="decimal"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="note">
              {t("noteLabel")}
            </label>
            <input
              id="note"
              className="input"
              placeholder={t("notePlaceholder")}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-[var(--danger-soft)] px-3.5 py-2.5 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? t("recording") : t("recordPayout")}
        </button>
      </form>

      {ledger.entries.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-[var(--muted)]">{t("emptyHistory")}</p>
      ) : (
        <div className="card mt-6 divide-y divide-[var(--line)]">
          {/* A payout row is whatever note the admin typed — "card
              transfer" reads exactly like a sale did, and the sign was
              carried only by a colour that made the payouts, the entries
              this page is about, look disabled. The ledger already knows
              which kind each entry is, so each row now says so. */}
          {ledger.entries.map((entry, index) => {
            const isPayout = entry.type === "payout";

            return (
              <div key={index} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`badge ${
                        isPayout
                          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "bg-[var(--success-soft)] text-[var(--success)]"
                      }`}
                    >
                      {isPayout ? t("entryPayout") : t("entrySale")}
                    </span>
                    <span className="font-mono text-xs text-[var(--muted)]">
                      {formatDate(entry.date, locale)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--foreground)]">
                    {entry.description}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-mono font-semibold ${
                    isPayout ? "text-[var(--foreground)]" : "text-[var(--success)]"
                  }`}
                >
                  {entry.amountMinor >= 0 ? "+" : ""}
                  {formatUah(entry.amountMinor, locale)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
