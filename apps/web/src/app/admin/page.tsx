"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AdminStats } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";

export default function AdminPage() {
  return (
    <RequireAuth role="admin">
      <AdminDashboard />
    </RequireAuth>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AdminStats>("/admin/stats")
      .then(setStats)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Помилка завантаження"),
      );
  }, []);

  const links = [
    {
      href: "/admin/listings",
      title: "Модерація лістингів",
      body: stats ? `На розгляді: ${stats.listingsPending}` : "…",
    },
    {
      href: "/admin/sellers",
      title: "Заявки продавців",
      body: stats ? `Очікують: ${stats.sellersPending}` : "…",
    },
    {
      href: "/admin/users",
      title: "Користувачі",
      body: stats ? `Усього: ${stats.users}` : "…",
    },
    {
      href: "/admin/orders",
      title: "Замовлення",
      body: stats ? `Оплачено: ${stats.paidOrders}` : "…",
    },
    {
      href: "/admin/categories",
      title: "Категорії",
      body: "Керування категоріями каталогу",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="section-title">Адмінпанель</h1>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Опубліковано" value={stats ? String(stats.listingsPublished) : "…"} />
        <Stat label="Оплачено замовлень" value={stats ? String(stats.paidOrders) : "…"} />
        <Stat label="Виручка" value={stats?.grossLabel ?? "…"} />
        <Stat label="Комісія" value={stats?.commissionLabel ?? "…"} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="card p-5 transition hover:shadow-md">
            <p className="font-semibold text-zinc-900">{link.title}</p>
            <p className="mt-1.5 text-sm text-zinc-600">{link.body}</p>
          </Link>
        ))}
      </div>
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
