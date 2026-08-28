"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";

export function SellerApplyForm({
  onApplied,
}: {
  onApplied: () => Promise<void> | void;
}) {
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
      setError(
        caught instanceof Error ? caught.message : "Не вдалося подати заявку",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
      <div>
        <label className="label" htmlFor="displayName">
          Назва майстерні / імʼя
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
          Коротко про себе (необовʼязково)
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
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Надсилаю…" : "Подати заявку"}
      </button>
    </form>
  );
}
