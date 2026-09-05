"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { PayoutLedger } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDate, formatUah } from "@/lib/format";

// Same idea as the seller dashboard's status pills: what an entry *is*
// (money coming in from a sale vs. an actual bank payout going out)
// matters as much as its sign, and reading "+ ₴450" still leaves that
// question to the description text.
const ENTRY_STYLE: Record<string, string> = {
  sale: "bg-[var(--success-soft)] text-[var(--success)]",
  payout: "bg-[var(--accent-soft)] text-[var(--accent)]",
};

export default function SellerPayoutsPage() {
  return (
    <RequireAuth>
      <PayoutsScreen />
    </RequireAuth>
  );
}

function uaLabel(label: string, locale: Locale) {
  return locale === "en" ? label.replace("грн", "UAH") : label;
}

function PayoutsScreen() {
  const t = useTranslations("sellerPayouts");
  const tCommon = useTranslations("common");
  const tEntryType = useTranslations("enums.payoutEntryType");
  const locale = useLocale() as Locale;
  const [ledger, setLedger] = useState<PayoutLedger | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PayoutLedger>("/seller/payouts")
      .then(setLedger)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : tCommon("loadError")),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-[var(--danger)]">{error}</p>;
  }

  if (!ledger) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title={t("title")} />

      {/* Money figures elsewhere in the seller area (dashboard stats, the
          orders table) are set in JetBrains Mono so digits line up; these
          three cards were the one place still on the proportional body
          face. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-[var(--muted)]">{t("totalEarned")}</p>
          <p className="mt-1 font-mono text-xl font-semibold text-[var(--foreground)]">
            {uaLabel(ledger.earnedLabel, locale)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-[var(--muted)]">{t("totalPaidOut")}</p>
          <p className="mt-1 font-mono text-xl font-semibold text-[var(--foreground)]">
            {uaLabel(ledger.paidOutLabel, locale)}
          </p>
        </div>
        <div className="card border-[var(--accent)] p-5">
          <p className="text-sm text-[var(--muted)]">{t("outstanding")}</p>
          <p className="mt-1 font-mono text-xl font-semibold text-[var(--accent)]">
            {uaLabel(ledger.outstandingLabel, locale)}
          </p>
        </div>
      </div>

      {ledger.entries.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-[var(--muted)]">{t("emptyHistory")}</p>
      ) : (
        <div className="card mt-6 divide-y divide-[var(--line)]">
          {ledger.entries.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`badge ${ENTRY_STYLE[entry.type] ?? "bg-[var(--neutral-bg)] text-[var(--muted)]"}`}
                  >
                    {tEntryType(entry.type)}
                  </span>
                  <p className="font-medium text-[var(--foreground)]">{entry.description}</p>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(entry.date, locale)}</p>
              </div>
              <span
                className={`font-mono font-semibold ${
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
