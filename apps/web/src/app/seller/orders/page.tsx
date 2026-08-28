"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SellerSale } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { api } from "@/lib/api-client";
import { formatDateTime, formatUah } from "@/lib/format";

export default function SellerOrdersPage() {
  return (
    <RequireAuth>
      <SellerOrdersScreen />
    </RequireAuth>
  );
}

function SellerOrdersScreen() {
  const [sales, setSales] = useState<SellerSale[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<SellerSale[]>("/seller/orders")
      .then(setSales)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Помилка завантаження"),
      );
  }, []);

  if (error) {
    return <p className="mx-auto max-w-4xl px-4 py-16 text-red-700">{error}</p>;
  }

  if (!sales) {
    return (
      <p className="mx-auto max-w-4xl px-4 py-16 text-zinc-500">Завантаження…</p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="section-title">Продажі</h1>

      {sales.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-zinc-500">
          Продажів поки немає.
        </p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">Замовлення</th>
                <th className="px-4 py-3 font-medium">Позиція</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 text-right font-medium">Сума</th>
                <th className="px-4 py-3 text-right font-medium">Комісія</th>
                <th className="px-4 py-3 text-right font-medium">До виплати</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{sale.orderNumber}</p>
                    <p className="text-xs text-zinc-500">
                      {formatDateTime(sale.placedAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/catalog/${sale.listingSlug}`}
                      className="hover:underline"
                    >
                      {sale.title}
                    </Link>
                    <p className="text-xs text-zinc-500">×{sale.quantity}</p>
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={sale.orderStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatUah(sale.unitPriceMinor * sale.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500">
                    {formatUah(sale.commissionMinor)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatUah(sale.payoutMinor)}
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
