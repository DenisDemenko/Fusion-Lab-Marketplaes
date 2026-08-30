"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { AdminStats } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";

function uaLabel(label: string, locale: Locale) {
  return locale === "en" ? label.replace("грн", "UAH") : label;
}

export default function AdminPage() {
  return (
    <RequireAuth role="admin">
      <AdminDashboard />
    </RequireAuth>
  );
}

function AdminDashboard() {
  const t = useTranslations("adminHome");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AdminStats>("/admin/stats")
      .then(setStats)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : tCommon("loadError")),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const links = [
    {
      href: "/admin/listings",
      title: t("listingsModeration"),
      body: stats ? t("pendingCount", { count: stats.listingsPending }) : "…",
    },
    {
      href: "/admin/sellers",
      title: t("sellerApplications"),
      body: stats ? t("pendingSellers", { count: stats.sellersPending }) : "…",
    },
    {
      href: "/admin/users",
      title: t("users"),
      body: stats ? t("totalUsers", { count: stats.users }) : "…",
    },
    {
      href: "/admin/orders",
      title: t("ordersTitle"),
      body: stats ? t("paidOrders", { count: stats.paidOrders }) : "…",
    },
    {
      href: "/admin/categories",
      title: t("categoriesTitle"),
      body: t("categoriesBody"),
    },
    {
      href: "/admin/promo-codes",
      title: t("promoCodesTitle"),
      body: t("promoCodesBody"),
    },
    {
      href: "/admin/schedule",
      title: t("scheduleTitle"),
      body: t("scheduleBody"),
    },
    {
      href: "/admin/teams",
      title: t("teamsTitle"),
      body: t("teamsBody"),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader title={t("title")} />

      {error ? (
        <p className="mt-4 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t("statPublished")}
          value={stats ? String(stats.listingsPublished) : "…"}
        />
        <Stat
          label={t("statPaidOrders")}
          value={stats ? String(stats.paidOrders) : "…"}
        />
        <Stat
          label={t("statRevenue")}
          value={stats?.grossLabel ? uaLabel(stats.grossLabel, locale) : "…"}
        />
        <Stat
          label={t("statCommission")}
          value={stats?.commissionLabel ? uaLabel(stats.commissionLabel, locale) : "…"}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="card p-5 transition hover:shadow-md">
            <p className="font-semibold text-[var(--foreground)]">{link.title}</p>
            <p className="mt-1.5 text-sm text-[var(--muted)]">{link.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
