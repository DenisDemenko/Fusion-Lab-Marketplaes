import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ListingCard } from "@/components/listing-card";
import { LabHero } from "@/components/lab-hero";
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
    <>
      {/* docs/migration-plan.md Phase C: the lab's original hero sits above
          the marketplace's own — see LabHero for why its CTAs point where
          they do. */}
      <LabHero />

      <div className="mx-auto max-w-6xl px-4">
      <section className="grid gap-8 py-14 md:grid-cols-2 md:items-center md:py-20">
        <div>
          <span className="badge bg-[var(--accent-soft)] text-[var(--accent)]">
            {t("badgeLine")}
          </span>
          {/* h2, not h1 — LabHero above already carries the page's one h1. */}
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-5xl">
            {t("heroTitle")}
          </h2>
          <p className="mt-4 text-lg text-[var(--muted)]">{t("heroBody")}</p>
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
        <section id="categories" className="scroll-mt-20 pb-4">
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((category) => (category.listingCount ?? 0) > 0)
              .map((category) => (
                <Link
                  key={category.slug}
                  href={`/catalog?category=${category.slug}`}
                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--foreground)] hover:border-[var(--muted)]"
                >
                  {category.name}
                  <span className="ml-2 text-[var(--muted)]">
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
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {t("viewAll")}
          </Link>
        </div>

        {featured.items.length === 0 ? (
          <p className="card p-10 text-center text-[var(--muted)]">
            {t("emptyCatalogBefore")}{" "}
            <code className="mx-1 rounded bg-[var(--neutral-bg)] px-1.5 py-0.5 text-sm">
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
    </>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-1.5 text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}
