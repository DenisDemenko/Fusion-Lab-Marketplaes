"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Order } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { OrderStatusBadge } from "@/components/order-status-badge";

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersScreen />
    </RequireAuth>
  );
}

function uaLabel(label: string, locale: Locale) {
  return locale === "en" ? label.replace("грн", "UAH") : label;
}

function OrdersScreen() {
  const t = useTranslations("accountOrders");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Order[]>("/orders")
      .then(setOrders)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : tCommon("loadError")),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-red-700">{error}</p>;
  }

  if (!orders) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="section-title">{t("emptyTitle")}</h1>
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
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/account/orders/${order.number}`}
            className="card flex flex-wrap items-center justify-between gap-3 p-5 transition hover:shadow-md"
          >
            <div>
              <p className="font-medium text-[var(--foreground)]">{order.number}</p>
              <p className="text-sm text-[var(--muted)]">
                {t("createdItemsCount", {
                  date: formatDateTime(order.createdAt, locale),
                  count: order.items.length,
                })}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <OrderStatusBadge status={order.status} />
              <span className="font-semibold text-[var(--foreground)]">
                {uaLabel(order.totalLabel, locale)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
