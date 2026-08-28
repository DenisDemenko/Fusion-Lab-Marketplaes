"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CheckoutPayment, Order } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { api, mediaUrl } from "@/lib/api-client";
import { useCart } from "@/lib/cart-context";
import { formatUah } from "@/lib/format";

export default function CartPage() {
  return (
    <RequireAuth>
      <CartScreen />
    </RequireAuth>
  );
}

function CartScreen() {
  const { cart, loading, setQuantity, remove } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setBusy(true);
    setError(null);

    try {
      const response = await api.post<{ order: Order; payment: CheckoutPayment }>(
        "/orders/checkout",
      );
      // The order page is where payment happens — including the return
      // from LiqPay — so there is exactly one screen that knows how to
      // show a payment state.
      router.push(`/account/orders/${response.order.number}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не вдалося оформити замовлення",
      );
      setBusy(false);
    }
  }

  if (loading && !cart) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-zinc-500">Завантаження…</p>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="section-title">Кошик порожній</h1>
        <p className="mt-2 text-zinc-500">
          Оберіть курс, книгу або виріб у каталозі.
        </p>
        <Link href="/catalog" className="btn-primary mt-6">
          До каталогу
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="section-title">Кошик</h1>

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
                <p className="text-sm text-zinc-500">{item.listing.priceLabel}</p>

                <div className="mt-auto flex items-center gap-3 pt-2">
                  {isProduct ? (
                    <label className="flex items-center gap-2 text-sm text-zinc-600">
                      Кількість
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
                    <span className="text-sm text-zinc-500">
                      Цифровий доступ — 1 шт.
                    </span>
                  )}

                  <button
                    type="button"
                    className="text-sm text-red-700 hover:underline"
                    onClick={() => void remove(item.listing.id)}
                  >
                    Прибрати
                  </button>
                </div>
              </div>

              <p className="shrink-0 font-semibold text-zinc-900">
                {formatUah(item.lineTotalMinor)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-zinc-500">До сплати</p>
          <p className="text-2xl font-semibold text-zinc-900">{cart.totalLabel}</p>
        </div>

        <button
          type="button"
          className="btn-accent"
          onClick={() => void checkout()}
          disabled={busy}
          data-testid="checkout"
        >
          {busy ? "Оформлюю…" : "Оформити замовлення"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
