"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ListingCard } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { KIND_LABELS, STATUS_LABELS } from "@/lib/format";

export default function SellerListingsPage() {
  return (
    <RequireAuth>
      <ListingsScreen />
    </RequireAuth>
  );
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  pending_review: "bg-amber-50 text-amber-700",
  published: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  archived: "bg-zinc-100 text-zinc-500",
};

function ListingsScreen() {
  const [listings, setListings] = useState<ListingCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ListingCard[]>("/seller/listings")
      .then(setListings)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Помилка завантаження"),
      );
  }, []);

  if (error) {
    return <p className="mx-auto max-w-4xl px-4 py-16 text-red-700">{error}</p>;
  }

  if (!listings) {
    return (
      <p className="mx-auto max-w-4xl px-4 py-16 text-zinc-500">Завантаження…</p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">Мої лістинги</h1>
        <Link href="/seller/listings/new" className="btn-accent">
          Новий лістинг
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-zinc-500">
          Лістингів ще немає — створіть перший.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/seller/listings/${listing.id}`}
              className="card flex items-center justify-between gap-4 p-4 transition hover:shadow-md"
            >
              <div>
                <p className="font-medium text-zinc-900">{listing.title}</p>
                <p className="text-sm text-zinc-500">
                  {KIND_LABELS[listing.kind] ?? listing.kind} ·{" "}
                  {listing.priceLabel}
                </p>
              </div>
              <span
                className={`badge ${STATUS_STYLE[listing.status] ?? "bg-zinc-100 text-zinc-600"}`}
              >
                {STATUS_LABELS[listing.status] ?? listing.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
