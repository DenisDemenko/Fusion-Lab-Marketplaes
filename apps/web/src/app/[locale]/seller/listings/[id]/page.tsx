"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SellerListingDetail } from "@fusion-lab/shared-types";
import { Link } from "@/i18n/navigation";
import { RequireAuth } from "@/components/require-auth";
import {
  ListingFormFields,
  toPayload,
  valuesFromListing,
  type ListingFormValues,
} from "@/components/listing-form";
import { ListingMediaManager } from "@/components/listing-media-manager";
import { ApiError, api } from "@/lib/api-client";

export default function EditListingPage() {
  return (
    <RequireAuth>
      <EditListingScreen />
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

function EditListingScreen() {
  const t = useTranslations("sellerListingEdit");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("enums.listingStatus");
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [listing, setListing] = useState<SellerListingDetail | null>(null);
  const [values, setValues] = useState<ListingFormValues | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishProblems, setPublishProblems] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const current = await api.get<SellerListingDetail>(
        `/seller/listings/${params.id}`,
      );
      setListing(current);
      setValues(valuesFromListing(current));
    } catch (caught) {
      setLoadError(caught instanceof ApiError ? caught.message : t("loadFailed"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-red-700">{loadError}</p>
        <Link href="/seller/listings" className="btn-ghost mt-4">
          {t("backToListings")}
        </Link>
      </div>
    );
  }

  if (!listing || !values) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>
    );
  }

  const locked = listing.status === "pending_review";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!values) return;

    setBusy(true);
    setSaveError(null);

    try {
      const updated = await api.patch<SellerListingDetail>(
        `/seller/listings/${params.id}`,
        toPayload(values),
      );
      setListing(updated);
      setValues(valuesFromListing(updated));
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setSaveError(null);
    setPublishProblems(null);

    try {
      await action();
      await load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.problems) {
        setPublishProblems(caught.problems);
      } else {
        setSaveError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteListing() {
    if (!confirm(t("deleteConfirm"))) return;

    setBusy(true);
    try {
      await api.delete(`/seller/listings/${params.id}`);
      router.push("/seller/listings");
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : t("deleteFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/seller/listings" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          {t("backLink")}
        </Link>
        <span className={`badge ${STATUS_STYLE[listing.status] ?? "bg-[var(--neutral-bg)]"}`}>
          {tStatus(listing.status)}
        </span>
      </div>

      <h1 className="section-title mt-3">{listing.title}</h1>

      {listing.status === "rejected" && listing.rejectionReason ? (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("rejectionReasonLabel", { reason: listing.rejectionReason })}
        </p>
      ) : null}

      {locked ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {t("lockedNotice")}
        </p>
      ) : null}

      <form onSubmit={save} className="card mt-6 space-y-6 p-6">
        <fieldset disabled={locked || busy} className="space-y-6">
          <ListingFormFields values={values} onChange={setValues} />
        </fieldset>

        {saveError ? (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {saveError}
          </p>
        ) : null}

        {!locked ? (
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? t("saving") : t("saveChanges")}
          </button>
        ) : null}
      </form>

      <div className="card mt-6 p-6">
        <ListingMediaManager
          listingId={listing.id}
          cover={listing.cover}
          attachments={listing.attachments}
          onChange={() => void load()}
        />
      </div>

      {publishProblems ? (
        <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">{t("notReadyTitle")}</p>
          <ul className="mt-1.5 list-inside list-disc">
            {publishProblems.map((problem, index) => (
              <li key={index}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {listing.status === "draft" || listing.status === "rejected" ? (
          <button
            type="button"
            className="btn-accent"
            disabled={busy}
            onClick={() =>
              void runAction(() => api.post(`/seller/listings/${listing.id}/submit`))
            }
          >
            {t("submitForModeration")}
          </button>
        ) : null}

        {listing.status === "pending_review" || listing.status === "published" ? (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() =>
              void runAction(() => api.post(`/seller/listings/${listing.id}/withdraw`))
            }
          >
            {t("withdraw")}
          </button>
        ) : null}

        {listing.status !== "archived" ? (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() =>
              void runAction(() => api.post(`/seller/listings/${listing.id}/archive`))
            }
          >
            {t("archive")}
          </button>
        ) : null}

        {listing.status === "published" ? (
          <Link href={`/catalog/${listing.slug}`} className="btn-ghost" target="_blank">
            {t("viewInCatalog")}
          </Link>
        ) : null}

        <button
          type="button"
          className="btn-danger ml-auto"
          disabled={busy}
          onClick={() => void deleteListing()}
        >
          {tCommon("delete")}
        </button>
      </div>
    </div>
  );
}
