"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Order } from "@fusion-lab/shared-types";
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

function OrdersScreen() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Order[]>("/orders")
      .then(setOrders)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Помилка завантаження"),
      );
  }, []);

  if (error) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-red-700">{error}</p>;
  }

  if (!orders) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-zinc-500">Завантаження…</p>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="section-title">Замовлень ще немає</h1>
        <Link href="/catalog" className="btn-primary mt-6">
          До каталогу
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="section-title">Мої замовлення</h1>

      <div className="mt-6 space-y-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/account/orders/${order.number}`}
            className="card flex flex-wrap items-center justify-between gap-3 p-5 transition hover:shadow-md"
          >
            <div>
              <p className="font-medium text-zinc-900">{order.number}</p>
              <p className="text-sm text-zinc-500">
                {formatDateTime(order.createdAt)} · позицій: {order.items.length}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <OrderStatusBadge status={order.status} />
              <span className="font-semibold text-zinc-900">
                {order.totalLabel}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
