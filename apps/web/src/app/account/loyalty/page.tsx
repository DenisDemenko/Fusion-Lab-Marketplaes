"use client";

import { useEffect, useState } from "react";
import type { LoyaltyHistory, LoyaltyTransactionType } from "@fusion-lab/shared-types";
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

const TYPE_LABELS: Record<LoyaltyTransactionType, string> = {
  earned_purchase: "Кешбек за покупку",
  earned_referral: "Бонус за реферала",
  spent_order: "Оплата замовлення",
  admin_adjustment: "Коригування",
};

function LoyaltyScreen() {
  const [history, setHistory] = useState<LoyaltyHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<LoyaltyHistory>("/me/loyalty")
      .then(setHistory)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Помилка завантаження"),
      );
  }, []);

  if (error) {
    return <p className="mx-auto max-w-2xl px-4 py-16 text-center text-red-700">{error}</p>;
  }

  if (!history) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-zinc-500">Завантаження…</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="section-title">Мої бали</h1>
      <p className="mt-1 text-sm text-zinc-500">
        5% від кожної оплаченої покупки повертається балами — 1 бал = 1 копійка
        знижки на наступне замовлення.
      </p>

      <div className="card mt-6 p-6 text-center">
        <p className="text-sm text-zinc-500">Поточний баланс</p>
        <p className="mt-1 text-4xl font-semibold text-zinc-900">
          {history.balance}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          ≈ {formatUah(history.balance)} знижки
        </p>
      </div>

      {history.transactions.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-zinc-500">
          Історії ще немає — вона зʼявиться після першої оплаченої покупки.
        </p>
      ) : (
        <div className="card mt-6 divide-y divide-[var(--line)]">
          {history.transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-zinc-900">
                  {TYPE_LABELS[tx.type] ?? tx.type}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatDateTime(tx.createdAt)}
                  {tx.orderNumber ? ` · ${tx.orderNumber}` : ""}
                </p>
              </div>
              <span
                className={`font-semibold ${tx.points > 0 ? "text-emerald-700" : "text-red-700"}`}
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
