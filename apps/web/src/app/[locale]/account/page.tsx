"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountScreen />
    </RequireAuth>
  );
}

function AccountScreen() {
  const t = useTranslations("accountHome");
  const { profile } = useAuth();

  const cards = [
    {
      href: "/account/library",
      title: t("libraryTitle"),
      body: t("libraryBody"),
    },
    {
      href: "/account/orders",
      title: t("ordersTitle"),
      body: t("ordersBody"),
    },
    {
      href: "/seller",
      title:
        profile?.seller?.status === "approved"
          ? t("sellerCabinetTitle")
          : t("becomeSellerTitle"),
      body:
        profile?.seller?.status === "approved"
          ? t("sellerCabinetBody")
          : t("becomeSellerBody"),
    },
  ];

  if (profile?.role === "admin") {
    cards.push({
      href: "/admin",
      title: t("adminTitle"),
      body: t("adminBody"),
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="section-title">{t("title")}</h1>
      <p className="mt-1 text-[var(--muted)]">
        {profile?.email}
        <span className="mx-2 text-[var(--muted)]">·</span>
        {t("roleLabel", { role: profile?.role ?? "—" })}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="card p-5 transition hover:shadow-md"
          >
            <p className="font-semibold text-[var(--foreground)]">{card.title}</p>
            <p className="mt-1.5 text-sm text-[var(--muted)]">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
