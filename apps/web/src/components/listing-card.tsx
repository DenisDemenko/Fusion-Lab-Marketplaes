import Link from "next/link";
import type { ListingCard as ListingCardDto } from "@fusion-lab/shared-types";
import { mediaUrl } from "@/lib/api-client";
import { KIND_LABELS } from "@/lib/format";

// Covers come from two places — an uploaded file served by the API, and
// imported catalogue images on a CDN — so a plain <img> is used rather
// than next/image, which would need every possible host declared in
// next.config.ts and would break the moment the API moves.
export function ListingCard({ listing }: { listing: ListingCardDto }) {
  const cover = mediaUrl(listing.coverUrl);

  return (
    <Link
      href={`/catalog/${listing.slug}`}
      className="card group flex h-full flex-col overflow-hidden transition hover:shadow-md"
      data-testid="listing-card"
    >
      <div className="aspect-[16/10] overflow-hidden bg-zinc-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-zinc-400">
            без зображення
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <span className="badge bg-zinc-100 text-zinc-600">
            {KIND_LABELS[listing.kind] ?? listing.kind}
          </span>
          {listing.category ? (
            <span className="badge bg-[var(--accent-soft)] text-[var(--accent)]">
              {listing.category.name}
            </span>
          ) : null}
        </div>

        <h3 className="line-clamp-2 font-semibold leading-snug text-zinc-900">
          {listing.title}
        </h3>

        {listing.summary ? (
          <p className="line-clamp-2 text-sm text-zinc-500">{listing.summary}</p>
        ) : null}

        <div className="mt-auto flex items-end justify-between pt-2">
          <span className="text-lg font-semibold text-zinc-900">
            {listing.priceLabel}
          </span>
          {listing.stock !== null ? (
            <span className="text-xs text-zinc-500">
              {listing.stock > 0 ? `в наявності: ${listing.stock}` : "немає в наявності"}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">{listing.seller?.displayName}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
