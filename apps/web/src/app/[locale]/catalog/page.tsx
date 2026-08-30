import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ListingCard } from "@/components/listing-card";
import { CatalogFilters } from "@/components/catalog-filters";
import { PageHeader } from "@/components/page-header";
import { fetchCategories, searchCatalog } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("catalogPage");
  return {
    title: t("metaTitle"),
  };
}

// searchParams is the whole state of this screen: filters are links, so a
// filtered catalogue can be shared, bookmarked and rendered on the server.
export default async function CatalogPage({
  searchParams,
}: PageProps<"/[locale]/catalog">) {
  const t = await getTranslations("catalogPage");
  const params = await searchParams;
  const query = {
    q: single(params.q),
    kind: single(params.kind),
    category: single(params.category),
    sort: single(params.sort),
    page: single(params.page),
    perPage: "12",
  };

  const [results, categories] = await Promise.all([
    searchCatalog(query),
    fetchCategories(),
  ]);

  const page = results.page;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        // Only while searching: unfiltered, the title is already "Каталог"
        // and an eyebrow saying the same word twice is noise. With a query
        // the title becomes the search phrase, and then the eyebrow is what
        // says where you are.
        eyebrow={query.q ? t("eyebrow") : undefined}
        title={query.q ? t("searchTitle", { query: query.q }) : t("title")}
        // The blurb is dropped once a search is running: at that point the
        // reader wants the count, not an introduction to the page.
        description={query.q ? undefined : t("description")}
        actions={
          <p className="font-mono text-sm text-[var(--muted)]">
            {t("foundCount", { count: results.total })}
          </p>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <CatalogFilters categories={categories} />

        <div>
          {results.items.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="font-medium text-[var(--foreground)]">{t("emptyTitle")}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{t("emptyBody")}</p>
              <Link href="/catalog" className="btn-ghost mt-4">
                {t("resetSearch")}
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.items.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>

              {results.pages > 1 ? (
                <nav className="mt-10 flex flex-wrap items-center justify-center gap-2">
                  <PageLink
                    params={params}
                    page={page - 1}
                    disabled={page <= 1}
                    label={t("pagePrev")}
                  />

                  {pageWindow(page, results.pages).map((entry, index) =>
                    entry === null ? (
                      <span
                        key={`gap-${index}`}
                        className="px-1 text-sm text-[var(--muted)]"
                        aria-hidden
                      >
                        …
                      </span>
                    ) : (
                      <PageLink
                        key={entry}
                        params={params}
                        page={entry}
                        current={entry === page}
                        label={String(entry)}
                      />
                    ),
                  )}

                  <PageLink
                    params={params}
                    page={page + 1}
                    disabled={page >= results.pages}
                    label={t("pageNext")}
                  />
                </nav>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// The pager used to print every page number. That is fine at three pages
// and unusable at forty — the row wraps into a block of digits that pushes
// the footer off screen. This keeps first, last, current and its
// neighbours, and marks the cuts with `null` for the caller to render as
// an ellipsis.
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const out: (number | null)[] = [];
  let previous = 0;

  for (const page of sorted) {
    if (previous && page - previous > 1) out.push(null);
    out.push(page);
    previous = page;
  }

  return out;
}

function PageLink({
  params,
  page,
  label,
  current = false,
  disabled = false,
}: {
  params: Record<string, string | string[] | undefined>;
  page: number;
  label: string;
  current?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-xl border border-[var(--line)] px-3.5 py-2 text-sm text-[var(--muted)] opacity-50">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={`/catalog?${withParam(params, "page", String(page))}`}
      aria-current={current ? "page" : undefined}
      className={`rounded-xl border px-3.5 py-2 text-sm transition-colors ${
        current
          ? "border-[var(--accent)] bg-[var(--accent)] font-semibold text-white"
          : "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
      }`}
    >
      {label}
    </Link>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function withParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
  value: string,
): string {
  const next = new URLSearchParams();

  for (const [name, raw] of Object.entries(params)) {
    const current = single(raw);
    if (current) next.set(name, current);
  }

  next.set(key, value);
  return next.toString();
}
