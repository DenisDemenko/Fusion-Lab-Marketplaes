import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { ListingReviews } from "@/components/listing-reviews";
import { MessageSellerButton } from "@/components/message-seller-button";
import { mediaUrl } from "@/lib/api-client";
import { formatBytes } from "@/lib/format";
import { fetchListing } from "@/lib/server-api";
import { accentClassForCategory } from "@/lib/category-accent";

function uaLabel(label: string, locale: Locale) {
  return locale === "en" ? label.replace("грн", "UAH") : label;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/catalog/[slug]">) {
  const { slug } = await params;
  const listing = await fetchListing(slug);
  const t = await getTranslations("catalogDetail");

  return {
    title: listing ? `${listing.title} — Fusion Lab` : t("metaNotFound"),
    description: listing?.summary ?? undefined,
  };
}

export default async function ListingPage({ params }: PageProps<"/[locale]/catalog/[slug]">) {
  const { slug } = await params;
  const listing = await fetchListing(slug);

  if (!listing) notFound();

  const t = await getTranslations("catalogDetail");
  const tKind = await getTranslations("enums.kind");
  const locale = (await getLocale()) as Locale;

  const cover = mediaUrl(listing.coverUrl);
  const curriculum = listing.curriculum;

  return (
    <div
      className={`mx-auto max-w-6xl px-4 py-8 ${accentClassForCategory(listing.category?.slug)}`}
    >
      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href="/catalog" className="hover:text-[var(--foreground)]">
          {t("breadcrumbCatalog")}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--foreground)]">{listing.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          <div className="card overflow-hidden">
            <div className="aspect-[16/9] bg-[var(--neutral-bg)]">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="badge bg-[var(--neutral-bg)] text-[var(--muted)]">
              {tKind(listing.kind)}
            </span>
            {listing.category ? (
              <Link
                href={`/catalog?category=${listing.category.slug}`}
                className="badge bg-[var(--accent-soft)] text-[var(--accent)]"
              >
                {listing.category.name}
              </Link>
            ) : null}
            {listing.seller ? (
              <span className="text-sm text-[var(--muted)]">
                {t("sellerLabel", { name: listing.seller.displayName })}
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            {listing.title}
          </h1>
          {listing.subtitle ? (
            <p className="mt-2 text-lg text-[var(--muted)]">{listing.subtitle}</p>
          ) : null}

          {listing.highlights.length > 0 ? (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {listing.highlights.map((highlight, index) => (
                <li
                  key={index}
                  className="rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm text-[var(--foreground)]"
                >
                  {highlight}
                </li>
              ))}
            </ul>
          ) : null}

          {listing.description ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("aboutTitle")}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-[var(--foreground)]">
                {listing.description}
              </p>
            </section>
          ) : null}

          {curriculum?.targetAudience?.length ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                {t("targetAudienceTitle")}
              </h2>
              <ul className="mt-2 list-inside list-disc space-y-1 text-[var(--foreground)]">
                {curriculum.targetAudience.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {curriculum?.results?.length ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                {t("resultsTitle")}
              </h2>
              <ul className="mt-2 list-inside list-disc space-y-1 text-[var(--foreground)]">
                {curriculum.results.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {curriculum?.modules?.length ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                {t("curriculumTitle")}
              </h2>
              <div className="mt-3 space-y-2">
                {curriculum.modules.map((module, index) => (
                  <details
                    key={index}
                    className="card overflow-hidden"
                    open={index === 0}
                  >
                    <summary className="cursor-pointer px-4 py-3 font-medium text-[var(--foreground)]">
                      {module.title}
                      <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                        {t("lessonsCount", { count: module.lessons?.length ?? 0 })}
                      </span>
                    </summary>
                    <ol className="space-y-3 border-t border-[var(--line)] px-4 py-3">
                      {module.lessons?.map((lesson, lessonIndex) => (
                        <li key={lessonIndex}>
                          <p className="font-medium text-[var(--foreground)]">
                            {lesson.title}
                          </p>
                          {lesson.goal ? (
                            <p className="text-sm text-[var(--muted)]">
                              {t("goalLabel", { goal: lesson.goal })}
                            </p>
                          ) : null}
                          {lesson.practice ? (
                            <p className="text-sm text-[var(--muted)]">
                              {t("practiceLabel", { practice: lesson.practice })}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          <ListingReviews listingId={listing.id} />
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="card space-y-4 p-5">
            <p className="text-3xl font-semibold text-[var(--foreground)]">
              {uaLabel(listing.priceLabel, locale)}
            </p>

            {listing.stock !== null ? (
              <p className="text-sm text-[var(--muted)]">
                {listing.stock > 0
                  ? t("inStock", { count: listing.stock })
                  : t("outOfStock")}
              </p>
            ) : null}

            <AddToCart listing={listing} />

            {listing.seller ? (
              <MessageSellerButton listingId={listing.id} />
            ) : null}

            {/* Paid files are listed before purchase on purpose: knowing
                what arrives after payment is part of the decision. The
                links themselves only exist after an entitlement. */}
            {listing.lockedMedia.length > 0 ? (
              <div className="border-t border-[var(--line)] pt-4">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {t("afterPaymentTitle")}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {listing.lockedMedia.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between gap-2 text-sm text-[var(--muted)]"
                    >
                      <span className="truncate">{file.filename}</span>
                      <span className="shrink-0 text-[var(--muted)]">
                        {formatBytes(file.sizeBytes, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {listing.externalSource === "book_creality" ? (
              <p className="border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">
                {t("bookCrealitySource")}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
