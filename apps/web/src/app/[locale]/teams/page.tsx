import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TeamCard } from "@/components/team-card";
import { TeamFilters } from "@/components/team-filters";
import { fetchTeams } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("teamsPage");
  return { title: t("metaTitle") };
}

export default async function TeamsPage({
  searchParams,
}: PageProps<"/[locale]/teams">) {
  const t = await getTranslations("teamsPage");
  const params = await searchParams;
  const direction = single(params.direction);
  const q = single(params.q);

  const teams = await fetchTeams({ direction, q });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="section-title">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("subtitle")}</p>
        </div>
        <Link href="/account/teams/new" className="btn-primary shrink-0">
          {t("createTeam")}
        </Link>
      </div>

      <div className="mt-6">
        <TeamFilters />
      </div>

      {teams.length === 0 ? (
        <div className="card mt-6 p-10 text-center">
          <p className="font-medium text-[var(--foreground)]">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("emptyBody")}</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
