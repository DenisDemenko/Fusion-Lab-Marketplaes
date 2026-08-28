"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CategorySummary } from "@fusion-lab/shared-types";

const KINDS = [
  { value: "", label: "Усе" },
  { value: "course", label: "Курси" },
  { value: "product", label: "Вироби" },
  { value: "book", label: "Книги" },
];

const SORTS = [
  { value: "", label: "За релевантністю / новизною" },
  { value: "price_asc", label: "Спочатку дешевші" },
  { value: "price_desc", label: "Спочатку дорожчі" },
];

// Filters write to the URL rather than to local state: the page they
// filter is a Server Component, so the URL is the only thing that can make
// it re-render — and it gives shareable links for free.
export function CatalogFilters({ categories }: { categories: CategorySummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
    <aside className="card h-fit space-y-5 p-5">
      <div>
        <p className="label">Тип</p>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((kind) => (
            <button
              key={kind.value}
              type="button"
              onClick={() => apply("kind", kind.value)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                activeKind === kind.value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-[var(--line)] bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {kind.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="category">
          Категорія
        </label>
        <select
          id="category"
          className="input"
          value={activeCategory}
          onChange={(event) => apply("category", event.target.value)}
        >
          <option value="">Усі категорії</option>
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
          Сортування
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
          Скинути фільтри
        </button>
      ) : null}
    </aside>
  );
}
