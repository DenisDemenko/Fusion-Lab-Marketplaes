"use client";

import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useState } from "react";
import type {
  Permission,
  SellerStatus,
  UserPermissionsAdminView,
  UserRole,
} from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";

const ALL_ROLES: UserRole[] = [
  "buyer",
  "seller",
  "admin",
  "writer",
  "expert",
  "sales_manager",
  "instruction_engineer",
  "student",
];

const ALL_PERMISSIONS: Permission[] = [
  "listings:write",
  "sales:access",
  "books:write",
];

// The same three tones the seller and team moderation screens use, so a
// seller sitting in review looks the same wherever an admin meets them.
const SELLER_STATUS_TONE: Record<string, string> = {
  pending: "bg-[var(--warning-soft)] text-[var(--warning)]",
  approved: "bg-[var(--success-soft)] text-[var(--success)]",
  rejected: "bg-[var(--danger-soft)] text-[var(--danger)]",
};

interface AdminUserRow {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  salesApproved: boolean;
  createdAt: string;
  sellerProfile: { status: string; displayName: string } | null;
  _count: { orders: number; entitlements: number };
}

export default function AdminUsersPage() {
  return (
    <RequireAuth role="admin">
      <UsersScreen />
    </RequireAuth>
  );
}

function UsersScreen() {
  const t = useTranslations("adminUsers");
  const tCommon = useTranslations("common");
  const tSellerStatus = useTranslations("enums.sellerStatus");
  const locale = useLocale() as Locale;
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load(search: string) {
    const suffix = search ? `?q=${encodeURIComponent(search)}` : "";
    try {
      setUsers(await api.get<AdminUserRow[]>(`/admin/users${suffix}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    }
  }

  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeRole(userId: string, role: UserRole) {
    setBusyId(userId);
    setError(null);
    try {
      await api.patch(`/admin/users/${userId}/role`, { role });
      await load(query);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSalesApproval(userId: string, approved: boolean) {
    setBusyId(userId);
    setError(null);
    try {
      await api.patch(`/admin/users/${userId}/sales-approval`, { approved });
      await load(query);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader title={t("title")} />

      <form
        className="mt-5 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load(query);
        }}
      >
        <input
          className="input"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="btn-ghost">
          {t("search")}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {!users ? (
        <p className="mt-6 text-[var(--muted)]">{tCommon("loading")}</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">{t("colEmail")}</th>
                <th className="px-4 py-3 font-medium">{t("colRegistered")}</th>
                <th className="px-4 py-3 font-medium">{t("colOrders")}</th>
                <th className="px-4 py-3 font-medium">{t("colEntitlements")}</th>
                <th className="px-4 py-3 font-medium">{t("colRole")}</th>
                <th className="px-4 py-3 font-medium">{t("colSalesApproved")}</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {users.map((user) => (
                <Fragment key={user.id}>
                  <tr>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--foreground)]">{user.email}</p>
                      {/* The seller status was interpolated raw ("продавець:
                          pending") into a grey caption — a moderation state
                          shown both untranslated and untinted. */}
                      {user.sellerProfile ? (
                        <span
                          className={`badge mt-1 px-2 py-0.5 text-[10px] ${
                            SELLER_STATUS_TONE[user.sellerProfile.status] ??
                            "bg-[var(--neutral-bg)] text-[var(--muted)]"
                          }`}
                        >
                          {t("sellerStatusLabel", {
                            status: tSellerStatus(user.sellerProfile.status as SellerStatus),
                          })}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--muted)]">
                      {formatDate(user.createdAt, locale)}
                    </td>
                    {/* Dates and counts are figures, not prose — mono lets the
                        columns be compared down the page, and a user who has
                        bought nothing stops looking like one who has. */}
                    <td
                      className={`px-4 py-3 font-mono ${user._count.orders === 0 ? "text-[var(--muted)]" : "font-medium text-[var(--foreground)]"}`}
                    >
                      {user._count.orders}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono ${user._count.entitlements === 0 ? "text-[var(--muted)]" : "font-medium text-[var(--foreground)]"}`}
                    >
                      {user._count.entitlements}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm"
                        value={user.role}
                        disabled={busyId === user.id || user.id === profile?.id}
                        onChange={(event) =>
                          void changeRole(user.id, event.target.value as UserRole)
                        }
                      >
                        {ALL_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {t(`roleLabels.${role}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={user.salesApproved}
                          disabled={busyId === user.id}
                          onChange={(event) =>
                            void toggleSalesApproval(user.id, event.target.checked)
                          }
                        />
                        {/* Granted and withheld access read identically in
                            grey — the one column on this table that decides
                            what a person can do. */}
                        <span
                          className={`text-xs ${user.salesApproved ? "font-medium text-[var(--success)]" : "text-[var(--muted)]"}`}
                        >
                          {user.salesApproved ? t("approved") : t("notApproved")}
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-sm text-[var(--muted)] hover:underline"
                        onClick={() =>
                          setExpandedId(expandedId === user.id ? null : user.id)
                        }
                      >
                        {expandedId === user.id ? t("hidePermissions") : t("showPermissions")}
                      </button>
                    </td>
                  </tr>
                  {expandedId === user.id ? (
                    <tr>
                      <td colSpan={7} className="bg-[var(--neutral-bg)] px-4 py-4">
                        <PermissionsPanel
                          userId={user.id}
                          onChanged={() => load(query)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PermissionsPanel({
  userId,
  onChanged,
}: {
  userId: string;
  onChanged: () => void;
}) {
  const t = useTranslations("adminUsers");
  const tCommon = useTranslations("common");
  const [data, setData] = useState<UserPermissionsAdminView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setData(await api.get<UserPermissionsAdminView>(`/admin/users/${userId}/permissions`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function setOverride(permission: Permission, granted: boolean | null) {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/admin/users/${userId}/permissions`, { permission, granted });
      await load();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return <p className="text-sm text-[var(--danger)]">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-[var(--muted)]">{tCommon("loading")}</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          {t("effectivePermissions")}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {data.effective.length === 0 ? (
            <span className="text-sm text-[var(--muted)]">{t("noPermissions")}</span>
          ) : (
            data.effective.map((permission) => (
              <span
                key={permission}
                className="badge bg-[var(--neutral-bg)] font-mono text-[var(--foreground)]"
              >
                {permission}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {ALL_PERMISSIONS.map((permission) => {
          const override = data.overrides.find((o) => o.permission === permission);
          const fromPreset = data.rolePreset.includes(permission);

          return (
            // A manual override is the only thing on this panel that is not
            // simply the role doing its job — it was appended to the same grey
            // line as the preset note, so the exceptions an admin is actually
            // looking for were the least visible thing here. The card carrying
            // one now owns an accent edge, and the direction of the override
            // is coloured. (`mono` was also not a class Tailwind knows, so the
            // permission key had never actually been set in mono.)
            <div
              key={permission}
              className={`card p-3 ${override ? "border-[var(--accent)]" : ""}`}
            >
              <p className="font-mono text-xs font-medium text-[var(--foreground)]">{permission}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-[var(--muted)]">
                  {fromPreset ? t("fromRolePreset") : t("notInRolePreset")}
                </span>
                {override ? (
                  <span
                    className={`badge px-2 py-0.5 text-[10px] ${
                      override.granted
                        ? "bg-[var(--success-soft)] text-[var(--success)]"
                        : "bg-[var(--danger-soft)] text-[var(--danger)]"
                    }`}
                  >
                    {t(override.granted ? "overrideGrant" : "overrideRevoke")}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs hover:bg-[var(--neutral-bg)]"
                  onClick={() => void setOverride(permission, true)}
                >
                  {t("grant")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs hover:bg-[var(--neutral-bg)]"
                  onClick={() => void setOverride(permission, false)}
                >
                  {t("revoke")}
                </button>
                {override ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs hover:bg-[var(--neutral-bg)]"
                    onClick={() => void setOverride(permission, null)}
                  >
                    {t("resetOverride")}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
