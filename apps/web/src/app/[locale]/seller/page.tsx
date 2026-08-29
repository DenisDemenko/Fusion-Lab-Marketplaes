"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { SellerProfile } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
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
  const t = useTranslations("sellerHome");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
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
        setError(caught instanceof Error ? caught.message : tCommon("loadError")),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="mx-auto max-w-2xl px-4 py-16 text-red-700">{error}</p>;
  }

  if (seller === undefined) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-zinc-500">{tCommon("loading")}</p>
    );
  }

  if (!seller) {
    return (
      <div className="mx-auto max-w-lg px-4 py-14">
        <h1 className="section-title">{t("becomeSellerTitle")}</h1>
        <p className="mt-2 text-zinc-500">{t("becomeSellerBody")}</p>
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
        <h1 className="section-title">{t("pendingTitle")}</h1>
        <p className="mt-2 text-zinc-500">
          {t("pendingBody", { name: seller.displayName })}
        </p>
      </div>
    );
  }

  if (seller.status === "rejected") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="section-title">{t("rejectedTitle")}</h1>
        <p className="mt-2 text-zinc-500">{t("rejectedBody")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">{seller.displayName}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("commissionLabel", { percent: seller.commissionPercent })}
          </p>
        </div>
        <Link href="/seller/listings/new" className="btn-accent">
          {t("newListing")}
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("statItemsSold")} value={String(seller.stats.itemsSold)} />
        <Stat label={t("statRevenue")} value={formatUah(seller.stats.grossMinor, locale)} />
        <Stat
          label={t("statCommission")}
          value={formatUah(seller.stats.commissionMinor, locale)}
        />
        <Stat label={t("statPayout")} value={formatUah(seller.stats.payoutMinor, locale)} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/seller/listings" className="card p-5 transition hover:shadow-md">
          <p className="font-semibold text-zinc-900">{t("myListings")}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {Object.entries(seller.stats.listingsByStatus)
              .map(([status, count]) => `${count} — ${status}`)
              .join(" · ") || t("noListingsYet")}
          </p>
        </Link>

        <Link href="/seller/orders" className="card p-5 transition hover:shadow-md">
          <p className="font-semibold text-zinc-900">{t("salesTitle")}</p>
          <p className="mt-1 text-sm text-zinc-600">{t("salesBody")}</p>
        </Link>

        <Link href="/seller/payouts" className="card p-5 transition hover:shadow-md">
          <p className="font-semibold text-zinc-900">{t("payoutsTitle")}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {t("payoutsToPay", { amount: formatUah(seller.stats.payoutMinor, locale) })}
          </p>
        </Link>
      </div>

      {profile?.role !== "seller" ? (
        <p className="mt-6 text-sm text-amber-700">{t("roleNotUpdated")}</p>
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
