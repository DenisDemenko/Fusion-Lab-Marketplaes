"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { OrderStatus } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { RequireAuth } from "@/components/require-auth";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

interface AdminOrderRow {
  id: string;
  number: string;
  status: OrderStatus;
  buyerEmail: string;
  totalLabel: string;
  itemCount: number;
  payment: { provider: string; status: string } | null;
  createdAt: string;
  paidAt: string | null;
}

function uaLabel(label: string, locale: Locale) {
  return locale === "en" ? label.replace("грн", "UAH") : label;
}

export default function AdminOrdersPage() {
  return (
    <RequireAuth role="admin">
      <OrdersScreen />
    </RequireAuth>
  );
}

function OrdersScreen() {
  const t = useTranslations("adminOrders");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;

  const TABS: { value: OrderStatus | ""; label: string }[] = [
    { value: "", label: t("tabAll") },
    { value: "pending", label: t("tabPending") },
    { value: "paid", label: t("tabPaid") },
    { value: "failed", label: t("tabFailed") },
  ];

  const [status, setStatus] = useState<OrderStatus | "">("");
  const [orders, setOrders] = useState<AdminOrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = status ? `?status=${status}` : "";
    api
      .get<AdminOrderRow[]>(`/admin/orders${query}`)
      .then(setOrders)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : tCommon("loadError")),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                : "border-[var(--line)] bg-white text-[var(--foreground)] hover:bg-[var(--neutral-bg)]"
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

      {!orders ? (
        <p className="mt-6 text-[var(--muted)]">{tCommon("loading")}</p>
      ) : orders.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-[var(--muted)]">{t("empty")}</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">{t("colNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("colBuyer")}</th>
                <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("colPayment")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("colTotal")}</th>
                <th className="px-4 py-3 font-medium">{t("colCreated")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    {order.number}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{order.buyerEmail}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {order.payment
                      ? `${order.payment.provider} · ${order.payment.status}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {uaLabel(order.totalLabel, locale)}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDateTime(order.createdAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
