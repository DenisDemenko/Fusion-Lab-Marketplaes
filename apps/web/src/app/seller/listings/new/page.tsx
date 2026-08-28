"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SellerListingDetail } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import {
  ListingFormFields,
  emptyValues,
  toPayload,
  type ListingFormValues,
} from "@/components/listing-form";
import { api } from "@/lib/api-client";

export default function NewListingPage() {
  return (
    <RequireAuth>
      <NewListingScreen />
    </RequireAuth>
  );
}

function NewListingScreen() {
  const router = useRouter();
  const [values, setValues] = useState<ListingFormValues>(emptyValues());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const created = await api.post<SellerListingDetail>(
        "/seller/listings",
        toPayload(values),
      );
      // The editor is where covers and files get attached — a listing
      // cannot be usefully "created" without that next step, so the
      // redirect goes straight there instead of back to the list.
      router.push(`/seller/listings/${created.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не вдалося створити лістинг",
      );
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="section-title">Новий лістинг</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Створіть чернетку, потім додайте обкладинку й файли перед публікацією.
      </p>

      <form onSubmit={submit} className="card mt-6 space-y-6 p-6">
        <ListingFormFields values={values} onChange={setValues} />

        {error ? (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Створюю…" : "Створити чернетку"}
        </button>
      </form>
    </div>
  );
}
