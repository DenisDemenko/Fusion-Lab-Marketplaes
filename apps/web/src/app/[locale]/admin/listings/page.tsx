"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ListingCard, ListingStatus } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";

function uaLabel(label: string, locale: Locale) {
  return locale === "en" ? label.replace("грн", "UAH") : label;
}

type AdminListingRow = ListingCard & {
  rejectionReason: string | null;
  description: string | null;
  lockedFiles: number;
};

export default function AdminListingsPage() {
  return (
    <RequireAuth role="admin">
      <ModerationScreen />
    </RequireAuth>
  );
}

function ModerationScreen() {
  const t = useTranslations("adminListings");
  const tCommon = useTranslations("common");
  const tKind = useTranslations("enums.kind");
  const tStatus = useTranslations("enums.listingStatus");
  const locale = useLocale() as Locale;

  const TABS: { value: ListingStatus | ""; label: string }[] = [
    { value: "pending_review", label: t("tabPendingReview") },
    { value: "published", label: t("tabPublished") },
    { value: "rejected", label: t("tabRejected") },
    { value: "draft", label: t("tabDraft") },
    { value: "", label: t("tabAll") },
  ];

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
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    }
  };

  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/admin/listings/${id}/approve`);
      await load(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = prompt(t("rejectReasonPrompt"));
    if (!reason?.trim()) return;

    setBusyId(id);
    setError(null);
    try {
      await api.post(`/admin/listings/${id}/reject`, { reason: reason.trim() });
      await load(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="section-title">{t("title")}</h1>

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
        <p className="mt-6 text-zinc-500">{tCommon("loading")}</p>
      ) : listings.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-zinc-500">{t("empty")}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {listings.map((listing) => (
            <div key={listing.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900">{listing.title}</p>
                  <p className="text-sm text-zinc-500">
                    {tKind(listing.kind)} · {uaLabel(listing.priceLabel, locale)} ·{" "}
                    {t("sellerLabel", { name: listing.seller?.displayName ?? "—" })}
                  </p>
                  {listing.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
                      {listing.description}
                    </p>
                  ) : null}
                  {listing.rejectionReason ? (
                    <p className="mt-2 text-sm text-red-700">
                      {t("rejectionReasonLabel", { reason: listing.rejectionReason })}
                    </p>
                  ) : null}
                </div>

                <span className="badge bg-zinc-100 text-zinc-600">
                  {tStatus(listing.status)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/catalog/${listing.slug}`}
                  target="_blank"
                  className="btn-ghost"
                >
                  {t("view")}
                </Link>

                {listing.status === "pending_review" ? (
                  <>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busyId === listing.id}
                      onClick={() => void approve(listing.id)}
                    >
                      {t("approve")}
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={busyId === listing.id}
                      onClick={() => void reject(listing.id)}
                    >
                      {t("reject")}
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
