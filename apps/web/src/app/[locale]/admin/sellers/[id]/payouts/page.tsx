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
        <div className="card p-5">
          <p className="text-sm text-[var(--muted)]">{t("earned")}</p>
          <p className="mt-1 text-xl font-semibold">{uaLabel(ledger.earnedLabel, locale)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-[var(--muted)]">{t("paidOut")}</p>
          <p className="mt-1 text-xl font-semibold">{uaLabel(ledger.paidOutLabel, locale)}</p>
        </div>
        <div className="card border-[var(--accent)] p-5">
          <p className="text-sm text-[var(--muted)]">{t("outstanding")}</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">
            {uaLabel(ledger.outstandingLabel, locale)}
          </p>
        </div>
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
          {ledger.entries.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-[var(--foreground)]">{entry.description}</p>
                <p className="text-xs text-[var(--muted)]">{formatDate(entry.date, locale)}</p>
              </div>
              <span
                className={`font-semibold ${
                  entry.amountMinor >= 0 ? "text-[var(--success)]" : "text-[var(--muted)]"
                }`}
              >
                {entry.amountMinor >= 0 ? "+" : ""}
                {formatUah(entry.amountMinor, locale)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
