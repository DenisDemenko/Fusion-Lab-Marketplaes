"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { UserRole } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";

interface AdminUserRow {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
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
  const locale = useLocale() as Locale;
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="section-title">{t("title")}</h1>

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
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!users ? (
        <p className="mt-6 text-zinc-500">{tCommon("loading")}</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">{t("colEmail")}</th>
                <th className="px-4 py-3 font-medium">{t("colRegistered")}</th>
                <th className="px-4 py-3 font-medium">{t("colOrders")}</th>
                <th className="px-4 py-3 font-medium">{t("colEntitlements")}</th>
                <th className="px-4 py-3 font-medium">{t("colRole")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{user.email}</p>
                    {user.sellerProfile ? (
                      <p className="text-xs text-zinc-500">
                        {t("sellerStatusLabel", { status: user.sellerProfile.status })}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(user.createdAt, locale)}
                  </td>
                  <td className="px-4 py-3">{user._count.orders}</td>
                  <td className="px-4 py-3">{user._count.entitlements}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm"
                      value={user.role}
                      disabled={busyId === user.id || user.id === profile?.id}
                      onChange={(event) =>
                        void changeRole(user.id, event.target.value as UserRole)
                      }
                    >
                      <option value="buyer">buyer</option>
                      <option value="seller">seller</option>
                      <option value="admin">admin</option>
                    </select>
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
