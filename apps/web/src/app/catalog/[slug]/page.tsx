import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { mediaUrl } from "@/lib/api-client";
import { KIND_LABELS, formatBytes } from "@/lib/format";
import { fetchListing } from "@/lib/server-api";

export async function generateMetadata({ params }: PageProps<"/catalog/[slug]">) {
  const { slug } = await params;
  const listing = await fetchListing(slug);

  return {
    title: listing ? `${listing.title} — Fusion Lab` : "Не знайдено — Fusion Lab",
    description: listing?.summary ?? undefined,
  };
}

export default async function ListingPage({ params }: PageProps<"/catalog/[slug]">) {
  const { slug } = await params;
  const listing = await fetchListing(slug);

  if (!listing) notFound();

  const cover = mediaUrl(listing.coverUrl);
  const curriculum = listing.curriculum;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/catalog" className="hover:text-zinc-900">
          Каталог
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700">{listing.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          <div className="card overflow-hidden">
            <div className="aspect-[16/9] bg-zinc-100">
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
            <span className="badge bg-zinc-100 text-zinc-600">
              {KIND_LABELS[listing.kind] ?? listing.kind}
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
              <span className="text-sm text-zinc-500">
                Продавець: {listing.seller.displayName}
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
            {listing.title}
          </h1>
          {listing.subtitle ? (
            <p className="mt-2 text-lg text-zinc-600">{listing.subtitle}</p>
          ) : null}

          {listing.highlights.length > 0 ? (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {listing.highlights.map((highlight, index) => (
                <li
                  key={index}
                  className="rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm text-zinc-700"
                >
                  {highlight}
                </li>
              ))}
            </ul>
          ) : null}

          {listing.description ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-zinc-900">Про що це</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-700">
                {listing.description}
              </p>
            </section>
          ) : null}

          {curriculum?.targetAudience?.length ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-zinc-900">Для кого</h2>
              <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-700">
                {curriculum.targetAudience.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {curriculum?.results?.length ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-zinc-900">
                Результати навчання
              </h2>
              <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-700">
                {curriculum.results.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {curriculum?.modules?.length ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold text-zinc-900">Програма</h2>
              <div className="mt-3 space-y-2">
                {curriculum.modules.map((module, index) => (
                  <details
                    key={index}
                    className="card overflow-hidden"
                    open={index === 0}
                  >
                    <summary className="cursor-pointer px-4 py-3 font-medium text-zinc-900">
                      {module.title}
                      <span className="ml-2 text-sm font-normal text-zinc-500">
                        {module.lessons?.length ?? 0} занять
                      </span>
                    </summary>
                    <ol className="space-y-3 border-t border-[var(--line)] px-4 py-3">
                      {module.lessons?.map((lesson, lessonIndex) => (
                        <li key={lessonIndex}>
                          <p className="font-medium text-zinc-800">
                            {lesson.title}
                          </p>
                          {lesson.goal ? (
                            <p className="text-sm text-zinc-600">
                              Мета: {lesson.goal}
                            </p>
                          ) : null}
                          {lesson.practice ? (
                            <p className="text-sm text-zinc-500">
                              Практика: {lesson.practice}
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
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="card space-y-4 p-5">
            <p className="text-3xl font-semibold text-zinc-900">
              {listing.priceLabel}
            </p>

            {listing.stock !== null ? (
              <p className="text-sm text-zinc-500">
                {listing.stock > 0
                  ? `В наявності: ${listing.stock} шт.`
                  : "Наразі немає в наявності"}
              </p>
            ) : null}

            <AddToCart listing={listing} />

            {/* Paid files are listed before purchase on purpose: knowing
                what arrives after payment is part of the decision. The
                links themselves only exist after an entitlement. */}
            {listing.lockedMedia.length > 0 ? (
              <div className="border-t border-[var(--line)] pt-4">
                <p className="text-sm font-medium text-zinc-900">
                  Після оплати ви отримаєте
                </p>
                <ul className="mt-2 space-y-1.5">
                  {listing.lockedMedia.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between gap-2 text-sm text-zinc-600"
                    >
                      <span className="truncate">{file.filename}</span>
                      <span className="shrink-0 text-zinc-400">
                        {formatBytes(file.sizeBytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {listing.externalSource === "book_creality" ? (
              <p className="border-t border-[var(--line)] pt-4 text-xs text-zinc-500">
                Книгу створено в Book_Creality і опубліковано сюди через
                API-міст.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
