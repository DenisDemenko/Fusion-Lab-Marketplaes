"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Cart } from "@fusion-lab/shared-types";
import { api } from "./api-client";
import { useAuth } from "./auth-context";

interface CartState {
  cart: Cart | null;
  loading: boolean;
  add: (listingId: string, quantity?: number) => Promise<void>;
  setQuantity: (listingId: string, quantity: number) => Promise<void>;
  remove: (listingId: string) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartState | null>(null);

// The cart lives on the server (one row per user), so this context is a
// cache of it, not the source of truth. Every mutation replaces the whole
// cart with what the API returned rather than patching local state, which
// keeps the badge, the totals and the stock limits from drifting apart.
export function CartProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!firebaseUser) {
      setCart(null);
      return;
    }

    setLoading(true);
    try {
      setCart(await api.get<Cart>("/cart"));
    } catch {
      // A transient failure here (expired token, network blip) must not
      // crash the app over background cart sync — the badge just stays
      // at its last known value until the next successful refresh.
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<CartState>(
    () => ({
      cart,
      loading,
      add: async (listingId, quantity = 1) => {
        setCart(await api.post<Cart>("/cart/items", { listingId, quantity }));
      },
      setQuantity: async (listingId, quantity) => {
        setCart(
          await api.patch<Cart>(`/cart/items/${listingId}`, { quantity }),
        );
      },
      remove: async (listingId) => {
        setCart(await api.delete<Cart>(`/cart/items/${listingId}`));
      },
      clear: async () => {
        setCart(await api.delete<Cart>("/cart"));
      },
      refresh,
    }),
    [cart, loading, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return context;
}
