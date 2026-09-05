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
    // videoUrl stripped: this is the anonymous/pre-purchase view, same
    // rule as lockedMedia below — a buyer sees that a lesson HAS a video
    // (curriculum.modules[].lessons[].title is still there), but not the
    // link itself. See EntitlementsService.item for the entitled view
    // that keeps it, and docs/migration-plan.md Phase D2 on why "stripped
    // from the API response" and "hidden in the UI" are different claims.
    curriculum: stripVideoUrls(listing.curriculum),
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

// The seller's own view of their listing. Unlike toListingDetail (built
// for anonymous buyers, who must not see a download link for something
// they have not paid for), the owner is allowed to see and manage every
// file regardless of access level — full MediaSummary, cover and paid
// attachments alike, so the cabinet can show file size, download counts,
// and offer deletion.
export function toOwnerListingDetail(listing: ListingWithRelations) {
  const media = listing.media ?? [];

  return {
    ...toListingCard(listing),
    description: listing.description,
    curriculum: listing.curriculum,
    externalSource: listing.externalSource,
    rejectionReason: listing.rejectionReason,
    cover: media.find((asset) => asset.kind === 'cover')
      ? toMediaSummary(media.find((asset) => asset.kind === 'cover')!)
      : null,
    // Split out from attachments (Phase D4) so the cabinet can offer a
    // distinct "gallery" section instead of mixing marketing images in
    // with paid course files.
    gallery: media
      .filter((asset) => asset.kind === 'gallery')
      .map(toMediaSummary),
    // The free sample is public by definition, so it must not sit among
    // "files for buyers" in the cabinet — that heading would be a lie about
    // who can read it. Its own field instead: visible to the owner, grouped
    // honestly.
    sample: media.find((asset) => asset.kind === 'sample')
      ? toMediaSummary(media.find((asset) => asset.kind === 'sample')!)
      : null,
    attachments: media
      .filter(
        (asset) =>
          asset.kind !== 'cover' &&
          asset.kind !== 'gallery' &&
          asset.kind !== 'sample',
      )
      .map(toMediaSummary),
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

interface CurriculumLessonJson {
  title?: unknown;
  videoUrl?: unknown;
  [key: string]: unknown;
}

interface CurriculumModuleJson {
  lessons?: CurriculumLessonJson[];
  [key: string]: unknown;
}

interface CurriculumJson {
  modules?: CurriculumModuleJson[];
  [key: string]: unknown;
}

function isCurriculumJson(value: unknown): value is CurriculumJson {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as CurriculumJson).modules)
  );
}

// Deep-clones curriculum with every lesson's videoUrl removed. Structural
// typing only (this runs on a Prisma Json? column, not the shared
// Curriculum type) — anything that isn't shaped like {modules:[{lessons:
// [...]}]} passes through unchanged rather than throwing, since a listing
// with no curriculum, or a malformed one from a bridge import, must not
// break the whole catalog response over a field this function does not
// need to touch.
function stripVideoUrls(curriculum: unknown): unknown {
  if (!isCurriculumJson(curriculum)) return curriculum;

  return {
    ...curriculum,
    modules: (curriculum.modules ?? []).map((module) => {
      if (!Array.isArray(module.lessons)) return module;

      return {
        ...module,
        lessons: module.lessons.map((lesson): CurriculumLessonJson => {
          const { videoUrl, ...rest } = lesson;
          void videoUrl;
          return rest;
        }),
      };
    }),
  };
}
