"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@fusion-lab/shared-types";
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
  const { firebaseUser, profile, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-zinc-500">
        Завантаження…
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">Потрібен вхід</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Увійдіть в акаунт, щоб побачити цю сторінку.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="btn-primary mt-5"
        >
          Увійти
        </Link>
      </div>
    );
  }

  if (role && profile?.role !== role) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">Немає доступу</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Цей розділ доступний лише для ролі «{role}». Ваша роль:{" "}
          {profile?.role ?? "невідома"}.
        </p>
        <Link href="/" className="btn-ghost mt-5">
          На головну
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
