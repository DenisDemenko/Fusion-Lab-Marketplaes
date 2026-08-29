"use client";

import { useTranslations } from "next-intl";
import type { UserRole } from "@fusion-lab/shared-types";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";

// Client-side gating only — the API is the real boundary and enforces the
// same rules on every request. This exists so a signed-out visitor sees a
// sign-in prompt instead of a screen full of failed requests.
export function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: UserRole;
}) {
  const t = useTranslations("requireAuth");
  const { firebaseUser, profile, loading } = useAuth();
  // From @/i18n/navigation, not next/navigation: this pathname has no
  // locale prefix, which matters here — the login page later does
  // router.push(next) with the *i18n-aware* router, which adds the
  // current locale prefix itself. A prefixed pathname captured here would
  // get prefixed a second time.
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-zinc-500">
        {t("loading")}
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">{t("signInRequired")}</h1>
        <p className="mt-2 text-sm text-zinc-500">{t("signInPrompt")}</p>
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="btn-primary mt-5"
        >
          {t("signIn")}
        </Link>
      </div>
    );
  }

  if (role && profile?.role !== role) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">{t("noAccess")}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {t("roleRequired", { role, yourRole: profile?.role ?? t("unknownRole") })}
        </p>
        <Link href="/" className="btn-ghost mt-5">
          {t("goHome")}
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
