"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

// Same five directions as the old steam-komandy.html page and the create
// form below — a fixed, small set is filtered by exact match rather than
// full-text search, the same choice ClassSchedule.direction made for the
// same reason (docs/migration-plan.md Phase F2).
const DIRECTIONS = [
  "Робототехніка",
  "Меблярство та дерево",
  "ЧПУ та 3D-друк",
  "Цифрове мапування спадщини",
  "Кераміка",
];

export function TeamFilters() {
  const t = useTranslations("teamFilters");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const activeDirection = searchParams.get("direction") ?? "";

  function apply(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    const suffix = next.toString();
    router.push(suffix ? `${pathname}?${suffix}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => apply("direction", "")}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            activeDirection === ""
              ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
              : "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--neutral-bg)]"
          }`}
        >
          {t("allDirections")}
        </button>
        {DIRECTIONS.map((direction) => (
          <button
            key={direction}
            type="button"
            onClick={() => apply("direction", direction)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              activeDirection === direction
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                : "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--neutral-bg)]"
            }`}
          >
            {direction}
          </button>
        ))}
      </div>

      <form
        className="ml-auto"
        onSubmit={(event) => {
          event.preventDefault();
          apply("q", q.trim());
        }}
      >
        <input
          type="search"
          className="input"
          placeholder={t("searchPlaceholder")}
          value={q}
          onChange={(event) => setQ(event.target.value)}
          aria-label={t("searchLabel")}
        />
      </form>
    </div>
  );
}

export { DIRECTIONS as TEAM_DIRECTIONS };
