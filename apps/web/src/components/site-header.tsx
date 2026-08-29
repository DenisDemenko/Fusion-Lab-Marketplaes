"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { NotificationsBell } from "./notifications-bell";
import { LocaleSwitcher } from "./locale-switcher";

export function SiteHeader() {
  const t = useTranslations("nav");
  const { profile, firebaseUser, signOut, loading } = useAuth();
  const { cart } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [menuOpen, setMenuOpen] = useState(false);

  // Firebase's auth SDK can resolve a cached session before React finishes
  // its very first client commit, so the account/login branch below is
  // gated behind a mount flag: the server and the client's first paint
  // both render the same neutral placeholder no matter what Firebase
  // already knows, and the real state swaps in a tick later — the only
  // way to guarantee hydration can't ever compare two different things.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
            router.push(
              query.trim()
                ? `/catalog?q=${encodeURIComponent(query.trim())}`
                : "/catalog",
            );
          }}
        >
          <input
            type="search"
            name="q"
            aria-label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
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
            {t("catalog")}
          </Link>

          <Link
            href="/cart"
            className="relative rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            aria-label={t("cart")}
          >
            {t("cart")}
            {cart && cart.count > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-semibold text-white">
                {cart.count}
              </span>
            ) : null}
          </Link>

          {mounted && firebaseUser ? <NotificationsBell /> : null}

          <LocaleSwitcher />

          {!mounted || loading ? (
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
                {profile?.displayName || profile?.email?.split("@")[0] || t("account")}
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="card absolute right-0 mt-2 w-56 overflow-hidden p-1 shadow-lg"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <MenuLink href="/account" onClick={() => setMenuOpen(false)}>
                    {t("myAccount")}
                  </MenuLink>
                  <MenuLink href="/account/library" onClick={() => setMenuOpen(false)}>
                    {t("myMaterials")}
                  </MenuLink>
                  <MenuLink href="/account/orders" onClick={() => setMenuOpen(false)}>
                    {t("orders")}
                  </MenuLink>
                  <MenuLink href="/account/loyalty" onClick={() => setMenuOpen(false)}>
                    {t("loyalty")}
                  </MenuLink>
                  <MenuLink href="/account/referrals" onClick={() => setMenuOpen(false)}>
                    {t("referrals")}
                  </MenuLink>
                  <MenuLink href="/chat" onClick={() => setMenuOpen(false)}>
                    {t("messages")}
                  </MenuLink>
                  <MenuLink href="/seller" onClick={() => setMenuOpen(false)}>
                    {isSeller ? t("sellerCabinet") : t("becomeSeller")}
                  </MenuLink>
                  {isAdmin ? (
                    <MenuLink href="/admin" onClick={() => setMenuOpen(false)}>
                      {t("adminPanel")}
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
                    {t("signOut")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link href="/login" className="btn-primary">
              {t("signIn")}
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
