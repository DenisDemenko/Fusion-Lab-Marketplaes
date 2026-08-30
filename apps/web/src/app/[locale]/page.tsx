import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ListingCard } from "@/components/listing-card";
import { LabHero } from "@/components/lab-hero";
import { Strands } from "@/components/strands";
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
          {/* h2, not h1 — LabHero above already carries the page's one h1.
              Its type scale was the hero's too (4xl/5xl), so the two read as
              rival headlines stacked; a step down makes the order obvious. */}
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-4xl">
            {t("heroTitle")}
          </h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-[var(--muted)]">
            {t("heroBody")}
          </p>
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

      {/* The hero's "Переглянути напрямки" scrolls here, so this needs to
          announce itself on arrival — a bare pill strip left the reader
          unsure the jump had landed anywhere. */}
      {categories.length > 0 ? (
        <section id="categories" className="scroll-mt-24 border-t border-[var(--line)] py-12">
          <h2 className="section-title">{t("directionsTitle")}</h2>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            {t("directionsBody")}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {categories
              .filter((category) => (category.listingCount ?? 0) > 0)
              .map((category) => (
                <Link
                  key={category.slug}
                  href={`/catalog?category=${category.slug}`}
                  className="group inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                >
                  {category.name}
                  <span className="rounded-full bg-[var(--neutral-bg)] px-2 py-0.5 text-xs text-[var(--muted)] transition-colors group-hover:bg-[var(--surface)]">
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

      {/* Nova is a different product living under /studio (Phase G3), and
          the page never said so — the hero button alone would have been an
          unexplained link. Dark and tech-accented on purpose: it breaks the
          run of light sections and signals "this one is not the shop". */}
      <section className="accent-tech relative my-12 overflow-hidden rounded-2xl bg-[#1f232e]">
        {/* The strands occupy the band's own header strip: the section is
            taller than its content needs so the animation has room to read
            as a picture rather than a stripe behind text. It sits under a
            gradient that dissolves it into the panel colour, so the copy
            below always has flat ground to sit on — legibility does not
            depend on where the waves happen to be. */}
        {/* Twice the height it started at. The shader normalises by the
            canvas height, so a short, very wide strip squeezed the strands
            into a flat line — height is what gives them room, not scale.
            No overlay on top: a scrim was dimming the glow into haze, and
            the shader already outputs alpha from luminance, so everything
            around the ribbons is transparent and the band's own colour
            shows through unaided. */}
        {/* The mobile height is not simply "the desktop one, smaller": at
            375px wide a 28rem strip is taller than it is wide, and since
            the shader normalises by height that turns the ribbons into a
            thread floating in an empty box. Landscape-ish is what the
            effect needs, so the phone gets a short strip. */}
        {/* Shifted up rather than shortened. The ribbons sit in the middle
            of the canvas and the shader scales them by its height, so
            cropping the strip would shrink the animation along with the
            dead space above it. Pulling the same canvas upward throws away
            only the empty part; the section's overflow-hidden does the
            cutting. */}
        <div className="pointer-events-none absolute inset-x-0 -top-8 h-52 sm:-top-32 sm:h-[36rem]">
          <Strands
            colors={["#F97316", "#990c24", "#06B6D4"]}
            count={5}
            speed={0.5}
            amplitude={0.9}
            waviness={1.7}
            thickness={0.8}
            glow={0.75}
            taper={1.9}
            spread={1}
            intensity={0.6}
            saturation={2}
            opacity={1}
            scale={1.5}
            hueShift={0.14}
          />
        </div>

        {/* Clears the ribbons, which sit in the middle of the strip above.
            The rest of that strip is transparent, so the copy overlaps it
            without anything showing through. */}
        <div className="relative grid gap-10 px-6 pt-[9rem] pb-10 sm:px-10 sm:pt-[20rem] sm:pb-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="font-mono text-xs font-medium tracking-widest text-[#aab3c8]">
              {t("studioEyebrow")}
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
              {t("studioTitle")}
            </h2>
            <p className="mt-4 max-w-lg leading-relaxed text-[#c8cedd]">
              {t("studioBody")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                  /studio is a rewrite to Nova, not a page of this app. */}
              <a
                href="/studio"
                className="btn-ghost !border-transparent !bg-white !text-[#1f232e] hover:!bg-[#e3e5ec]"
              >
                {t("studioCta")}
              </a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                  /studio is a rewrite to Nova, not a page of this app. */}
              <a
                href="/studio"
                className="btn-ghost !border-white/30 !bg-transparent !text-white hover:!bg-white/10"
              >
                {t("studioSecondary")}
              </a>
            </div>
          </div>

          <ol className="grid gap-4">
            <StudioStep
              step={1}
              title={t("studioStepSeed")}
              body={t("studioStepSeedBody")}
            />
            <StudioStep
              step={2}
              title={t("studioStepCast")}
              body={t("studioStepCastBody")}
            />
            <StudioStep
              step={3}
              title={t("studioStepPlan")}
              body={t("studioStepPlanBody")}
            />
          </ol>
        </div>
      </section>

      <section className="mb-14 grid gap-6 border-t border-[var(--line)] pt-10 sm:grid-cols-3">
        <Feature
          step={1}
          title={t("featureCardPayment")}
          body={t("featureCardPaymentBody")}
        />
        <Feature
          step={2}
          title={t("featureCardMaterials")}
          body={t("featureCardMaterialsBody")}
        />
        <Feature
          step={3}
          title={t("featureCardSeller")}
          body={t("featureCardSellerBody")}
        />
      </section>
      </div>
    </>
  );
}

function StudioStep({
  step,
  title,
  body,
}: {
  step: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 font-mono text-sm font-semibold text-white">
        {step}
      </span>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-[#aab3c8]">{body}</p>
      </div>
    </li>
  );
}

// The three closing cards were plain paragraphs in one box, which read as a
// footnote rather than three distinct promises. The rule and the numeral
// give each one a start.
function Feature({
  step,
  title,
  body,
}: {
  step: number;
  title: string;
  body: string;
}) {
  return (
    <div className="border-t-2 border-[var(--accent)] pt-4">
      <span className="font-mono text-xs font-semibold text-[var(--accent)]">
        0{step}
      </span>
      <p className="mt-2 font-display font-semibold text-[var(--foreground)]">
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
        {body}
      </p>
    </div>
  );
}
