"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ReferralInfo } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
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
  const t = useTranslations("accountReferrals");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get<ReferralInfo>("/referrals/me")
      .then(setInfo)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : tCommon("loadError")),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="mx-auto max-w-2xl px-4 py-16 text-center text-[var(--danger)]">{error}</p>;
  }

  if (!info) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>
    );
  }

  const link =
    typeof window !== "undefined" && info.referralCode
      ? `${window.location.origin}/?ref=${info.referralCode}`
      : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
      />

      <div className="card p-6">
        <p className="label">{t("linkLabel")}</p>
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
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {t("codeLabel", { code: info.referralCode ?? "" })}
        </p>
      </div>

      {info.referredBy ? (
        <p className="card mt-4 p-4 text-sm text-[var(--muted)]">
          {t("referredByLabel", { date: formatDate(info.referredBy.claimedAt, locale) })}
        </p>
      ) : null}

      {/* The two numbers this whole program is about were buried mid-
          sentence in plain body text. Pulled into stat tiles — the same
          "big display figure over a muted label" shape the loyalty balance
          uses — so the payoff reads before the list below does. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="card p-5 text-center">
          <p className="font-display text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            {info.invited.length}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("statInvited")}</p>
        </div>
        <div className="card p-5 text-center">
          <p className="font-display text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            {info.totalBonusPoints}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("statPoints")}</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="label mb-0">{t("invitedListTitle")}</p>

        {info.invited.length === 0 ? (
          <p className="card mt-3 p-8 text-center text-[var(--muted)]">{t("emptyInvited")}</p>
        ) : (
          <div className="card mt-3 divide-y divide-[var(--line)]">
            {info.invited.map((invitee, index) => (
              <div key={index} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-[var(--foreground)]">
                    {invitee.displayName || invitee.email}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {t("joinedAt", { date: formatDate(invitee.joinedAt, locale) })}
                  </p>
                </div>
                <span
                  className={`badge ${
                    invitee.bonusAwarded
                      ? "bg-[var(--success-soft)] text-[var(--success)]"
                      : "bg-[var(--warning-soft)] text-[var(--warning)]"
                  }`}
                >
                  {invitee.bonusAwarded ? t("bonusAwarded") : t("bonusPending")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
