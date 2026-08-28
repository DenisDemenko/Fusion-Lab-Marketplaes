import type {
  Listing,
  MediaAsset,
  SellerProfile,
  Category,
} from '@prisma/client';
import { formatUah } from '../common/money';

type ListingWithRelations = Listing & {
  seller?: SellerProfile | null;
  category?: Category | null;
  media?: MediaAsset[];
};

// One shape for the catalog card everywhere it appears — grid, cart line,
// seller dashboard, AI assistant answer — so the frontend never has to
// branch on which endpoint a listing came from.
export function toListingCard(listing: ListingWithRelations) {
  return {
    id: listing.id,
    slug: listing.slug,
    kind: listing.kind,
    status: listing.status,
    title: listing.title,
    subtitle: listing.subtitle,
    summary: listing.summary,
    priceMinor: listing.priceMinor,
    priceLabel: formatUah(listing.priceMinor),
    currency: listing.currency,
    coverUrl: coverUrlFor(listing),
    stock: listing.stock,
    highlights: listing.highlights,
    publishedAt: listing.publishedAt,
    createdAt: listing.createdAt,
    seller: listing.seller
      ? {
          id: listing.seller.id,
          displayName: listing.seller.displayName,
          slug: listing.seller.slug,
        }
      : null,
    category: listing.category
      ? { slug: listing.category.slug, name: listing.category.name }
      : null,
  };
}

export function toListingDetail(listing: ListingWithRelations) {
  const media = listing.media ?? [];

  return {
    ...toListingCard(listing),
    description: listing.description,
    curriculum: listing.curriculum,
    externalSource: listing.externalSource,
    // Public assets are listed with their download URL; paid assets are
    // listed WITHOUT one — the buyer must be able to see what they get
    // ("3 files, 12 MB") before paying, but the bytes stay behind
    // GET /media/:id/download, which checks entitlement.
    media: media
      .filter((asset) => asset.access === 'public')
      .map(toMediaSummary),
    lockedMedia: media
      .filter((asset) => asset.access === 'entitled')
      .map(({ id, kind, filename, mimeType, sizeBytes }) => ({
        id,
        kind,
        filename,
        mimeType,
        sizeBytes,
      })),
  };
}

export function toMediaSummary(asset: MediaAsset) {
  return {
    id: asset.id,
    kind: asset.kind,
    access: asset.access,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    downloadCount: asset.downloadCount,
    downloadUrl: `/media/${asset.id}/download`,
    createdAt: asset.createdAt,
  };
}

// An uploaded cover wins over the seed/import URL, so replacing the image
// in the seller cabinet is enough — no second field to remember to clear.
function coverUrlFor(listing: ListingWithRelations): string | null {
  const uploaded = listing.media?.find((asset) => asset.kind === 'cover');
  if (uploaded) return `/media/${uploaded.id}/download`;
  return listing.coverUrl ?? null;
}
