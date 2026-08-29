"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SELF_SELECTABLE_ROLES, type UserRole } from "@fusion-lab/shared-types";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

// Blocks the app behind a one-time role pick for a freshly authenticated
// account (docs/migration-plan.md, Phase A, П36/П37: free choice, exactly
// once — the backend enforces the "once" half via User.roleChosenAt).
// Mounted-gated like SiteHeader: Firebase can resolve before React's first
// client commit, so the server and the first client paint must agree on
// rendering `children` regardless, or hydration mismatches.
export function RoleGate({ children }: { children: React.ReactNode }) {
  const { firebaseUser, profile, loading, refreshProfile } = useAuth();
  const t = useTranslations("roleGate");
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<UserRole | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const blocked =
    mounted && !loading && firebaseUser && profile && !profile.roleChosen;

  if (!blocked) {
    return <>{children}</>;
  }

  async function submit() {
    if (!selected) return;
    setBusy(true);
    setError(null);

    try {
      await api.post("/me/role", { role: selected });
      await refreshProfile();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("failed"));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="section-title">{t("title")}</h1>
      <p className="mt-2 text-[var(--muted)]">{t("subtitle")}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {SELF_SELECTABLE_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setSelected(role)}
            aria-pressed={selected === role}
            className={`card p-4 text-left transition ${
              selected === role
                ? "border-[var(--foreground)] ring-1 ring-[var(--foreground)]"
                : "hover:border-[var(--muted)]"
            }`}
          >
            <p className="font-semibold text-[var(--foreground)]">
              {t(`roles.${role}.label`)}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t(`roles.${role}.description`)}
            </p>
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="btn-primary mt-6 w-full sm:w-auto"
        disabled={!selected || busy}
        onClick={submit}
      >
        {busy ? t("submitting") : t("submit")}
      </button>
    </div>
  );
}
