"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { MyTeam, TeamInvite, TeamStatus } from "@fusion-lab/shared-types";
import { Link } from "@/i18n/navigation";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";

function statusLabel(status: TeamStatus, t: ReturnType<typeof useTranslations<"accountTeams">>) {
  if (status === "published") return t("statusPublished");
  if (status === "rejected") return t("statusRejected");
  return t("statusPending");
}

export default function AccountTeamsPage() {
  return (
    <RequireAuth>
      <AccountTeamsScreen />
    </RequireAuth>
  );
}

function AccountTeamsScreen() {
  const t = useTranslations("accountTeams");
  const tCommon = useTranslations("common");

  const [teams, setTeams] = useState<MyTeam[] | null>(null);
  const [invites, setInvites] = useState<TeamInvite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const [teamsData, invitesData] = await Promise.all([
        api.get<MyTeam[]>("/me/teams"),
        api.get<TeamInvite[]>("/me/team-invites"),
      ]);
      setTeams(teamsData);
      setInvites(invitesData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respond(memberId: string, accept: boolean) {
    setBusyId(memberId);
    try {
      await api.post(`/me/team-invites/${memberId}/${accept ? "accept" : "decline"}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="section-title">{t("title")}</h1>
        <Link href="/account/teams/new" className="btn-primary shrink-0">
          {t("createTeam")}
        </Link>
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {invites && invites.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {t("invitesTitle")}
          </h2>
          <div className="mt-3 space-y-3">
            {invites.map((invite) => (
              <div key={invite.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-[var(--foreground)]">{invite.team.name}</p>
                  {invite.team.direction ? (
                    <p className="text-sm text-[var(--muted)]">{invite.team.direction}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busyId === invite.id}
                    onClick={() => void respond(invite.id, true)}
                  >
                    {t("accept")}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busyId === invite.id}
                    onClick={() => void respond(invite.id, false)}
                  >
                    {t("decline")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {t("myTeamsTitle")}
        </h2>

        {!teams ? (
          <p className="mt-3 text-[var(--muted)]">{tCommon("loading")}</p>
        ) : teams.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{t("noTeams")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/account/teams/${team.id}`}
                className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:shadow-md"
              >
                <div>
                  <p className="font-medium text-[var(--foreground)]">{team.name}</p>
                  <p className="text-sm text-[var(--muted)]">{statusLabel(team.status, t)}</p>
                </div>
                <span className="badge bg-[var(--neutral-bg)] text-[var(--muted)]">
                  {t("membersCount", { count: team.memberCount })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
