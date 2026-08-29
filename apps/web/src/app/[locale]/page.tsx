import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ListingCard } from "@/components/listing-card";
import { fetchCategories, searchCatalog } from "@/lib/server-api";

// Server-rendered: the storefront has no user-specific content, so it is
// fetched on the server and arrives as HTML — which is also what makes it
// indexable.
export default async function HomePage() {
  const t = await getTranslations("homePage");
  const [featured, courses, categories] = await Promise.all([
    searchCatalog({ perPage: "8" }),
    searchCatalog({ kind: "course", perPage: "4" }),
    fetchCategories(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid gap-8 py-14 md:grid-cols-2 md:items-center md:py-20">
        <div>
          <span className="badge bg-[var(--accent-soft)] text-[var(--accent)]">
            {t("badgeLine")}
          </span>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 text-lg text-zinc-600">{t("heroBody")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/catalog" className="btn-primary">
              {t("browseCatalog")}
            </Link>
            <Link href="/seller" className="btn-ghost">
              {t("sellYourCourses")}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {courses.items.slice(0, 4).map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="pb-4">
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((category) => (category.listingCount ?? 0) > 0)
              .map((category) => (
                <Link
                  key={category.slug}
                  href={`/catalog?category=${category.slug}`}
                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-zinc-700 hover:border-zinc-400"
                >
                  {category.name}
                  <span className="ml-2 text-zinc-400">
                    {category.listingCount}
                  </span>
                </Link>
              ))}
          </div>
        </section>
      ) : null}

      <section className="py-10">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="section-title">{t("newInCatalog")}</h2>
          <Link
            href="/catalog"
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            {t("viewAll")}
          </Link>
        </div>

        {featured.items.length === 0 ? (
          <p className="card p-10 text-center text-zinc-500">
            {t("emptyCatalogBefore")}{" "}
            <code className="mx-1 rounded bg-zinc-100 px-1.5 py-0.5 text-sm">
              npm run db:seed
            </code>
            {t("emptyCatalogAfter")}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <section className="card my-10 grid gap-6 p-8 sm:grid-cols-3">
        <Feature title={t("featureCardPayment")} body={t("featureCardPaymentBody")} />
        <Feature
          title={t("featureCardMaterials")}
          body={t("featureCardMaterialsBody")}
        />
        <Feature title={t("featureCardSeller")} body={t("featureCardSellerBody")} />
      </section>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-semibold text-zinc-900">{title}</p>
      <p className="mt-1.5 text-sm text-zinc-600">{body}</p>
    </div>
  );
}
