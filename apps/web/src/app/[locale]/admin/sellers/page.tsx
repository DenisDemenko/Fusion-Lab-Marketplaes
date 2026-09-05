"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { SellerStatus } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

interface AdminSellerRow {
  id: string;
  displayName: string;
  slug: string;
  bio: string | null;
  status: SellerStatus;
  createdAt: string;
  user: { email: string; role: string };
  _count: { listings: number };
}

const SELLER_STATUS_TONE: Record<string, string> = {
  pending: "bg-[var(--warning-soft)] text-[var(--warning)]",
  approved: "bg-[var(--success-soft)] text-[var(--success)]",
  rejected: "bg-[var(--danger-soft)] text-[var(--danger)]",
};

export default function AdminSellersPage() {
  return (
    <RequireAuth role="admin">
      <SellersScreen />
    </RequireAuth>
  );
}

function SellersScreen() {
  const t = useTranslations("adminSellers");
  const tStatus = useTranslations("enums.sellerStatus");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;

  const TABS: { value: SellerStatus | ""; label: string }[] = [
    { value: "pending", label: t("tabPending") },
    { value: "approved", label: t("tabApproved") },
    { value: "rejected", label: t("tabRejected") },
    { value: "", label: t("tabAll") },
  ];

  const [status, setStatus] = useState<SellerStatus | "">("pending");
  const [sellers, setSellers] = useState<AdminSellerRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextStatus: SellerStatus | "") => {
    const query = nextStatus ? `?status=${nextStatus}` : "";
    try {
      setSellers(await api.get<AdminSellerRow[]>(`/admin/sellers${query}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    }
  };

  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/admin/sellers/${id}/approve`);
      await load(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = prompt(t("rejectReasonPrompt")) ?? undefined;
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/admin/sellers/${id}/reject`, { reason });
      await load(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader title={t("title")} />

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value || "all"}
            type="button"
            onClick={() => setStatus(tab.value)}
            /* The selected tab was drawn in the near-black foreground, the
               same ink as the headings above it, so it read as a title
               rather than as the filter currently in force. Selection is
               an accent job. */
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              status === tab.value
                ? "border-[var(--accent)] bg-[var(--accent)] font-semibold text-white"
                : "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {!sellers ? (
        <p className="mt-6 text-[var(--muted)]">{tCommon("loading")}</p>
      ) : sellers.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-[var(--muted)]">{t("empty")}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {sellers.map((seller) => (
            <div key={seller.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* Name, contact, application date and listing count were
                    one grey run-on line separated by middots, so nothing in
                    it could be found by scanning. The name leads, the email
                    is the contact under it, and the two facts an admin
                    actually weighs — how long this has been waiting and
                    whether the seller has anything to sell — sit on their
                    own line in mono, with the count in full ink once it is
                    non-zero. */}
                <div className="min-w-0">
                  <p className="font-display font-semibold text-[var(--foreground)]">
                    {seller.displayName}
                  </p>
                  <p className="mt-0.5 text-sm break-all text-[var(--muted)]">
                    {seller.user.email}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 font-mono text-xs text-[var(--muted)]">
                    <span>{t("appliedOn", { date: formatDate(seller.createdAt, locale) })}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        seller._count.listings > 0 ? "text-[var(--foreground)]" : undefined
                      }
                    >
                      {t("listingsCount", { count: seller._count.listings })}
                    </span>
                  </p>
                  {seller.bio ? (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                      {seller.bio}
                    </p>
                  ) : null}
                </div>
                <span className={`badge ${SELLER_STATUS_TONE[seller.status] ?? "bg-[var(--neutral-bg)] text-[var(--muted)]"}`}>
                  {tStatus(seller.status)}
                </span>
              </div>

              {seller.status === "pending" ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busyId === seller.id}
                    onClick={() => void approve(seller.id)}
                  >
                    {t("approve")}
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busyId === seller.id}
                    onClick={() => void reject(seller.id)}
                  >
                    {t("reject")}
                  </button>
                </div>
              ) : null}

              {seller.status === "approved" ? (
                <div className="mt-4">
                  <Link
                    href={`/admin/sellers/${seller.id}/payouts`}
                    className="btn-ghost"
                  >
                    {t("payouts")}
                  </Link>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
