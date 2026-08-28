"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SellerListingDetail } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import {
  ListingFormFields,
  toPayload,
  valuesFromListing,
  type ListingFormValues,
} from "@/components/listing-form";
import { ListingMediaManager } from "@/components/listing-media-manager";
import { ApiError, api } from "@/lib/api-client";
import { STATUS_LABELS } from "@/lib/format";

export default function EditListingPage() {
  return (
    <RequireAuth>
      <EditListingScreen />
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

function EditListingScreen() {
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
      setLoadError(
        caught instanceof ApiError
          ? caught.message
          : "Не вдалося завантажити лістинг",
      );
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-red-700">{loadError}</p>
        <Link href="/seller/listings" className="btn-ghost mt-4">
          До списку лістингів
        </Link>
      </div>
    );
  }

  if (!listing || !values) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-zinc-500">Завантаження…</p>
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
      setSaveError(
        caught instanceof Error ? caught.message : "Не вдалося зберегти зміни",
      );
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
        setSaveError(
          caught instanceof Error ? caught.message : "Дія не виконалась",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteListing() {
    if (!confirm("Видалити цей лістинг незворотно?")) return;

    setBusy(true);
    try {
      await api.delete(`/seller/listings/${params.id}`);
      router.push("/seller/listings");
    } catch (caught) {
      setSaveError(
        caught instanceof Error ? caught.message : "Не вдалося видалити лістинг",
      );
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/seller/listings" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Мої лістинги
        </Link>
        <span className={`badge ${STATUS_STYLE[listing.status] ?? "bg-zinc-100"}`}>
          {STATUS_LABELS[listing.status] ?? listing.status}
        </span>
      </div>

      <h1 className="section-title mt-3">{listing.title}</h1>

      {listing.status === "rejected" && listing.rejectionReason ? (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Причина відхилення: {listing.rejectionReason}
        </p>
      ) : null}

      {locked ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Лістинг на модерації — редагування заблоковане. Відкличте його,
          щоб внести зміни.
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
            {busy ? "Зберігаю…" : "Зберегти зміни"}
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
          <p className="font-medium">Лістинг не готовий до публікації:</p>
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
            Надіслати на модерацію
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
            Зняти з публікації
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
            Архівувати
          </button>
        ) : null}

        {listing.status === "published" ? (
          <Link href={`/catalog/${listing.slug}`} className="btn-ghost" target="_blank">
            Переглянути в каталозі
          </Link>
        ) : null}

        <button
          type="button"
          className="btn-danger ml-auto"
          disabled={busy}
          onClick={() => void deleteListing()}
        >
          Видалити
        </button>
      </div>
    </div>
  );
}
