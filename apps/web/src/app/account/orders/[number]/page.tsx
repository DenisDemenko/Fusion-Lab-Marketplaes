"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { CheckoutPayment, Order } from "@fusion-lab/shared-types";
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

function OrderScreen() {
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
      setError(
        caught instanceof Error ? caught.message : "Замовлення не знайдено",
      );
    }
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
        <p className="text-red-700">{error}</p>
        <Link href="/account/orders" className="btn-ghost mt-4">
          До списку замовлень
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-zinc-500">Завантаження…</p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/account/orders" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Усі замовлення
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">Замовлення {order.number}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Створено {formatDateTime(order.createdAt)}
        {order.paidAt ? ` · оплачено ${formatDateTime(order.paidAt)}` : ""}
      </p>

      <div className="card mt-6 divide-y divide-[var(--line)]">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <Link
                href={`/catalog/${item.listingSlug}`}
                className="font-medium text-zinc-900 hover:underline"
              >
                {item.title}
              </Link>
              <p className="text-sm text-zinc-500">
                {item.quantity} × {formatUah(item.unitPriceMinor)}
              </p>
            </div>
            <p className="font-semibold">{formatUah(item.lineTotalMinor)}</p>
          </div>
        ))}

        <div className="flex items-center justify-between p-4">
          <span className="font-medium text-zinc-700">Разом</span>
          <span className="text-xl font-semibold">{order.totalLabel}</span>
        </div>
      </div>

      {order.status === "paid" ? (
        <div className="card mt-6 p-5">
          <p className="font-medium text-emerald-700">Оплачено</p>
          <p className="mt-1 text-sm text-zinc-600">
            Матеріали доступні в розділі «Мої матеріали».
          </p>
          <Link href="/account/library" className="btn-primary mt-4">
            Перейти до матеріалів
          </Link>
        </div>
      ) : order.status === "pending" ? (
        <div className="card mt-6 space-y-4 p-5">
          <p className="font-medium text-zinc-900">Оплата</p>

          {payment?.configured ? (
            // LiqPay takes a form POST, not a redirect: the signed payload
            // has to travel in the body. Submitting a real form is exactly
            // what their documentation prescribes.
            <form method="POST" action={payment.actionUrl} acceptCharset="utf-8">
              <input type="hidden" name="data" value={payment.data} />
              <input type="hidden" name="signature" value={payment.signature} />
              <button type="submit" className="btn-accent w-full">
                Сплатити {order.totalLabel} через LiqPay
              </button>
            </form>
          ) : (
            <>
              <p className="text-sm text-zinc-600">
                Платіжний шлюз у цьому середовищі не налаштований, тож
                доступна демонстраційна оплата — вона позначає замовлення
                оплаченим і відкриває матеріали.
              </p>
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
                        : "Не вдалося підтвердити оплату",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Підтверджую…" : "Підтвердити оплату (демо)"}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="card mt-6 p-5">
          <p className="font-medium text-red-700">Оплата не пройшла</p>
          <p className="mt-1 text-sm text-zinc-600">
            Позиції повернуто в наявність. Спробуйте оформити замовлення ще раз.
          </p>
          <Link href="/catalog" className="btn-ghost mt-4">
            До каталогу
          </Link>
        </div>
      )}
    </div>
  );
}
