"use client";

import { useEffect, useState } from "react";
import type { SellerStatus } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

interface AdminSellerRow {
  id: string;
  displayName: string;
  slug: string;
  bio: string | null;
  status: SellerStatus;
  createdAt: string;
  user: { email: string; role: string };
  _count: { listings: number };
}

const TABS: { value: SellerStatus | ""; label: string }[] = [
  { value: "pending", label: "Очікують" },
  { value: "approved", label: "Схвалені" },
  { value: "rejected", label: "Відхилені" },
  { value: "", label: "Усі" },
];

export default function AdminSellersPage() {
  return (
    <RequireAuth role="admin">
      <SellersScreen />
    </RequireAuth>
  );
}

function SellersScreen() {
  const [status, setStatus] = useState<SellerStatus | "">("pending");
  const [sellers, setSellers] = useState<AdminSellerRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextStatus: SellerStatus | "") => {
    const query = nextStatus ? `?status=${nextStatus}` : "";
    try {
      setSellers(await api.get<AdminSellerRow[]>(`/admin/sellers${query}`));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не вдалося завантажити заявки",
      );
    }
  };

  useEffect(() => {
    void load(status);
  }, [status]);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/admin/sellers/${id}/approve`);
      await load(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Дія не виконалась");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = prompt("Причина відхилення (необовʼязково):") ?? undefined;
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/admin/sellers/${id}/reject`, { reason });
      await load(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Дія не виконалась");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="section-title">Заявки продавців</h1>

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value || "all"}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              status === tab.value
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-[var(--line)] bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!sellers ? (
        <p className="mt-6 text-zinc-500">Завантаження…</p>
      ) : sellers.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-zinc-500">Порожньо.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {sellers.map((seller) => (
            <div key={seller.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900">
                    {seller.displayName}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {seller.user.email} · подано {formatDate(seller.createdAt)} ·{" "}
                    лістингів: {seller._count.listings}
                  </p>
                  {seller.bio ? (
                    <p className="mt-2 text-sm text-zinc-600">{seller.bio}</p>
                  ) : null}
                </div>
                <span className="badge bg-zinc-100 text-zinc-600">
                  {seller.status}
                </span>
              </div>

              {seller.status === "pending" ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busyId === seller.id}
                    onClick={() => void approve(seller.id)}
                  >
                    Схвалити
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busyId === seller.id}
                    onClick={() => void reject(seller.id)}
                  >
                    Відхилити
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
