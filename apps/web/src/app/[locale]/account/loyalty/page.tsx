"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { LoyaltyHistory, LoyaltyTransactionType } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDateTime, formatUah } from "@/lib/format";

export default function LoyaltyPage() {
  return (
    <RequireAuth>
      <LoyaltyScreen />
    </RequireAuth>
  );
}

function LoyaltyScreen() {
  const t = useTranslations("accountLoyalty");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [history, setHistory] = useState<LoyaltyHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const TYPE_LABELS: Record<LoyaltyTransactionType, string> = {
    earned_purchase: t("typeEarnedPurchase"),
    earned_referral: t("typeEarnedReferral"),
    spent_order: t("typeSpentOrder"),
    admin_adjustment: t("typeAdminAdjustment"),
  };

  useEffect(() => {
    api
      .get<LoyaltyHistory>("/me/loyalty")
      .then(setHistory)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : tCommon("loadError")),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="mx-auto max-w-2xl px-4 py-16 text-center text-[var(--danger)]">{error}</p>;
  }

  if (!history) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
      />

      <div className="card p-6 text-center">
        <p className="text-sm text-[var(--muted)]">{t("currentBalance")}</p>
        {/* The one number this whole page exists to show, so it gets the
            display face and tight tracking used elsewhere for a headline
            figure (cart's total, a listing's price) — it was sitting in
            plain body weight like any other line. */}
        <p className="mt-1 font-display text-4xl font-semibold tracking-tight text-[var(--foreground)]">
          {history.balance}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {t("discountApprox", { amount: formatUah(history.balance, locale) })}
        </p>
      </div>

      {history.transactions.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-[var(--muted)]">{t("emptyHistory")}</p>
      ) : (
        <div className="card mt-6 divide-y divide-[var(--line)]">
          {history.transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-[var(--foreground)]">
                  {TYPE_LABELS[tx.type] ?? tx.type}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {formatDateTime(tx.createdAt, locale)}
                  {tx.orderNumber ? ` · ${tx.orderNumber}` : ""}
                </p>
              </div>
              {/* A ledger of point deltas is technical/numeric data, same
                  as the seat counts and dates elsewhere in the app — mono
                  reads as "a figure", not as a word next to other words. */}
              <span
                className={`font-mono font-semibold ${tx.points > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
              >
                {tx.points > 0 ? "+" : ""}
                {tx.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
