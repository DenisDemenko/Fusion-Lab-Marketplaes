"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SellerProfile } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatUah } from "@/lib/format";
import { SellerApplyForm } from "@/components/seller-apply-form";

export default function SellerPage() {
  return (
    <RequireAuth>
      <SellerScreen />
    </RequireAuth>
  );
}

function SellerScreen() {
  const { profile, refreshProfile } = useAuth();
  const [seller, setSeller] = useState<SellerProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // GET /seller/me answers 200 with `null` when there is no application
    // yet — a missing seller profile is an expected, common state here,
    // not an error condition.
    api
      .get<SellerProfile | null>("/seller/me")
      .then(setSeller)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Помилка завантаження"),
      );
  }, []);

  if (error) {
    return <p className="mx-auto max-w-2xl px-4 py-16 text-red-700">{error}</p>;
  }

  if (seller === undefined) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-zinc-500">Завантаження…</p>
    );
  }

  if (!seller) {
    return (
      <div className="mx-auto max-w-lg px-4 py-14">
        <h1 className="section-title">Стати продавцем</h1>
        <p className="mt-2 text-zinc-500">
          Подайте заявку — після схвалення адміністратором відкриється кабінет
          для створення лістингів.
        </p>
        <SellerApplyForm
          onApplied={async () => {
            await refreshProfile();
            setSeller(await api.get<SellerProfile>("/seller/me"));
          }}
        />
      </div>
    );
  }

  if (seller.status === "pending") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="section-title">Заявку подано</h1>
        <p className="mt-2 text-zinc-500">
          «{seller.displayName}» очікує на розгляд адміністратором. Це
          зазвичай займає день-два.
        </p>
      </div>
    );
  }

  if (seller.status === "rejected") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="section-title">Заявку відхилено</h1>
        <p className="mt-2 text-zinc-500">
          Зверніться до підтримки, щоб дізнатися деталі, або подайте заявку
          повторно з іншими даними.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">{seller.displayName}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Комісія маркетплейсу: {seller.commissionPercent}%
          </p>
        </div>
        <Link href="/seller/listings/new" className="btn-accent">
          Новий лістинг
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Продано позицій" value={String(seller.stats.itemsSold)} />
        <Stat label="Виручка" value={formatUah(seller.stats.grossMinor)} />
        <Stat
          label="Комісія маркетплейсу"
          value={formatUah(seller.stats.commissionMinor)}
        />
        <Stat label="До виплати" value={formatUah(seller.stats.payoutMinor)} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/seller/listings" className="card p-5 transition hover:shadow-md">
          <p className="font-semibold text-zinc-900">Мої лістинги</p>
          <p className="mt-1 text-sm text-zinc-600">
            {Object.entries(seller.stats.listingsByStatus)
              .map(([status, count]) => `${count} — ${status}`)
              .join(" · ") || "Лістингів ще немає"}
          </p>
        </Link>

        <Link href="/seller/orders" className="card p-5 transition hover:shadow-md">
          <p className="font-semibold text-zinc-900">Продажі</p>
          <p className="mt-1 text-sm text-zinc-600">
            Історія замовлень і виплат по кожній позиції.
          </p>
        </Link>

        <Link href="/seller/payouts" className="card p-5 transition hover:shadow-md">
          <p className="font-semibold text-zinc-900">Виплати</p>
          <p className="mt-1 text-sm text-zinc-600">
            До виплати: {formatUah(seller.stats.payoutMinor)}
          </p>
        </Link>
      </div>

      {profile?.role !== "seller" ? (
        <p className="mt-6 text-sm text-amber-700">
          Роль акаунту ще не оновлена до «продавець» — оновіть сторінку або
          вийдіть і увійдіть знову.
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
