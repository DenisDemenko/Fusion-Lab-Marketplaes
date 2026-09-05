"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ListingCard, ListingStatus } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
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

// The moderation status is the entire point of this row — a queue admin
// scans top to bottom for what needs a decision. One neutral grey badge
// for every status made "published" and "rejected" look the same at a
// glance; these mirror the state tokens B1 already defined.
const STATUS_STYLES: Record<ListingStatus, string> = {
  draft: "bg-[var(--neutral-bg)] text-[var(--muted)]",
  pending_review: "bg-[var(--warning-soft)] text-[var(--warning)]",
  published: "bg-[var(--success-soft)] text-[var(--success)]",
  rejected: "bg-[var(--danger-soft)] text-[var(--danger)]",
  archived: "bg-[var(--neutral-bg)] text-[var(--muted)]",
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
      <PageHeader title={t("title")} />

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value || "all"}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              status === tab.value
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--neutral-bg)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {!listings ? (
        <p className="mt-6 text-[var(--muted)]">{tCommon("loading")}</p>
      ) : listings.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-[var(--muted)]">{t("empty")}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {listings.map((listing) => (
            <div key={listing.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{listing.title}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {tKind(listing.kind)} · {uaLabel(listing.priceLabel, locale)} ·{" "}
                    {t("sellerLabel", { name: listing.seller?.displayName ?? "—" })}
                  </p>
                  {listing.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
                      {listing.description}
                    </p>
                  ) : null}
                  {listing.rejectionReason ? (
                    <p className="mt-2 text-sm text-[var(--danger)]">
                      {t("rejectionReasonLabel", { reason: listing.rejectionReason })}
                    </p>
                  ) : null}
                </div>

                <span className={`badge ${STATUS_STYLES[listing.status]}`}>
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
