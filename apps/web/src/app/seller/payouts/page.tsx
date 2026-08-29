"use client";

import { useEffect, useState } from "react";
import type { PayoutLedger } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export default function SellerPayoutsPage() {
  return (
    <RequireAuth>
      <PayoutsScreen />
    </RequireAuth>
  );
}

function PayoutsScreen() {
  const [ledger, setLedger] = useState<PayoutLedger | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PayoutLedger>("/seller/payouts")
      .then(setLedger)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Помилка завантаження"),
      );
  }, []);

  if (error) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-red-700">{error}</p>;
  }

  if (!ledger) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-zinc-500">Завантаження…</p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="section-title">Виплати</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-zinc-500">Зароблено всього</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">
            {ledger.earnedLabel}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-zinc-500">Уже виплачено</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">
            {ledger.paidOutLabel}
          </p>
        </div>
        <div className="card border-[var(--accent)] p-5">
          <p className="text-sm text-zinc-500">До виплати</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">
            {ledger.outstandingLabel}
          </p>
        </div>
      </div>

      {ledger.entries.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-zinc-500">
          Історії ще немає — вона зʼявиться після першого продажу.
        </p>
      ) : (
        <div className="card mt-6 divide-y divide-[var(--line)]">
          {ledger.entries.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-zinc-900">{entry.description}</p>
                <p className="text-xs text-zinc-500">{formatDate(entry.date)}</p>
              </div>
              <span
                className={`font-semibold ${
                  entry.amountMinor >= 0 ? "text-emerald-700" : "text-zinc-600"
                }`}
              >
                {entry.amountMinor >= 0 ? "+" : ""}
                {(entry.amountMinor / 100).toFixed(2)} грн
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
