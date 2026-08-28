"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { NotificationsBell } from "./notifications-bell";

export function SiteHeader() {
  const { profile, firebaseUser, signOut, loading } = useAuth();
  const { cart } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [menuOpen, setMenuOpen] = useState(false);

  const isSeller = profile?.seller?.status === "approved";
  const isAdmin = profile?.role === "admin";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 whitespace-nowrap">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-900 text-sm font-bold text-white">
            FL
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:block">
            Fusion&nbsp;Lab
          </span>
        </Link>

        <form
          className="flex flex-1 items-center"
          onSubmit={(event) => {
            event.preventDefault();
            router.push(query.trim() ? `/catalog?q=${encodeURIComponent(query.trim())}` : "/catalog");
          }}
        >
          <input
            type="search"
            name="q"
            aria-label="Пошук у каталозі"
            placeholder="Пошук курсів, книг і виробів"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>

        <nav className="flex items-center gap-1">
          <Link
            href="/catalog"
            className="hidden rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 md:block"
          >
            Каталог
          </Link>

          <Link
            href="/cart"
            className="relative rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            aria-label="Кошик"
          >
            Кошик
            {cart && cart.count > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-semibold text-white">
                {cart.count}
              </span>
            ) : null}
          </Link>

          {firebaseUser ? <NotificationsBell /> : null}

          {loading ? (
            <span className="px-3 py-2 text-sm text-zinc-400">…</span>
          ) : firebaseUser ? (
            <div className="relative">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                {profile?.displayName || profile?.email?.split("@")[0] || "Акаунт"}
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="card absolute right-0 mt-2 w-56 overflow-hidden p-1 shadow-lg"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <MenuLink href="/account" onClick={() => setMenuOpen(false)}>
                    Мій кабінет
                  </MenuLink>
                  <MenuLink href="/account/library" onClick={() => setMenuOpen(false)}>
                    Мої матеріали
                  </MenuLink>
                  <MenuLink href="/account/orders" onClick={() => setMenuOpen(false)}>
                    Замовлення
                  </MenuLink>
                  <MenuLink href="/seller" onClick={() => setMenuOpen(false)}>
                    {isSeller ? "Кабінет продавця" : "Стати продавцем"}
                  </MenuLink>
                  {isAdmin ? (
                    <MenuLink href="/admin" onClick={() => setMenuOpen(false)}>
                      Адмінпанель
                    </MenuLink>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                      router.push("/");
                    }}
                  >
                    Вийти
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link href="/login" className="btn-primary">
              Увійти
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function MenuLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="block rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
    >
      {children}
    </Link>
  );
}
