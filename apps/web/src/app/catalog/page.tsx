import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { CatalogFilters } from "@/components/catalog-filters";
import { fetchCategories, searchCatalog } from "@/lib/server-api";

export const metadata = {
  title: "Каталог — Fusion Lab",
};

// searchParams is the whole state of this screen: filters are links, so a
// filtered catalogue can be shared, bookmarked and rendered on the server.
export default async function CatalogPage({
  searchParams,
}: PageProps<"/catalog">) {
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
        {query.q ? `Пошук: «${query.q}»` : "Каталог"}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Знайдено позицій: {results.total}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <CatalogFilters categories={categories} />

        <div>
          {results.items.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="font-medium text-zinc-900">Нічого не знайшлося</p>
              <p className="mt-1 text-sm text-zinc-500">
                Спробуйте інші слова або зніміть фільтри.
              </p>
              <Link href="/catalog" className="btn-ghost mt-4">
                Скинути пошук
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
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-[var(--line)] bg-white text-zinc-700 hover:bg-zinc-50"
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
