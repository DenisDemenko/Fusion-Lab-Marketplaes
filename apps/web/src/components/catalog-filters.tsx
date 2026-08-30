"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CategorySummary } from "@fusion-lab/shared-types";
import { usePathname, useRouter } from "@/i18n/navigation";

// Filters write to the URL rather than to local state: the page they
// filter is a Server Component, so the URL is the only thing that can make
// it re-render — and it gives shareable links for free.
export function CatalogFilters({ categories }: { categories: CategorySummary[] }) {
  const t = useTranslations("catalogFilters");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const KINDS = [
    { value: "", label: t("kindAll") },
    { value: "course", label: t("kindCourse") },
    { value: "product", label: t("kindProduct") },
    { value: "book", label: t("kindBook") },
  ];

  const SORTS = [
    { value: "", label: t("sortRelevance") },
    { value: "price_asc", label: t("sortPriceAsc") },
    { value: "price_desc", label: t("sortPriceDesc") },
  ];

  function apply(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());

    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    // Any filter change invalidates the current page number: page 3 of the
    // old result set is usually empty in the new one.
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const activeKind = searchParams.get("kind") ?? "";
  const activeCategory = searchParams.get("category") ?? "";
  const activeSort = searchParams.get("sort") ?? "";

  return (
    <aside className="card h-fit space-y-5 p-5 lg:sticky lg:top-24">
      <div>
        <p className="label">{t("kindLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((kind) => (
            <button
              key={kind.value}
              type="button"
              aria-pressed={activeKind === kind.value}
              onClick={() => apply("kind", kind.value)}
              /* Selection is the accent, not `--foreground`: a dark brown
                 chip reads as a heading rather than as "this one is on",
                 and the same accent already marks the current page in the
                 pager below the results. */
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                activeKind === kind.value
                  ? "border-[var(--accent)] bg-[var(--accent)] font-medium text-white"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              }`}
            >
              {kind.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="category">
          {t("categoryLabel")}
        </label>
        <select
          id="category"
          className="input"
          value={activeCategory}
          onChange={(event) => apply("category", event.target.value)}
        >
          <option value="">{t("allCategories")}</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
              {category.listingCount !== undefined
                ? ` (${category.listingCount})`
                : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="sort">
          {t("sortLabel")}
        </label>
        <select
          id="sort"
          className="input"
          value={activeSort}
          onChange={(event) => apply("sort", event.target.value)}
        >
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
            </option>
          ))}
        </select>
      </div>

      {activeKind || activeCategory || activeSort || searchParams.get("q") ? (
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() => router.push(pathname)}
        >
          {t("resetFilters")}
        </button>
      ) : null}
    </aside>
  );
}
