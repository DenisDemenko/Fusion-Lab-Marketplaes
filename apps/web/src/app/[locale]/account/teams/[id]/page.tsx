"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MediaSummary, MyTeam, TeamStatus } from "@fusion-lab/shared-types";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { api, ApiError, mediaUrl } from "@/lib/api-client";

export default function ManageTeamPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <ManageTeamScreen teamId={params.id} />
    </RequireAuth>
  );
}

// Same state, same three tones, as the "my teams" list this page is
// reached from — a status word buried in the header description read as
// filler text; a badge reads as the one fact the owner actually checks on
// return.
function statusBadgeClass(status: TeamStatus) {
  if (status === "published") return "badge bg-[var(--success-soft)] text-[var(--success)]";
  if (status === "rejected") return "badge bg-[var(--danger-soft)] text-[var(--danger)]";
  return "badge bg-[var(--warning-soft)] text-[var(--warning)]";
}

function ManageTeamScreen({ teamId }: { teamId: string }) {
  const t = useTranslations("teamManage");
  const tCommon = useTranslations("common");

  const [team, setTeam] = useState<MyTeam | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const teams = await api.get<MyTeam[]>("/me/teams");
      setTeam(teams.find((candidate) => candidate.id === teamId) ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (team === undefined) {
    return <p className="mx-auto max-w-2xl px-4 py-10 text-[var(--muted)]">{tCommon("loading")}</p>;
  }
  if (team === null) {
    return <p className="mx-auto max-w-2xl px-4 py-10 text-[var(--danger)]">{t("notFound")}</p>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader
        title={team.name}
        actions={
          <span className={statusBadgeClass(team.status)}>
            {team.status === "published"
              ? t("statusPublished")
              : team.status === "rejected"
                ? t("statusRejected")
                : t("statusPending")}
          </span>
        }
      />
      {team.status === "rejected" && team.rejectionReason ? (
        <p className="mt-2 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {team.rejectionReason}
        </p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="card mt-6 p-6">
        <p className="label">{t("membersTitle")}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {team.members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-3.5 pr-2 text-sm text-[var(--foreground)]"
            >
              {member.displayName}
              {/* Was " · власник" appended as plain text — indistinguishable
                  from the name it trails at a glance. A chip reads as a role,
                  not a suffix. */}
              {member.role === "owner" ? (
                <span className="badge bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] text-[var(--accent)]">
                  {t("ownerLabel")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {t("membersCount", { count: team.memberCount })}
        </p>
      </div>

      {team.isOwner ? (
        <>
          <InviteForm teamId={teamId} onInvited={load} />
          <PhotoUploader teamId={teamId} photoUrl={team.photoUrl} onChange={load} />
          <ResultsUploader teamId={teamId} results={team.results} onChange={load} />
        </>
      ) : null}
    </div>
  );
}

function InviteForm({ teamId, onInvited }: { teamId: string; onInvited: () => void }) {
  const t = useTranslations("teamManage");
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setInviting(true);
    setError(null);
    setSuccess(false);
    try {
      await api.post(`/teams/${teamId}/invite`, { email: email.trim() });
      setEmail("");
      setSuccess(true);
      onInvited();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("inviteFailed"));
    } finally {
      setInviting(false);
    }
  }

  return (
    <form onSubmit={invite} className="card mt-6 space-y-3 p-6">
      <p className="label">{t("inviteTitle")}</p>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          className="input flex-1"
          placeholder={t("inviteEmailPlaceholder")}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={inviting}>
          {inviting ? t("inviting") : t("invite")}
        </button>
      </div>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {success ? <p className="text-sm text-[var(--success)]">{t("inviteSent")}</p> : null}
    </form>
  );
}

function PhotoUploader({
  teamId,
  photoUrl,
  onChange,
}: {
  teamId: string;
  photoUrl: string | null;
  onChange: () => void;
}) {
  const t = useTranslations("teamManage");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photo = mediaUrl(photoUrl);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("kind", "cover");
      formData.append("file", file);
      await api.upload(`/teams/${teamId}/media`, formData);
      onChange();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("uploadFailed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="card mt-6 flex items-center gap-4 p-6">
      <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--neutral-bg)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-xs text-[var(--muted)]">
            {t("noPhoto")}
          </div>
        )}
      </div>
      <div>
        <p className="label">{t("photoTitle")}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          className="btn-ghost mt-1"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? t("uploading") : photo ? t("replacePhoto") : t("uploadPhoto")}
        </button>
        {error ? <p className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}
      </div>
    </div>
  );
}

function ResultsUploader({
  teamId,
  results,
  onChange,
}: {
  teamId: string;
  results: MediaSummary[];
  onChange: () => void;
}) {
  const t = useTranslations("teamManage");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("kind", "attachment");
      formData.append("file", file);
      await api.upload(`/teams/${teamId}/media`, formData);
      onChange();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("uploadFailed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(mediaId: string) {
    try {
      await api.delete(`/teams/media/${mediaId}`);
      onChange();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("deleteFailed"));
    }
  }

  return (
    <div className="card mt-6 p-6">
      <p className="label">{t("resultsTitle")}</p>

      {results.length > 0 ? (
        <ul className="mt-2 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
          {results.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="truncate text-sm text-[var(--foreground)]">{file.filename}</span>
              <button
                type="button"
                className="shrink-0 text-sm text-[var(--danger)] hover:underline"
                onClick={() => void remove(file.id)}
              >
                {t("delete")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[var(--muted)]">{t("noResultsYet")}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,.stl,.3mf,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        className="btn-ghost mt-3"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? t("uploading") : t("addResult")}
      </button>
      {error ? <p className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
