import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ListingCard } from "@/components/listing-card";
import { CatalogFilters } from "@/components/catalog-filters";
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
      <h1 className="section-title">
        {query.q ? t("searchTitle", { query: query.q }) : t("title")}
      </h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {t("foundCount", { count: results.total })}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
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
                <nav className="mt-8 flex items-center justify-center gap-2">
                  {Array.from({ length: results.pages }, (_, index) => index + 1).map(
                    (number) => (
                      <Link
                        key={number}
                        href={`/catalog?${withParam(params, "page", String(number))}`}
                        className={`rounded-xl border px-3.5 py-2 text-sm ${
                          number === page
                            ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                            : "border-[var(--line)] bg-white text-[var(--foreground)] hover:bg-[var(--neutral-bg)]"
                        }`}
                      >
                        {number}
                      </Link>
                    ),
                  )}
                </nav>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
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
