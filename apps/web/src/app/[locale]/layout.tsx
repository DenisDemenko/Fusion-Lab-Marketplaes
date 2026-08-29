import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AssistantWidget } from "@/components/assistant-widget";
import { ReferralCapture } from "@/components/referral-capture";
import { RoleGate } from "@/components/role-gate";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// [locale] is the top-level dynamic segment right under app/, so this file
// IS the root layout — it renders <html>/<body> itself rather than nesting
// under a separate app/layout.tsx. That separate file would sit above
// [locale] in the tree and never receive the locale param, leaving
// <html lang> permanently wrong for every non-default locale — this is
// next-intl's own documented App Router shape, not a shortcut.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Tells next-intl's server APIs (getTranslations, etc. in child Server
  // Components) which locale this request resolved to — without it every
  // static page would render in the default locale regardless of URL.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col font-sans antialiased">
        <NextIntlClientProvider>
          {/* Provider order is the dependency order: the cart and the
              notifications socket both need the signed-in user. */}
          <AuthProvider>
            <CartProvider>
              <NotificationsProvider>
                <ReferralCapture />
                {/* The header reads useSearchParams, which Next requires
                    to sit inside a Suspense boundary. */}
                <Suspense
                  fallback={<div className="h-16 border-b border-[var(--line)]" />}
                >
                  <SiteHeader />
                </Suspense>

                <main className="flex-1">
                  <RoleGate>{children}</RoleGate>
                </main>

                <SiteFooter />
                <AssistantWidget />
              </NotificationsProvider>
            </CartProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
