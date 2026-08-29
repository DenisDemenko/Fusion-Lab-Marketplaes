import { useTranslations } from "next-intl";
import type { TeamCard as TeamCardDto } from "@fusion-lab/shared-types";
import { Link } from "@/i18n/navigation";
import { mediaUrl } from "@/lib/api-client";

export function TeamCard({ team }: { team: TeamCardDto }) {
  const t = useTranslations("teamCard");
  const cover = mediaUrl(team.photoUrl);

  return (
    <Link
      href={`/teams/${team.id}`}
      className="card group flex h-full flex-col overflow-hidden transition hover:shadow-md"
      data-testid="team-card"
    >
      <div className="aspect-[16/10] overflow-hidden bg-[var(--neutral-bg)]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-[var(--muted)]">
            {t("noPhoto")}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {team.direction ? (
          <span className="badge w-fit bg-[var(--accent-soft)] text-[var(--accent)]">
            {team.direction}
          </span>
        ) : null}

        <h3 className="line-clamp-2 font-semibold leading-snug text-[var(--foreground)]">
          {team.name}
        </h3>

        <p className="line-clamp-2 text-sm text-[var(--muted)]">{team.description}</p>

        <p className="mt-auto pt-2 text-xs text-[var(--muted)]">
          {t("membersCount", { count: team.memberCount })}
        </p>
      </div>
    </Link>
  );
}
