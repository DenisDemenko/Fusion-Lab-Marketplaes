"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { SellerProfile } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
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

// Same status -> color mapping as seller/listings and the listing editor,
// so a status reads the same wherever it appears in the seller area.
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[var(--neutral-bg)] text-[var(--muted)]",
  pending_review: "bg-[var(--warning-soft)] text-[var(--warning)]",
  published: "bg-[var(--success-soft)] text-[var(--success)]",
  rejected: "bg-[var(--danger-soft)] text-[var(--danger)]",
  archived: "bg-[var(--neutral-bg)] text-[var(--muted)]",
};

function SellerScreen() {
  const t = useTranslations("sellerHome");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("enums.listingStatus");
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
    return <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--danger)]">{error}</p>;
  }

  if (seller === undefined) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>
    );
  }

  if (!seller) {
    return (
      <div className="mx-auto max-w-lg px-4 py-14">
        <h1 className="section-title">{t("becomeSellerTitle")}</h1>
        <p className="mt-2 text-[var(--muted)]">{t("becomeSellerBody")}</p>
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
        <p className="mt-2 text-[var(--muted)]">
          {t("pendingBody", { name: seller.displayName })}
        </p>
      </div>
    );
  }

  if (seller.status === "rejected") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="section-title">{t("rejectedTitle")}</h1>
        <p className="mt-2 text-[var(--muted)]">{t("rejectedBody")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title={seller.displayName}
        description={t("commissionLabel", { percent: seller.commissionPercent })}
        actions={
          <Link href="/seller/listings/new" className="btn-accent">
            {t("newListing")}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("statItemsSold")} value={String(seller.stats.itemsSold)} />
        <Stat label={t("statRevenue")} value={formatUah(seller.stats.grossMinor, locale)} />
        <Stat
          label={t("statCommission")}
          value={formatUah(seller.stats.commissionMinor, locale)}
        />
        <Stat
          label={t("statPayout")}
          value={formatUah(seller.stats.payoutMinor, locale)}
          emphasis
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/seller/listings" className="card p-5 transition hover:shadow-md">
          <p className="font-semibold text-[var(--foreground)]">{t("myListings")}</p>
          {/* This used to be one grey sentence ("3 — Опубліковано · 2 —
              Чернетка"), which reads as a caption rather than the state of
              the seller's inventory. Status is the whole point of this
              card, so each count now gets the same color a listing's own
              badge uses — draft vs. pending vs. published is visible
              before any text is read. */}
          {Object.keys(seller.stats.listingsByStatus).length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(seller.stats.listingsByStatus).map(([status, count]) => (
                <span
                  key={status}
                  className={`badge ${STATUS_STYLE[status] ?? "bg-[var(--neutral-bg)] text-[var(--muted)]"}`}
                >
                  <span className="font-mono">{count}</span> {tStatus(status)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-[var(--muted)]">{t("noListingsYet")}</p>
          )}
        </Link>

        <Link href="/seller/orders" className="card p-5 transition hover:shadow-md">
          <p className="font-semibold text-[var(--foreground)]">{t("salesTitle")}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("salesBody")}</p>
        </Link>

        <Link href="/seller/payouts" className="card p-5 transition hover:shadow-md">
          <p className="font-semibold text-[var(--foreground)]">{t("payoutsTitle")}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {t("payoutsToPay", { amount: formatUah(seller.stats.payoutMinor, locale) })}
          </p>
        </Link>
      </div>

      {profile?.role !== "seller" ? (
        <p className="mt-6 text-sm text-[var(--warning)]">{t("roleNotUpdated")}</p>
      ) : null}
    </div>
  );
}

// Суми набрані моноширинним: у сітці з чотирьох карток цифри мають
// вирівнюватись по розрядах, інакше їх незручно порівнювати очима.
function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`card p-5 ${emphasis ? "border-l-4 border-l-[var(--accent)]" : ""}`}>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p
        className={`mt-1 font-mono text-xl font-semibold ${
          emphasis ? "text-[var(--accent-dk)]" : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
