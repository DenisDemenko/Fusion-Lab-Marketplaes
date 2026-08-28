import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { SiteHeader } from "@/components/site-header";
import { AssistantWidget } from "@/components/assistant-widget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fusion Lab — маркетплейс курсів, книг і виробів",
  description:
    "Курси Fusion 360, 3D-друку та ЧПУ, книги і вироби лабораторії креативної технічної творчості.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {/* Provider order is the dependency order: the cart and the
            notifications socket both need the signed-in user. */}
        <AuthProvider>
          <CartProvider>
            <NotificationsProvider>
              {/* The header reads useSearchParams, which Next requires to
                  sit inside a Suspense boundary. */}
              <Suspense
                fallback={<div className="h-16 border-b border-[var(--line)]" />}
              >
                <SiteHeader />
              </Suspense>

              <main className="flex-1">{children}</main>

              <SiteFooter />
              <AssistantWidget />
            </NotificationsProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--line)] bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-semibold">Fusion Lab</p>
          <p className="mt-2 text-sm text-zinc-500">
            Лабораторія креативної технічної творчості: курси Fusion 360,
            3D-друк, ЧПУ, БПЛА.
          </p>
        </div>

        <div className="text-sm">
          <p className="font-medium text-zinc-900">Маркетплейс</p>
          <ul className="mt-2 space-y-1.5 text-zinc-600">
            <li>
              <Link href="/catalog" className="hover:text-zinc-900">
                Каталог
              </Link>
            </li>
            <li>
              <Link href="/catalog?kind=course" className="hover:text-zinc-900">
                Курси
              </Link>
            </li>
            <li>
              <Link href="/catalog?kind=product" className="hover:text-zinc-900">
                Вироби
              </Link>
            </li>
            <li>
              <Link href="/catalog?kind=book" className="hover:text-zinc-900">
                Книги
              </Link>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-medium text-zinc-900">Кабінети</p>
          <ul className="mt-2 space-y-1.5 text-zinc-600">
            <li>
              <Link href="/account/library" className="hover:text-zinc-900">
                Мої матеріали
              </Link>
            </li>
            <li>
              <Link href="/account/orders" className="hover:text-zinc-900">
                Мої замовлення
              </Link>
            </li>
            <li>
              <Link href="/seller" className="hover:text-zinc-900">
                Продавати на Fusion Lab
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--line)] px-4 py-4 text-center text-xs text-zinc-400">
        © {new Date().getFullYear()} Fusion Lab
      </div>
    </footer>
  );
}
