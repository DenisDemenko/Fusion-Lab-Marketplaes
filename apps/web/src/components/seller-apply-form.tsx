"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "@/lib/api-client";

export function SellerApplyForm({
  onApplied,
}: {
  onApplied: () => Promise<void> | void;
}) {
  const t = useTranslations("sellerApply");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.post("/seller/apply", {
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
      });
      await onApplied();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("applyFailed"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
      <div>
        <label className="label" htmlFor="displayName">
          {t("displayNameLabel")}
        </label>
        <input
          id="displayName"
          className="input"
          required
          minLength={2}
          maxLength={80}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="bio">
          {t("bioLabel")}
        </label>
        <textarea
          id="bio"
          className="input min-h-24"
          maxLength={2000}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3.5 py-2.5 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
