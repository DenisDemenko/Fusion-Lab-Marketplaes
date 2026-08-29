"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { TeamDetail, TeamStatus } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { api, mediaUrl } from "@/lib/api-client";

const FILTERS: { value: TeamStatus | ""; key: string }[] = [
  { value: "", key: "filterAll" },
  { value: "pending", key: "filterPending" },
  { value: "published", key: "filterPublished" },
  { value: "rejected", key: "filterRejected" },
];

export default function AdminTeamsPage() {
  return (
    <RequireAuth role="admin">
      <AdminTeamsScreen />
    </RequireAuth>
  );
}

function AdminTeamsScreen() {
  const t = useTranslations("adminTeams");
  const tCommon = useTranslations("common");

  const [status, setStatus] = useState<TeamStatus | "">("pending");
  const [teams, setTeams] = useState<TeamDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(currentStatus: TeamStatus | "") {
    setTeams(null);
    try {
      const query = currentStatus ? `?status=${currentStatus}` : "";
      setTeams(await api.get<TeamDetail[]>(`/admin/teams${query}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    }
  }

  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function approve(id: string) {
    setBusyId(id);
    try {
      await api.post(`/admin/teams/${id}/approve`);
      await load(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = prompt(t("rejectReasonPrompt"));
    if (!reason?.trim()) return;

    setBusyId(id);
    setError(null);
    try {
      await api.post(`/admin/teams/${id}/reject`, { reason: reason.trim() });
      await load(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="section-title">{t("title")}</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatus(filter.value)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              status === filter.value
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                : "border-[var(--line)] bg-white text-[var(--foreground)] hover:bg-[var(--neutral-bg)]"
            }`}
          >
            {t(filter.key as "filterAll")}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {!teams ? (
        <p className="mt-6 text-[var(--muted)]">{tCommon("loading")}</p>
      ) : teams.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">{t("noTeams")}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {teams.map((team) => {
            const photo = mediaUrl(team.photoUrl);
            return (
              <div key={team.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--neutral-bg)]">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{team.name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {team.direction ?? ""} · {t("membersCount", { count: team.memberCount })}
                    </p>
                    {team.status === "rejected" && team.rejectionReason ? (
                      <p className="text-xs text-red-700">{team.rejectionReason}</p>
                    ) : null}
                  </div>
                </div>
                {team.status === "pending" ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busyId === team.id}
                      onClick={() => void approve(team.id)}
                    >
                      {t("approve")}
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={busyId === team.id}
                      onClick={() => void reject(team.id)}
                    >
                      {t("reject")}
                    </button>
                  </div>
                ) : (
                  <span className="badge bg-[var(--neutral-bg)] text-[var(--muted)]">
                    {team.status}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
