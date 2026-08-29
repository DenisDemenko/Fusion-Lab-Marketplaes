"use client";

import { useEffect, useState } from "react";
import type { PromoCode, PromoCodeType } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export default function AdminPromoCodesPage() {
  return (
    <RequireAuth role="admin">
      <PromoCodesScreen />
    </RequireAuth>
  );
}

function PromoCodesScreen() {
  const [codes, setCodes] = useState<PromoCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState("");
  const [type, setType] = useState<PromoCodeType>("percent");
  const [value, setValue] = useState("10");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function load() {
    try {
      setCodes(await api.get<PromoCode[]>("/admin/promo-codes"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Помилка завантаження");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.post("/admin/promo-codes", {
        code: code.trim(),
        type,
        value: Number(value),
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setCode("");
      setValue("10");
      setMaxRedemptions("");
      setExpiresAt("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не вдалося створити промокод",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    setError(null);
    try {
      await api.patch(`/admin/promo-codes/${id}`, { active: !active });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Дія не виконалась");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="section-title">Промокоди</h1>

      <form onSubmit={create} className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="code">
            Код
          </label>
          <input
            id="code"
            className="input"
            required
            minLength={3}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="type">
            Тип
          </label>
          <select
            id="type"
            className="input"
            value={type}
            onChange={(event) => setType(event.target.value as PromoCodeType)}
          >
            <option value="percent">Відсоток</option>
            <option value="fixed">Фіксована сума (коп.)</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="value">
            {type === "percent" ? "Відсоток (1-100)" : "Сума в копійках"}
          </label>
          <input
            id="value"
            className="input"
            type="number"
            min={1}
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="maxRedemptions">
            Ліміт використань (необовʼязково)
          </label>
          <input
            id="maxRedemptions"
            className="input"
            type="number"
            min={1}
            placeholder="без обмежень"
            value={maxRedemptions}
            onChange={(event) => setMaxRedemptions(event.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="expiresAt">
            Діє до (необовʼязково)
          </label>
          <input
            id="expiresAt"
            className="input"
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </div>

        {error ? (
          <p className="sm:col-span-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn-primary sm:col-span-2"
          disabled={busy}
        >
          {busy ? "Створюю…" : "Створити промокод"}
        </button>
      </form>

      {!codes ? (
        <p className="mt-6 text-zinc-500">Завантаження…</p>
      ) : codes.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-zinc-500">Промокодів ще немає.</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">Код</th>
                <th className="px-4 py-3 font-medium">Знижка</th>
                <th className="px-4 py-3 font-medium">Використано</th>
                <th className="px-4 py-3 font-medium">Діє до</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {codes.map((promo) => (
                <tr key={promo.id}>
                  <td className="px-4 py-3 font-mono font-medium">{promo.code}</td>
                  <td className="px-4 py-3">
                    {promo.type === "percent"
                      ? `${promo.value}%`
                      : `${(promo.value / 100).toFixed(2)} грн`}
                  </td>
                  <td className="px-4 py-3">
                    {promo.redemptionCount}
                    {promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ""}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {promo.expiresAt ? formatDate(promo.expiresAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${promo.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}
                    >
                      {promo.active ? "активний" : "вимкнено"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-sm text-zinc-600 hover:underline"
                      onClick={() => void toggle(promo.id, promo.active)}
                    >
                      {promo.active ? "Вимкнути" : "Увімкнути"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
