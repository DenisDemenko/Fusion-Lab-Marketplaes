"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { CheckoutPayment, Order } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { api } from "@/lib/api-client";
import { formatDateTime, formatUah } from "@/lib/format";
import { useCart } from "@/lib/cart-context";

export default function OrderPage() {
  return (
    <RequireAuth>
      <OrderScreen />
    </RequireAuth>
  );
}

function uaLabel(label: string, locale: Locale) {
  return locale === "en" ? label.replace("грн", "UAH") : label;
}

function OrderScreen() {
  const t = useTranslations("accountOrderDetail");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const params = useParams<{ number: string }>();
  const number = params.number;
  const { refresh: refreshCart } = useCart();

  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<CheckoutPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get<{ order: Order; payment: CheckoutPayment }>(
        `/orders/${number}`,
      );
      setOrder(response.order);
      setPayment(response.payment);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("notFound"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number]);

  useEffect(() => {
    void load();
    // The cart was emptied server-side by checkout; this pulls the badge
    // back in line after the redirect.
    void refreshCart();
  }, [load, refreshCart]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-[var(--danger)]">{error}</p>
        <Link href="/account/orders" className="btn-ghost mt-4">
          {t("backToOrders")}
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/account/orders" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        {t("backToOrders")}
      </Link>

      {/* The status is what the reader came to check, so it sits in the
          header's action slot rather than below the dates. */}
      <PageHeader
        title={t("orderTitle", { number: order.number })}
        description={
          t("createdAt", { date: formatDateTime(order.createdAt, locale) }) +
          (order.paidAt
            ? ` · ${t("paidAt", { date: formatDateTime(order.paidAt, locale) })}`
            : "")
        }
        actions={<OrderStatusBadge status={order.status} />}
      />

      <div className="card mt-6 divide-y divide-[var(--line)]">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <Link
                href={`/catalog/${item.listingSlug}`}
                className="font-medium text-[var(--foreground)] hover:underline"
              >
                {item.title}
              </Link>
              <p className="text-sm text-[var(--muted)]">
                {t("itemQuantityPrice", {
                  quantity: item.quantity,
                  price: formatUah(item.unitPriceMinor, locale),
                })}
              </p>
            </div>
            <p className="font-semibold">{formatUah(item.lineTotalMinor, locale)}</p>
          </div>
        ))}

        <div className="space-y-1.5 p-4">
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>{t("subtotal")}</span>
            <span>{formatUah(order.subtotalMinor, locale)}</span>
          </div>
          {order.promoDiscountMinor > 0 ? (
            <div className="flex items-center justify-between text-sm text-[var(--success)]">
              <span>{t("promoCodeLabel", { code: order.promoCode ?? "" })}</span>
              <span>−{formatUah(order.promoDiscountMinor, locale)}</span>
            </div>
          ) : null}
          {order.loyaltyDiscountMinor > 0 ? (
            <div className="flex items-center justify-between text-sm text-[var(--success)]">
              <span>{t("loyaltyPaidLabel", { points: order.loyaltyPointsSpent })}</span>
              <span>−{formatUah(order.loyaltyDiscountMinor, locale)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-[var(--line)] pt-2">
            <span className="font-medium text-[var(--foreground)]">{t("total")}</span>
            <span className="text-xl font-semibold">
              {uaLabel(order.totalLabel, locale)}
            </span>
          </div>
        </div>
      </div>

      {order.status === "paid" ? (
        <div className="card mt-6 p-5">
          <p className="font-medium text-[var(--success)]">{t("paidStatus")}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("paidBody")}</p>
          <Link href="/account/library" className="btn-primary mt-4">
            {t("goToLibrary")}
          </Link>
        </div>
      ) : order.status === "pending" ? (
        <div className="card mt-6 space-y-4 p-5">
          <p className="font-medium text-[var(--foreground)]">{t("paymentTitle")}</p>

          {payment?.configured ? (
            // LiqPay takes a form POST, not a redirect: the signed payload
            // has to travel in the body. Submitting a real form is exactly
            // what their documentation prescribes.
            <form method="POST" action={payment.actionUrl} acceptCharset="utf-8">
              <input type="hidden" name="data" value={payment.data} />
              <input type="hidden" name="signature" value={payment.signature} />
              <button type="submit" className="btn-accent w-full">
                {t("payWithLiqpay", { total: uaLabel(order.totalLabel, locale) })}
              </button>
            </form>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)]">{t("gatewayNotConfigured")}</p>
              <button
                type="button"
                className="btn-accent w-full"
                disabled={busy}
                data-testid="demo-pay"
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await api.post("/payments/dev/confirm", {
                      orderNumber: order.number,
                    });
                    await load();
                  } catch (caught) {
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : t("confirmPaymentFailed"),
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? t("confirmingDemoPayment") : t("confirmDemoPayment")}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="card mt-6 p-5">
          <p className="font-medium text-[var(--danger)]">{t("failedStatus")}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("failedBody")}</p>
          <Link href="/catalog" className="btn-ghost mt-4">
            {tCommon("toCatalog")}
          </Link>
        </div>
      )}
    </div>
  );
}
