"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type {
  CheckoutPayment,
  LoyaltyHistory,
  Order,
  PromoCodePreview,
} from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link, useRouter } from "@/i18n/navigation";
import { RequireAuth } from "@/components/require-auth";
import { ApiError, api, mediaUrl } from "@/lib/api-client";
import { useCart } from "@/lib/cart-context";
import { formatUah } from "@/lib/format";

export default function CartPage() {
  return (
    <RequireAuth>
      <CartScreen />
    </RequireAuth>
  );
}

function uaLabel(label: string, locale: Locale) {
  return locale === "en" ? label.replace("грн", "UAH") : label;
}

function CartScreen() {
  const t = useTranslations("cartPage");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const { cart, loading, setQuantity, remove } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoCodePreview | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [pointsToSpend, setPointsToSpend] = useState(0);

  useEffect(() => {
    api
      .get<LoyaltyHistory>("/me/loyalty")
      .then((history) => setLoyaltyBalance(history.balance))
      .catch(() => setLoyaltyBalance(0));
  }, []);

  const subtotalMinor = cart?.subtotalMinor ?? 0;
  const promoDiscountMinor = appliedPromo?.discountMinor ?? 0;
  const afterPromoMinor = Math.max(0, subtotalMinor - promoDiscountMinor);
  const maxSpendablePoints = Math.min(loyaltyBalance, afterPromoMinor);
  const loyaltyDiscountMinor = Math.min(pointsToSpend, maxSpendablePoints);
  const totalMinor = Math.max(0, afterPromoMinor - loyaltyDiscountMinor);

  async function applyPromo() {
    if (!promoInput.trim()) return;

    setPromoBusy(true);
    setPromoError(null);
    try {
      const preview = await api.post<PromoCodePreview>(
        "/promo-codes/preview",
        { code: promoInput.trim(), subtotalMinor },
        { token: null },
      );
      setAppliedPromo(preview);
    } catch (caught) {
      setAppliedPromo(null);
      setPromoError(caught instanceof Error ? caught.message : t("promoNotFound"));
    } finally {
      setPromoBusy(false);
    }
  }

  async function checkout() {
    setBusy(true);
    setError(null);

    try {
      const response = await api.post<{ order: Order; payment: CheckoutPayment }>(
        "/orders/checkout",
        {
          promoCode: appliedPromo?.code,
          loyaltyPointsToSpend: pointsToSpend > 0 ? pointsToSpend : undefined,
        },
      );
      // The order page is where payment happens — including the return
      // from LiqPay — so there is exactly one screen that knows how to
      // show a payment state.
      router.push(`/account/orders/${response.order.number}`);
    } catch (caught) {
      // A promo code that got exhausted or expired between the preview and
      // the click is a real (if rare) race — surfaced plainly instead of a
      // generic "checkout failed", since the fix (drop the code, retry) is
      // different from every other checkout error.
      if (caught instanceof ApiError && caught.status !== 500) {
        setError(caught.message);
      } else {
        setError(caught instanceof Error ? caught.message : t("checkoutFailed"));
      }
      setBusy(false);
    }
  }

  if (loading && !cart) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-zinc-500">{tCommon("loading")}</p>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="section-title">{t("emptyTitle")}</h1>
        <p className="mt-2 text-zinc-500">{t("emptyBody")}</p>
        <Link href="/catalog" className="btn-primary mt-6">
          {tCommon("toCatalog")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="section-title">{t("title")}</h1>

      <div className="mt-6 space-y-3">
        {cart.items.map((item) => {
          const cover = mediaUrl(item.listing.coverUrl);
          const isProduct = item.listing.kind === "product";

          return (
            <div key={item.id} className="card flex gap-4 p-4">
              <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>

              <div className="flex flex-1 flex-col">
                <Link
                  href={`/catalog/${item.listing.slug}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {item.listing.title}
                </Link>
                <p className="text-sm text-zinc-500">
                  {uaLabel(item.listing.priceLabel, locale)}
                </p>

                <div className="mt-auto flex items-center gap-3 pt-2">
                  {isProduct ? (
                    <label className="flex items-center gap-2 text-sm text-zinc-600">
                      {t("quantityLabel")}
                      <input
                        type="number"
                        min={1}
                        max={item.listing.stock ?? undefined}
                        value={item.quantity}
                        onChange={(event) =>
                          void setQuantity(
                            item.listing.id,
                            Number(event.target.value),
                          )
                        }
                        className="w-20 rounded-lg border border-[var(--line)] px-2 py-1"
                      />
                    </label>
                  ) : (
                    <span className="text-sm text-zinc-500">{t("digitalAccess")}</span>
                  )}

                  <button
                    type="button"
                    className="text-sm text-red-700 hover:underline"
                    onClick={() => void remove(item.listing.id)}
                  >
                    {t("remove")}
                  </button>
                </div>
              </div>

              <p className="shrink-0 font-semibold text-zinc-900">
                {formatUah(item.lineTotalMinor, locale)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="card mt-6 space-y-4 p-5">
        <div>
          <p className="label">{t("promoLabel")}</p>
          {appliedPromo ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
              <span className="text-sm text-emerald-800">
                {t("promoApplied", {
                  code: appliedPromo.code,
                  amount: formatUah(appliedPromo.discountMinor, locale),
                })}
              </span>
              <button
                type="button"
                className="text-sm text-emerald-700 hover:underline"
                onClick={() => {
                  setAppliedPromo(null);
                  setPromoInput("");
                }}
              >
                {t("remove")}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                className="input"
                placeholder={t("promoPlaceholder")}
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value)}
              />
              <button
                type="button"
                className="btn-ghost shrink-0"
                disabled={promoBusy || !promoInput.trim()}
                onClick={() => void applyPromo()}
              >
                {promoBusy ? t("applying") : t("apply")}
              </button>
            </div>
          )}
          {promoError ? (
            <p className="mt-1.5 text-sm text-red-700">{promoError}</p>
          ) : null}
        </div>

        {loyaltyBalance > 0 ? (
          <div>
            <div className="flex items-center justify-between">
              <p className="label mb-0">
                {t("spendPoints", { balance: loyaltyBalance })}
              </p>
              <span className="text-sm text-zinc-500">
                −{formatUah(loyaltyDiscountMinor, locale)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={maxSpendablePoints}
              step={100}
              value={Math.min(pointsToSpend, maxSpendablePoints)}
              onChange={(event) => setPointsToSpend(Number(event.target.value))}
              className="mt-2 w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-zinc-400">
              <span>0</span>
              <span>{maxSpendablePoints}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card mt-6 space-y-2 p-5">
        <div className="flex items-center justify-between text-sm text-zinc-600">
          <span>{t("subtotal")}</span>
          <span>{formatUah(subtotalMinor, locale)}</span>
        </div>
        {promoDiscountMinor > 0 ? (
          <div className="flex items-center justify-between text-sm text-emerald-700">
            <span>{t("promoDiscount")}</span>
            <span>−{formatUah(promoDiscountMinor, locale)}</span>
          </div>
        ) : null}
        {loyaltyDiscountMinor > 0 ? (
          <div className="flex items-center justify-between text-sm text-emerald-700">
            <span>{t("loyaltyDiscount")}</span>
            <span>−{formatUah(loyaltyDiscountMinor, locale)}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-4">
          <div>
            <p className="text-sm text-zinc-500">{t("toPay")}</p>
            <p className="text-2xl font-semibold text-zinc-900">
              {formatUah(totalMinor, locale)}
            </p>
          </div>

          <button
            type="button"
            className="btn-accent"
            onClick={() => void checkout()}
            disabled={busy}
            data-testid="checkout"
          >
            {busy ? t("checkingOut") : t("checkout")}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
