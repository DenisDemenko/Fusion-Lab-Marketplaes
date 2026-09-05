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

// Four sections here repeated the same inline heading classes, so a change
// to one silently left the others behind. The rule above each is what
// separates them now — this page is a long read, and the sections had
// nothing but a margin between them.
function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-[var(--line)] pt-6">
      <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--foreground)]">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

// Browser discs in the theme's grey read as an afterthought next to the
// rest of the page; a small accent square ties these lists to the
// category colour the whole page is tinted with.
function MarkedList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-[var(--foreground)]">
          <span
            aria-hidden
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-[2px] bg-[var(--accent)]"
          />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
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
      <nav
        aria-label={t("breadcrumbCatalog")}
        className="mb-6 flex items-center gap-2 text-sm text-[var(--muted)]"
      >
        <Link
          href="/catalog"
          className="transition-colors hover:text-[var(--accent)]"
        >
          {t("breadcrumbCatalog")}
        </Link>
        <span aria-hidden className="text-[var(--line)]">
          /
        </span>
        {/* Truncated: a long listing title used to wrap the breadcrumb onto
            a second line and push the whole page down. */}
        <span className="truncate text-[var(--foreground)]">
          {listing.title}
        </span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          <div className="card overflow-hidden">
            {/*
              КНИГА НЕ ВЛІЗАЄ В ЛАНДШАФТНУ РАМКУ. Обкладинка книги —
              вертикальна (наша, зібрана Студією, рівно 2:3), а рамка була
              16:9 з `object-cover`: у кадр потрапляла тільки середня смуга,
              і покупець бачив книгу без назви — її зрізало згори.

              Тому для книги рамка не задає пропорцію взагалі: зображення
              показується цілим (`object-contain`), по центру, і обмежене
              лише висотою екрана, щоб на широкому моніторі не виросло на
              півтори сторінки. Для решти товарів усе лишається як було:
              фото виробу в ландшафтній рамці кадрується осмислено, і
              міняти це немає причин.
            */}
            {listing.kind === "book" ? (
              <div className="flex items-center justify-center bg-[var(--neutral-bg)] p-4">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt=""
                    className="max-h-[70vh] w-auto max-w-full object-contain"
                  />
                ) : null}
              </div>
            ) : (
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
            )}

            {/* Free sample, directly under the cover.
                The cover says what the book is; these pages show how it is
                written, and that is what the decision actually turns on. So
                the link sits on the cover card itself — the first thing the
                eye reaches after the picture — rather than further down
                among prices and technical details.

                A plain <a> to the file, not a viewer: the buyer downloads
                the same PDF the book is made of and reads it in whatever
                they normally read PDFs. Building a reader here would add a
                dependency and a way to fail, and would still be worse than
                the reader they already use.

                No target="_blank": media.controller.ts serves everything
                that is not an image with `Content-Disposition: attachment`,
                so this downloads without navigating. A blank tab would open
                and close again for nothing. */}
            {(() => {
              const sample = listing.media.find((asset) => asset.kind === "sample");
              if (!sample) return null;
              const href = mediaUrl(sample.downloadUrl);
              return href ? (
                <a
                  href={href}
                  download={sample.filename}
                  className="flex flex-col items-center gap-0.5 border-t border-[var(--line)] px-4 py-3 text-center hover:bg-[var(--neutral-bg)]"
                >
                  <span className="text-sm font-semibold">{t("readSample")}</span>
                  <span className="text-xs text-[var(--muted)]">{t("readSampleHint")}</span>
                </a>
              ) : null;
            })()}
          </div>

          {/* Additional public images (docs/migration-plan.md Phase D4) —
              the cover itself also carries kind "cover" in this same
              array, so it's excluded here to avoid showing it twice. */}
          {listing.media.filter((asset) => asset.kind === "gallery").length > 0 ? (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {listing.media
                .filter((asset) => asset.kind === "gallery")
                .map((image) => (
                  <div
                    key={image.id}
                    className="aspect-square overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--neutral-bg)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaUrl(image.downloadUrl) ?? ""}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
            </div>
          ) : null}

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
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)]"
                >
                  {highlight}
                </li>
              ))}
            </ul>
          ) : null}

          {listing.description ? (
            <DetailSection title={t("aboutTitle")}>
              <p className="whitespace-pre-line leading-relaxed text-[var(--foreground)]">
                {listing.description}
              </p>
            </DetailSection>
          ) : null}

          {curriculum?.targetAudience?.length ? (
            <DetailSection title={t("targetAudienceTitle")}>
              <MarkedList items={curriculum.targetAudience} />
            </DetailSection>
          ) : null}

          {curriculum?.results?.length ? (
            <DetailSection title={t("resultsTitle")}>
              <MarkedList items={curriculum.results} />
            </DetailSection>
          ) : null}

          {curriculum?.modules?.length ? (
            <section className="mt-10 border-t border-[var(--line)] pt-6">
              <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--foreground)]">
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
            {/* The price is the one number the whole panel exists for, so
                it gets the display face and an accent rule rather than
                sitting as one more paragraph in the stack. */}
            <p className="border-l-2 border-[var(--accent)] pl-3 font-display text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {uaLabel(listing.priceLabel, locale)}
            </p>

            {listing.stock !== null ? (
              <p
                className={`text-sm ${
                  listing.stock > 0
                    ? "text-[var(--muted)]"
                    : "font-medium text-[var(--danger)]"
                }`}
              >
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
