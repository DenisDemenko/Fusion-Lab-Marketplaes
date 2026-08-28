"use client";

import Link from "next/link";
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
  const { profile } = useAuth();

  const cards = [
    {
      href: "/account/library",
      title: "Мої матеріали",
      body: "Курси, книги та файли, до яких відкрито доступ після оплати.",
    },
    {
      href: "/account/orders",
      title: "Замовлення",
      body: "Історія покупок і оплата тих замовлень, що ще очікують.",
    },
    {
      href: "/seller",
      title:
        profile?.seller?.status === "approved"
          ? "Кабінет продавця"
          : "Стати продавцем",
      body:
        profile?.seller?.status === "approved"
          ? "Лістинги, завантаження матеріалів, публікація та продажі."
          : "Подайте заявку, щоб продавати власні курси та вироби.",
    },
  ];

  if (profile?.role === "admin") {
    cards.push({
      href: "/admin",
      title: "Адмінпанель",
      body: "Модерація лістингів, заявки продавців, користувачі, замовлення.",
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="section-title">Кабінет</h1>
      <p className="mt-1 text-zinc-500">
        {profile?.email}
        <span className="mx-2 text-zinc-300">·</span>
        роль: {profile?.role ?? "—"}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="card p-5 transition hover:shadow-md"
          >
            <p className="font-semibold text-zinc-900">{card.title}</p>
            <p className="mt-1.5 text-sm text-zinc-600">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
