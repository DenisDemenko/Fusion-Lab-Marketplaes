"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { TEAM_DIRECTIONS } from "@/components/team-filters";
import { useRouter } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api-client";

export default function NewTeamPage() {
  return (
    <RequireAuth>
      <NewTeamForm />
    </RequireAuth>
  );
}

function NewTeamForm() {
  const t = useTranslations("teamCreate");
  const router = useRouter();

  const [name, setName] = useState("");
  const [direction, setDirection] = useState(TEAM_DIRECTIONS[0]);
  const [description, setDescription] = useState("");
  const [consent, setConsent] = useState(false);
  const [memberEmails, setMemberEmails] = useState(["", "", "", ""]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const created = await api.post<{ id: string }>("/teams", {
        name: name.trim(),
        direction,
        description: description.trim(),
        consent,
        memberEmails: memberEmails.map((email) => email.trim()).filter(Boolean),
      });
      router.push(`/account/teams/${created.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : t("createFailed"),
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
      />

      <form onSubmit={create} className="card space-y-4 p-6">
        <div>
          <label className="label" htmlFor="team-name">{t("nameLabel")}</label>
          <input
            id="team-name"
            className="input"
            required
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="team-direction">{t("directionLabel")}</label>
          <select
            id="team-direction"
            className="input"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
          >
            {TEAM_DIRECTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="team-description">{t("descriptionLabel")}</label>
          <textarea
            id="team-description"
            className="input min-h-28"
            required
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div>
          <p className="label">{t("membersLabel")}</p>
          <p className="mb-2 text-xs text-[var(--muted)]">{t("membersHint")}</p>
          {/* Four identical placeholders in a column read as one blurred
              field, not four people to invite. A number pins each row to
              a specific seat on the team. */}
          <div className="space-y-2">
            {memberEmails.map((email, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line)] font-mono text-xs text-[var(--muted)]">
                  {index + 1}
                </span>
                <input
                  type="email"
                  className="input"
                  placeholder={t("memberEmailPlaceholder")}
                  value={email}
                  onChange={(event) => {
                    const next = [...memberEmails];
                    next[index] = event.target.value;
                    setMemberEmails(next);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <label className="checkbox flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>{t("consentLabel")}</span>
        </label>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <button type="submit" className="btn-primary" disabled={creating}>
          {creating ? t("creating") : t("create")}
        </button>
      </form>
    </div>
  );
}
