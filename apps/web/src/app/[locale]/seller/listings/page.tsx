"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ListingCard } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";

export default function SellerListingsPage() {
  return (
    <RequireAuth>
      <ListingsScreen />
    </RequireAuth>
  );
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[var(--neutral-bg)] text-[var(--muted)]",
  pending_review: "bg-amber-50 text-amber-700",
  published: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  archived: "bg-[var(--neutral-bg)] text-[var(--muted)]",
};

function uaLabel(label: string, locale: Locale) {
  return locale === "en" ? label.replace("грн", "UAH") : label;
}

function ListingsScreen() {
  const t = useTranslations("sellerListings");
  const tCommon = useTranslations("common");
  const tKind = useTranslations("enums.kind");
  const tStatus = useTranslations("enums.listingStatus");
  const locale = useLocale() as Locale;
  const [listings, setListings] = useState<ListingCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ListingCard[]>("/seller/listings")
      .then(setListings)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : tCommon("loadError")),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="mx-auto max-w-4xl px-4 py-16 text-red-700">{error}</p>;
  }

  if (!listings) {
    return (
      <p className="mx-auto max-w-4xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">{t("title")}</h1>
        <Link href="/seller/listings/new" className="btn-accent">
          {t("newListing")}
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-[var(--muted)]">{t("emptyBody")}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/seller/listings/${listing.id}`}
              className="card flex items-center justify-between gap-4 p-4 transition hover:shadow-md"
            >
              <div>
                <p className="font-medium text-[var(--foreground)]">{listing.title}</p>
                <p className="text-sm text-[var(--muted)]">
                  {tKind(listing.kind)} · {uaLabel(listing.priceLabel, locale)}
                </p>
              </div>
              <span
                className={`badge ${STATUS_STYLE[listing.status] ?? "bg-[var(--neutral-bg)] text-[var(--muted)]"}`}
              >
                {tStatus(listing.status)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
