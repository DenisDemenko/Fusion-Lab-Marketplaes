"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { SellerSale } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
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
  const t = useTranslations("sellerOrders");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [sales, setSales] = useState<SellerSale[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<SellerSale[]>("/seller/orders")
      .then(setSales)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : tCommon("loadError")),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="mx-auto max-w-4xl px-4 py-16 text-red-700">{error}</p>;
  }

  if (!sales) {
    return (
      <p className="mx-auto max-w-4xl px-4 py-16 text-zinc-500">{tCommon("loading")}</p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="section-title">{t("title")}</h1>

      {sales.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-zinc-500">{t("empty")}</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">{t("colOrder")}</th>
                <th className="px-4 py-3 font-medium">{t("colItem")}</th>
                <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("colAmount")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("colCommission")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("colPayout")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{sale.orderNumber}</p>
                    <p className="text-xs text-zinc-500">
                      {formatDateTime(sale.placedAt, locale)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/catalog/${sale.listingSlug}`}
                      className="hover:underline"
                    >
                      {sale.title}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {t("quantitySuffix", { count: sale.quantity })}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={sale.orderStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatUah(sale.unitPriceMinor * sale.quantity, locale)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500">
                    {formatUah(sale.commissionMinor, locale)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatUah(sale.payoutMinor, locale)}
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
