import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { uniqueSlug } from '../common/slug';
import { toListingCard } from '../catalog/listing.mapper';
import type { PublishBookDto } from './bridge.dto';

export const BOOK_SOURCE = 'book_creality';

// 50 MB, the same ceiling sellers get. A typeset book with images lands
// well under it; anything above is a sign of an unoptimised export, not of
// a book.
export const BRIDGE_MAX_FILE_BYTES = 50 * 1024 * 1024;

// Deliberately narrow. The bridge publishes finished editions, and the
// formats a buyer expects to open are these three — an arbitrary binary
// arriving over a machine-to-machine channel is a mistake, not a feature.
export const BRIDGE_ALLOWED_MIME = new Set([
  'application/pdf',
  'application/epub+zip',
  'application/x-mobipocket-ebook',
]);

// A cover is a different kind of file with different rules: it is public by
// definition (the catalog card shows it to everyone), and only images make
// sense. Sending an epub as a cover is a mistake, not a preference.
export const BRIDGE_ALLOWED_COVER_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

// A free sample: the opening pages of the book, readable by anyone before
// buying. Public like a cover, but a document like the book itself — a
// buyer decides on the prose, not on the description. Only PDF: the sample
// is cut from the very file the buyer would get, so it is always a PDF.
export const BRIDGE_ALLOWED_SAMPLE_MIME = new Set(['application/pdf']);

export type BridgeFileKind = 'attachment' | 'cover' | 'sample';

// Public means "shown before purchase". The cover sells the book, the
// sample proves it; the book file itself stays behind the entitlement.
const PUBLIC_KINDS: ReadonlySet<BridgeFileKind> = new Set<BridgeFileKind>(['cover', 'sample']);

