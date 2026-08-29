import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { mediaUrl } from "@/lib/api-client";
import { fetchTeam } from "@/lib/server-api";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/teams/[id]">) {
  const { id } = await params;
  const team = await fetchTeam(id);
  const t = await getTranslations("teamDetail");

  return { title: team ? `${team.name} — Fusion Lab` : t("metaNotFound") };
}

export default async function TeamDetailPage({
  params,
}: PageProps<"/[locale]/teams/[id]">) {
  const { id } = await params;
  const team = await fetchTeam(id);

  if (!team) notFound();

  const t = await getTranslations("teamDetail");
  const cover = mediaUrl(team.photoUrl);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href="/teams" className="hover:text-[var(--foreground)]">
          {t("breadcrumbTeams")}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--foreground)]">{team.name}</span>
      </nav>

      <div className="card overflow-hidden">
        <div className="aspect-[16/9] bg-[var(--neutral-bg)]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {team.direction ? (
          <span className="badge bg-[var(--accent-soft)] text-[var(--accent)]">
            {team.direction}
          </span>
        ) : null}
        <span className="text-sm text-[var(--muted)]">
          {t("membersCount", { count: team.memberCount })}
        </span>
      </div>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
        {team.name}
      </h1>
      <p className="mt-3 whitespace-pre-line text-[var(--foreground)]">
        {team.description}
      </p>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {t("membersTitle")}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {team.members.map((member) => (
            <li
              key={member.id}
              className="rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-sm text-[var(--foreground)]"
            >
              {member.displayName}
              {member.role === "owner" ? ` · ${t("ownerLabel")}` : ""}
            </li>
          ))}
        </ul>
      </div>

      {team.results.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {t("resultsTitle")}
          </h2>
          <ul className="mt-3 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
            {team.results.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <span className="truncate text-sm text-[var(--foreground)]">
                  {file.filename}
                </span>
                <a
                  href={mediaUrl(file.downloadUrl) ?? "#"}
                  className="shrink-0 text-sm text-[var(--accent)] hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("download")}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
