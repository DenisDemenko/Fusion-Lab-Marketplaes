"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ListingCard, ListingStatus } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { KIND_LABELS, STATUS_LABELS } from "@/lib/format";

type AdminListingRow = ListingCard & {
  rejectionReason: string | null;
  description: string | null;
  lockedFiles: number;
};

const TABS: { value: ListingStatus | ""; label: string }[] = [
  { value: "pending_review", label: "На модерації" },
  { value: "published", label: "Опубліковані" },
  { value: "rejected", label: "Відхилені" },
  { value: "draft", label: "Чернетки" },
  { value: "", label: "Усі" },
];

export default function AdminListingsPage() {
  return (
    <RequireAuth role="admin">
      <ModerationScreen />
    </RequireAuth>
  );
}

function ModerationScreen() {
  const [status, setStatus] = useState<ListingStatus | "">("pending_review");
  const [listings, setListings] = useState<AdminListingRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextStatus: ListingStatus | "") => {
    const query = nextStatus ? `?status=${nextStatus}` : "";
    try {
      setListings(
        await api.get<AdminListingRow[]>(`/admin/listings${query}`),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не вдалося завантажити лістинги",
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
      await api.post(`/admin/listings/${id}/approve`);
      await load(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Дія не виконалась");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = prompt("Причина відхилення (побачить продавець):");
    if (!reason?.trim()) return;

    setBusyId(id);
    setError(null);
    try {
      await api.post(`/admin/listings/${id}/reject`, { reason: reason.trim() });
      await load(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Дія не виконалась");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="section-title">Модерація лістингів</h1>

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

      {!listings ? (
        <p className="mt-6 text-zinc-500">Завантаження…</p>
      ) : listings.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-zinc-500">Порожньо.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {listings.map((listing) => (
            <div key={listing.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900">{listing.title}</p>
                  <p className="text-sm text-zinc-500">
                    {KIND_LABELS[listing.kind]} · {listing.priceLabel} ·{" "}
                    продавець: {listing.seller?.displayName ?? "—"}
                  </p>
                  {listing.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
                      {listing.description}
                    </p>
                  ) : null}
                  {listing.rejectionReason ? (
                    <p className="mt-2 text-sm text-red-700">
                      Причина відхилення: {listing.rejectionReason}
                    </p>
                  ) : null}
                </div>

                <span className="badge bg-zinc-100 text-zinc-600">
                  {STATUS_LABELS[listing.status] ?? listing.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/catalog/${listing.slug}`}
                  target="_blank"
                  className="btn-ghost"
                >
                  Переглянути
                </Link>

                {listing.status === "pending_review" ? (
                  <>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busyId === listing.id}
                      onClick={() => void approve(listing.id)}
                    >
                      Схвалити
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={busyId === listing.id}
                      onClick={() => void reject(listing.id)}
                    >
                      Відхилити
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