// The API bridge from ADR 0001: Book_Creality owns the book, this
// marketplace only lists and sells it. Nothing here edits book content —
// a re-publish overwrites the mirrored fields and that is the whole
// contract.
@Injectable()
export class BridgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Machine-to-machine, so no Firebase token exists. A shared secret in a
  // header is the right weight for one trusted caller; it is compared in
  // full and the endpoint refuses to work at all when unset, so a deploy
  // that forgets the variable is closed, not open.
  assertBridgeKey(presented?: string) {
    const expected = process.env.BRIDGE_API_KEY;

    if (!expected) {
      throw new UnauthorizedException(
        'BRIDGE_API_KEY не налаштований — міст вимкнено',
      );
    }

    if (!presented || presented !== expected) {
      throw new UnauthorizedException('Невірний ключ мосту');
    }
  }

  async publishBook(dto: PublishBookDto) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { slug: dto.sellerSlug ?? process.env.BRIDGE_SELLER_SLUG ?? '' },
    });

    if (!seller) {
      throw new BadRequestException(
        'Не знайдено продавця для книг: передайте sellerSlug або задайте BRIDGE_SELLER_SLUG',
      );
    }

    const existing = await this.prisma.listing.findUnique({
      where: {
        externalSource_externalId: {
          externalSource: BOOK_SOURCE,
          externalId: dto.externalId,
        },
      },
    });

    const data = {
      title: dto.title,
      subtitle: dto.subtitle,
      summary: dto.summary,
      description: dto.description,
      priceMinor: dto.priceMinor,
      coverUrl: dto.coverUrl,
      highlights: dto.highlights ?? [],
    };

    // Books arrive from a system we control and already reviewed, so they
    // land published — the moderation queue exists for third-party
    // sellers, and putting our own pipeline in it would only add a manual
    // click between "book finished" and "book on sale".
    const listing = existing
      ? await this.prisma.listing.update({
          where: { id: existing.id },
          data: { ...data, status: 'published' },
          include: { seller: true, category: true, media: true },
        })
      : await this.prisma.listing.create({
          data: {
            ...data,
            slug: await uniqueSlug(dto.title, async (candidate) =>
              Boolean(
                await this.prisma.listing.findUnique({
                  where: { slug: candidate },
                }),
              ),
            ),
            kind: 'book',
            status: 'published',
            publishedAt: new Date(),
            sellerId: seller.id,
            externalSource: BOOK_SOURCE,
            externalId: dto.externalId,
          },
          include: { seller: true, category: true, media: true },
        });

    return { created: !existing, listing: toListingCard(listing) };
  }

  // What the bridge currently has on the shelf. Without this the studio can
  // only guess: it knows what it sent, not what survived — a listing may have
  // been archived by an admin, or published from another machine.
  async listBooks() {
    const listings = await this.prisma.listing.findMany({
      where: { externalSource: BOOK_SOURCE },
      include: { media: true, seller: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return {
      books: listings.map((listing) => ({
        externalId: listing.externalId,
        slug: listing.slug,
        title: listing.title,
        status: listing.status,
        priceMinor: listing.priceMinor,
        sellerSlug: listing.seller?.slug ?? null,
        publishedAt: listing.publishedAt,
        // Чи є що завантажити покупцеві — головне питання про лістинг книги.
        hasFile: listing.media.some((asset) => asset.kind === 'attachment'),
        fileName: listing.media.find((asset) => asset.kind === 'attachment')?.filename ?? null,
      })),
    };
  }

  // The buyer-facing half of the bridge: a published book is not a product
  // until there is something to download. Sellers upload through
  // POST /seller/listings/:id/media with a Firebase token; the bridge has
  // no user, so it needs its own door — same storage, same MediaAsset, but
  // authenticated by the shared secret like the rest of /bridge.
  async attachBookFile(
    externalId: string,
    file?: Express.Multer.File,
    kind: BridgeFileKind = 'attachment',
  ) {
    if (!file) {
      throw new BadRequestException('Файл не надіслано (поле "file")');
    }
    if (file.size > BRIDGE_MAX_FILE_BYTES) {
      throw new BadRequestException(
        `Файл завеликий: ${file.size} байт, максимум ${BRIDGE_MAX_FILE_BYTES}`,
      );
    }
    const allowed =
      kind === 'cover'
        ? BRIDGE_ALLOWED_COVER_MIME
        : kind === 'sample'
          ? BRIDGE_ALLOWED_SAMPLE_MIME
          : BRIDGE_ALLOWED_MIME;
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException(
        kind === 'cover'
          ? `Обкладинка має бути зображенням, а не ${file.mimetype}`
          : kind === 'sample'
            ? `Уривок має бути PDF, а не ${file.mimetype}`
            : `Тип файлу не підтримується: ${file.mimetype}`,
      );
    }

    const listing = await this.prisma.listing.findUnique({
      where: {
        externalSource_externalId: {
          externalSource: BOOK_SOURCE,
          externalId,
        },
      },
      include: { seller: true, media: true },
    });

    if (!listing) {
      throw new NotFoundException(
        'Книгу не знайдено в каталозі — спершу опублікуйте її',
      );
    }

    // A bridge-managed listing has its files managed by the bridge too: a
    // re-send replaces rather than piles up. Without this, every republish
    // of a corrected book would leave the previous PDF downloadable next
    // to the new one, and the buyer would have to guess which is current.
    const previous = listing.media.filter((asset) => asset.kind === kind);
    for (const asset of previous) {
      await this.storage.remove(asset.storageKey);
    }
    if (previous.length > 0) {
      await this.prisma.mediaAsset.deleteMany({
        where: { id: { in: previous.map((asset) => asset.id) } },
      });
    }

    const { storageKey, sizeBytes } = await this.storage.save(
      `listings/${listing.id}`,
      file.originalname,
      file.buffer,
    );

    const asset = await this.prisma.mediaAsset.create({
      data: {
        listingId: listing.id,
        // The bridge has no user of its own; the file belongs to the seller
        // that owns the listing, which is also who would answer for it.
        uploaderId: listing.seller.userId,
        kind,
        // Обкладинку й уривок бачать усі — це і є вітрина товару; сам файл
        // книги лише тим, хто має на неї право.
        access: PUBLIC_KINDS.has(kind) ? 'public' : 'entitled',
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes,
        storageKey,
      },
    });

    return {
      attached: true,
      kind,
      replaced: previous.length,
      media: {
        id: asset.id,
        filename: asset.filename,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      },
    };
  }

  // Unpublishing archives rather than deletes: someone may already own the
  // book, and their library entry must keep resolving.
  async unpublishBook(externalId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: {
        externalSource_externalId: {
          externalSource: BOOK_SOURCE,
          externalId,
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Книгу не знайдено в каталозі');
    }

    await this.prisma.listing.update({
      where: { id: listing.id },
      data: { status: 'archived' },
    });

    return { archived: true, slug: listing.slug };
  }
}
