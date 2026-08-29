"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PayoutLedger } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export default function AdminSellerPayoutsPage() {
  return (
    <RequireAuth role="admin">
      <AdminSellerPayoutsScreen />
    </RequireAuth>
  );
}

function AdminSellerPayoutsScreen() {
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
      setError(caught instanceof Error ? caught.message : "Помилка завантаження");
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
      setError(
        caught instanceof Error ? caught.message : "Не вдалося зареєструвати виплату",
      );
    } finally {
      setBusy(false);
    }
  }

  if (error && !ledger) {
    return <p className="mx-auto max-w-2xl px-4 py-16 text-center text-red-700">{error}</p>;
  }

  if (!ledger) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-zinc-500">Завантаження…</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/admin/sellers" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Продавці
      </Link>

      <h1 className="section-title mt-3">Виплати продавцю</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-zinc-500">Зароблено</p>
          <p className="mt-1 text-xl font-semibold">{ledger.earnedLabel}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-zinc-500">Виплачено</p>
          <p className="mt-1 text-xl font-semibold">{ledger.paidOutLabel}</p>
        </div>
        <div className="card border-[var(--accent)] p-5">
          <p className="text-sm text-zinc-500">Заборгованість</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">
            {ledger.outstandingLabel}
          </p>
        </div>
      </div>

      <form onSubmit={record} className="card mt-6 space-y-4 p-6">
        <p className="font-medium text-zinc-900">Зареєструвати виплату</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="amount">
              Сума, грн
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
              Примітка
            </label>
            <input
              id="note"
              className="input"
              placeholder="Напр. переказ на картку"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Реєструю…" : "Зареєструвати виплату"}
        </button>
      </form>

      {ledger.entries.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-zinc-500">Історії ще немає.</p>
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
