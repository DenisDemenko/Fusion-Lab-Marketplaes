"use client";

import { useEffect, useState } from "react";
import type { ReferralInfo } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export default function ReferralsPage() {
  return (
    <RequireAuth>
      <ReferralsScreen />
    </RequireAuth>
  );
}

function ReferralsScreen() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get<ReferralInfo>("/referrals/me")
      .then(setInfo)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Помилка завантаження"),
      );
  }, []);

  if (error) {
    return <p className="mx-auto max-w-2xl px-4 py-16 text-center text-red-700">{error}</p>;
  }

  if (!info) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-zinc-500">Завантаження…</p>
    );
  }

  const link =
    typeof window !== "undefined" && info.referralCode
      ? `${window.location.origin}/?ref=${info.referralCode}`
      : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="section-title">Запросіть друга</h1>
      <p className="mt-1 text-sm text-zinc-500">
        За першу оплачену покупку запрошеного друга ви отримуєте 500 балів
        (5 грн знижки).
      </p>

      <div className="card mt-6 p-6">
        <p className="label">Ваше реферальне посилання</p>
        <div className="flex gap-2">
          <input className="input" readOnly value={link} />
          <button
            type="button"
            className="btn-ghost shrink-0"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Скопійовано!" : "Копіювати"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Код: <span className="font-mono">{info.referralCode}</span>
        </p>
      </div>

      {info.referredBy ? (
        <p className="card mt-4 p-4 text-sm text-zinc-600">
          Вас запросили {formatDate(info.referredBy.claimedAt)}.
        </p>
      ) : null}

      <div className="mt-6">
        <p className="font-medium text-zinc-900">
          Запрошено: {info.invited.length} · нараховано балів: {info.totalBonusPoints}
        </p>

        {info.invited.length === 0 ? (
          <p className="card mt-3 p-8 text-center text-zinc-500">
            Поки що ніхто не приєднався за вашим посиланням.
          </p>
        ) : (
          <div className="card mt-3 divide-y divide-[var(--line)]">
            {info.invited.map((invitee, index) => (
              <div key={index} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-zinc-900">
                    {invitee.displayName || invitee.email}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Приєднався {formatDate(invitee.joinedAt)}
                  </p>
                </div>
                <span
                  className={`badge ${
                    invitee.bonusAwarded
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {invitee.bonusAwarded ? "Бонус нараховано" : "Очікує покупки"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
