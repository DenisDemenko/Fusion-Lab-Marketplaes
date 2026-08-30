"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ListingDetail } from "@fusion-lab/shared-types";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";

export function AddToCart({ listing }: { listing: ListingDetail }) {
  const t = useTranslations("addToCart");
  const { firebaseUser, loading } = useAuth();
  const { cart, add } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owned, setOwned] = useState(false);

  const inCart = cart?.items.some((item) => item.listing.id === listing.id);
  const soldOut = listing.stock !== null && listing.stock <= 0;

  async function handleAdd() {
    setBusy(true);
    setError(null);

    try {
      await add(listing.id);
    } catch (caught) {
      // 409 from the cart means one specific thing: this account already
      // owns the listing. Saying so — and linking to where the files are —
      // is more useful than repeating the raw message.
      if (caught instanceof ApiError && caught.status === 409) {
        setOwned(true);
      } else {
        setError(caught instanceof Error ? caught.message : t("addFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  if (owned) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--success)]">{t("alreadyOwned")}</p>
        <Link href="/account/library" className="btn-primary w-full">
          {t("openLibrary")}
        </Link>
      </div>
    );
  }

  if (!loading && !firebaseUser) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/catalog/${listing.slug}`)}`}
        className="btn-primary w-full"
      >
        {t("signInToBuy")}
      </Link>
    );
  }

  if (soldOut) {
    return (
      <button type="button" className="btn-ghost w-full" disabled>
        {t("soldOut")}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {inCart ? (
        <button
          type="button"
          className="btn-accent w-full"
          onClick={() => router.push("/cart")}
        >
          {t("alreadyInCart")}
        </button>
      ) : (
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => void handleAdd()}
          disabled={busy || loading}
          data-testid="add-to-cart"
        >
          {busy ? t("adding") : t("addToCart")}
        </button>
      )}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
