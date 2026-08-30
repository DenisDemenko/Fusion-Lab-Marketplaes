"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { PromoCode, PromoCodeType } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDate, formatUah } from "@/lib/format";

export default function AdminPromoCodesPage() {
  return (
    <RequireAuth role="admin">
      <PromoCodesScreen />
    </RequireAuth>
  );
}

function PromoCodesScreen() {
  const t = useTranslations("adminPromoCodes");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [codes, setCodes] = useState<PromoCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState("");
  const [type, setType] = useState<PromoCodeType>("percent");
  const [value, setValue] = useState("10");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function load() {
    try {
      setCodes(await api.get<PromoCode[]>("/admin/promo-codes"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("loadError"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.post("/admin/promo-codes", {
        code: code.trim(),
        type,
        value: Number(value),
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setCode("");
      setValue("10");
      setMaxRedemptions("");
      setExpiresAt("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    setError(null);
    try {
      await api.patch(`/admin/promo-codes/${id}`, { active: !active });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title={t("title")} />

      <form onSubmit={create} className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="code">
            {t("codeLabel")}
          </label>
          <input
            id="code"
            className="input"
            required
            minLength={3}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="type">
            {t("typeLabel")}
          </label>
          <select
            id="type"
            className="input"
            value={type}
            onChange={(event) => setType(event.target.value as PromoCodeType)}
          >
            <option value="percent">{t("typePercent")}</option>
            <option value="fixed">{t("typeFixed")}</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="value">
            {type === "percent" ? t("valueLabelPercent") : t("valueLabelFixed")}
          </label>
          <input
            id="value"
            className="input"
            type="number"
            min={1}
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="maxRedemptions">
            {t("maxRedemptionsLabel")}
          </label>
          <input
            id="maxRedemptions"
            className="input"
            type="number"
            min={1}
            placeholder={t("maxRedemptionsPlaceholder")}
            value={maxRedemptions}
            onChange={(event) => setMaxRedemptions(event.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="expiresAt">
            {t("expiresAtLabel")}
          </label>
          <input
            id="expiresAt"
            className="input"
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </div>

        {error ? (
          <p className="sm:col-span-2 rounded-xl bg-[var(--danger-soft)] px-3.5 py-2.5 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn-primary sm:col-span-2"
          disabled={busy}
        >
          {busy ? t("creating") : t("create")}
        </button>
      </form>

      {!codes ? (
        <p className="mt-6 text-[var(--muted)]">{tCommon("loading")}</p>
      ) : codes.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-[var(--muted)]">{t("empty")}</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">{t("colCode")}</th>
                <th className="px-4 py-3 font-medium">{t("colDiscount")}</th>
                <th className="px-4 py-3 font-medium">{t("colUsed")}</th>
                <th className="px-4 py-3 font-medium">{t("colExpires")}</th>
                <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {codes.map((promo) => (
                <tr key={promo.id}>
                  <td className="px-4 py-3 font-mono font-medium">{promo.code}</td>
                  <td className="px-4 py-3">
                    {promo.type === "percent"
                      ? `${promo.value}%`
                      : formatUah(promo.value, locale)}
                  </td>
                  <td className="px-4 py-3">
                    {promo.redemptionCount}
                    {promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ""}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {promo.expiresAt ? formatDate(promo.expiresAt, locale) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${promo.active ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--neutral-bg)] text-[var(--muted)]"}`}
                    >
                      {promo.active ? t("statusActive") : t("statusDisabled")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-sm text-[var(--muted)] hover:underline"
                      onClick={() => void toggle(promo.id, promo.active)}
                    >
                      {promo.active ? t("disable") : t("enable")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
