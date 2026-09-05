"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { MyTeam, TeamInvite, TeamStatus } from "@fusion-lab/shared-types";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";

function statusLabel(status: TeamStatus, t: ReturnType<typeof useTranslations<"accountTeams">>) {
  if (status === "published") return t("statusPublished");
  if (status === "rejected") return t("statusRejected");
  return t("statusPending");
}

// Was a plain grey caption under the team name, the same weight as every
// other line on the row, so the one thing that actually changes between
// teams (pending / published / rejected) was the easiest thing to miss.
// Color it like the rest of the design system's state badges (schedule's
// "mine"/"full", the catalog category chip).
function statusBadgeClass(status: TeamStatus) {
  if (status === "published") return "badge bg-[var(--success-soft)] text-[var(--success)]";
  if (status === "rejected") return "badge bg-[var(--danger-soft)] text-[var(--danger)]";
  return "badge bg-[var(--warning-soft)] text-[var(--warning)]";
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
        <PageHeader title={t("title")} />
        <Link href="/account/teams/new" className="btn-primary shrink-0">
          {t("createTeam")}
        </Link>
      </div>

      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}

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
                  <span className={`mt-1 ${statusBadgeClass(team.status)}`}>
                    {statusLabel(team.status, t)}
                  </span>
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
