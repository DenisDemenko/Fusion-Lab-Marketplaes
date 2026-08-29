import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SellerProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { uniqueSlug } from '../common/slug';
import {
  toListingCard,
  toMediaSummary,
  toOwnerListingDetail,
} from '../catalog/listing.mapper';
import {
  ApplySellerDto,
  CreateListingDto,
  UpdateListingDto,
  UploadMediaDto,
} from './seller.dto';

// Anything above this goes to a storage service that can stream, not into
// a Buffer in the request handler. 50 MB covers a course archive of STL
// files and PDFs, which is what sellers actually upload here.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'model/stl',
  'application/sla',
  'application/octet-stream',
  'video/mp4',
  'text/plain',
  'text/markdown',
]);

const listingInclude = {
  seller: true,
  category: true,
  media: true,
} satisfies Prisma.ListingInclude;

@Injectable()
export class SellersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  // --- profile ---------------------------------------------------------

  async apply(userId: string, dto: ApplySellerDto) {
    const existing = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException(
        `Заявка вже подана, поточний статус: ${existing.status}`,
      );
    }

    const slug = await uniqueSlug(dto.displayName, async (candidate) =>
      Boolean(
        await this.prisma.sellerProfile.findUnique({
          where: { slug: candidate },
        }),
      ),
    );

    const profile = await this.prisma.sellerProfile.create({
      data: {
        userId,
        displayName: dto.displayName,
        bio: dto.bio,
        slug,
      },
    });

    await this.notifications.notifyAdmins({
      type: 'seller_application',
      title: 'Нова заявка продавця',
      body: `${dto.displayName} подав заявку на статус продавця`,
      payload: { sellerProfileId: profile.id },
    });

    return profile;
  }

  async me(userId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });

    if (!profile) return null;

    const [listings, sold] = await Promise.all([
      this.prisma.listing.groupBy({
        by: ['status'],
        where: { sellerId: profile.id },
        _count: { _all: true },
      }),
      this.prisma.orderItem.aggregate({
        where: { sellerId: profile.id, order: { status: 'paid' } },
        _sum: { unitPriceMinor: true, commissionMinor: true },
        _count: { _all: true },
      }),
    ]);

    const grossMinor = sold._sum.unitPriceMinor ?? 0;
    const commissionMinor = sold._sum.commissionMinor ?? 0;

    return {
      ...profile,
      stats: {
        listingsByStatus: Object.fromEntries(
          listings.map((row) => [row.status, row._count._all]),
        ),
        itemsSold: sold._count._all,
        grossMinor,
        commissionMinor,
        payoutMinor: grossMinor - commissionMinor,
      },
    };
  }

  // Every seller-only action funnels through here. A pending applicant can
  // see their own status but cannot touch the catalog: an unreviewed
  // account that could publish would make the moderation queue pointless.
  async requireApprovedProfile(userId: string): Promise<SellerProfile> {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new ForbiddenException(
        'Спочатку подайте заявку продавця (POST /seller/apply)',
      );
    }

    if (profile.status !== 'approved') {
      throw new ForbiddenException(
        `Заявку продавця ще не схвалено (статус: ${profile.status})`,
      );
    }

    return profile;
  }

  // --- listings --------------------------------------------------------

  async listListings(userId: string) {
    const profile = await this.requireApprovedProfile(userId);

    const rows = await this.prisma.listing.findMany({
      where: { sellerId: profile.id },
      include: listingInclude,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map(toListingCard);
  }

  async getListing(userId: string, id: string) {
    const listing = await this.ownedListing(userId, id);
    return toOwnerListingDetail(listing);
  }

  async createListing(userId: string, dto: CreateListingDto) {
    const profile = await this.requireApprovedProfile(userId);
    const slug = await uniqueSlug(dto.title, async (candidate) =>
      Boolean(
        await this.prisma.listing.findUnique({ where: { slug: candidate } }),
      ),
    );

    const listing = await this.prisma.listing.create({
      data: {
        slug,
        sellerId: profile.id,
        kind: dto.kind,
        title: dto.title,
        subtitle: dto.subtitle,
        summary: dto.summary,
        description: dto.description,
        priceMinor: dto.priceMinor,
        coverUrl: dto.coverUrl,
        stock: dto.stock,
        highlights: dto.highlights ?? [],
        curriculum: (dto.curriculum ?? undefined) as Prisma.InputJsonValue,
        categoryId: await this.categoryIdFor(dto.categorySlug),
      },
      include: listingInclude,
    });

    return toOwnerListingDetail(listing);
  }

  async updateListing(userId: string, id: string, dto: UpdateListingDto) {
    const listing = await this.ownedListing(userId, id);

    if (listing.status === 'pending_review') {
      throw new ConflictException(
        'Лістинг на модерації — дочекайтесь рішення або відкличте його',
      );
    }

    const data: Prisma.ListingUpdateInput = {
      ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
      ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.priceMinor !== undefined ? { priceMinor: dto.priceMinor } : {}),
      ...(dto.coverUrl !== undefined ? { coverUrl: dto.coverUrl } : {}),
      ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
      ...(dto.highlights !== undefined ? { highlights: dto.highlights } : {}),
      ...(dto.curriculum !== undefined
        ? { curriculum: dto.curriculum as Prisma.InputJsonValue }
        : {}),
    };

    if (dto.categorySlug !== undefined) {
      const categoryId = await this.categoryIdFor(dto.categorySlug);
      data.category = categoryId
        ? { connect: { id: categoryId } }
        : { disconnect: true };
    }

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data,
      include: listingInclude,
    });

    return toOwnerListingDetail(updated);
  }

  // The publish button. It does not publish — it submits for review, and
  // says so, because a seller who thinks their course is live when it is
  // in a queue will not come back to check.
  async submitForReview(userId: string, id: string) {
    const listing = await this.ownedListing(userId, id);

    if (listing.status === 'pending_review') {
      throw new ConflictException('Лістинг уже на модерації');
    }

    const problems = this.publishBlockers(listing);
    if (problems.length > 0) {
      throw new BadRequestException({
        message: 'Лістинг не готовий до публікації',
        problems,
      });
    }

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data: { status: 'pending_review', rejectionReason: null },
      include: listingInclude,
    });

    await this.notifications.notifyAdmins({
      type: 'listing_submitted',
      title: 'Новий лістинг на модерації',
      body: `"${listing.title}" від ${listing.seller.displayName}`,
      payload: { listingId: listing.id },
    });

    return toOwnerListingDetail(updated);
  }

  async withdraw(userId: string, id: string) {
    const listing = await this.ownedListing(userId, id);

    if (!['pending_review', 'published'].includes(listing.status)) {
      throw new ConflictException(
        `Зняти з публікації можна лише опублікований лістинг або той, що на модерації (зараз: ${listing.status})`,
      );
    }

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data: { status: 'draft', publishedAt: null },
      include: listingInclude,
    });

    return toOwnerListingDetail(updated);
  }

  async archive(userId: string, id: string) {
    const listing = await this.ownedListing(userId, id);

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data: { status: 'archived' },
      include: listingInclude,
    });

    return toOwnerListingDetail(updated);
  }

  // Deletion is refused once a listing has been bought: order history and
  // the buyer's entitlement both point at this row, and a marketplace that
  // can erase what someone paid for is not one people trust. Archiving is
  // the honest alternative and is offered in the error.
  async deleteListing(userId: string, id: string) {
    const listing = await this.ownedListing(userId, id);

    const sold = await this.prisma.orderItem.count({
      where: { listingId: listing.id },
    });

    if (sold > 0) {
      throw new ConflictException(
        'Лістинг уже купували — його не можна видалити, лише архівувати',
      );
    }

    for (const asset of listing.media) {
      await this.storage.remove(asset.storageKey);
    }

    await this.prisma.listing.delete({ where: { id: listing.id } });
    return { deleted: true, id: listing.id };
  }

  // --- media -----------------------------------------------------------

  async uploadMedia(
    userId: string,
    listingId: string,
    file: Express.Multer.File | undefined,
    dto: UploadMediaDto,
  ) {
    const listing = await this.ownedListing(userId, listingId);

    if (!file) {
      throw new BadRequestException('Файл не надіслано (поле "file")');
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `Файл завеликий: ${file.size} байт, максимум ${MAX_UPLOAD_BYTES}`,
      );
    }

    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        `Тип файлу не підтримується: ${file.mimetype}`,
      );
    }

    // Cover and gallery images are the shop window: public by definition,
    // and letting a seller mark either "entitled" would produce a catalog
    // card or gallery strip with a hole in it. Everything else defaults to
    // paid-only.
    const access =
      dto.kind === 'cover' || dto.kind === 'gallery'
        ? 'public'
        : (dto.access ?? 'entitled');

    const { storageKey, sizeBytes } = await this.storage.save(
      `listings/${listing.id}`,
      file.originalname,
      file.buffer,
    );

    // One cover per listing: replacing it removes the old bytes too, so a
    // seller who re-uploads five times does not leave four orphans on disk.
    if (dto.kind === 'cover') {
      const previous = listing.media.filter((asset) => asset.kind === 'cover');
      for (const asset of previous) {
        await this.storage.remove(asset.storageKey);
      }
      if (previous.length > 0) {
        await this.prisma.mediaAsset.deleteMany({
          where: { id: { in: previous.map((asset) => asset.id) } },
        });
      }
    }

    const asset = await this.prisma.mediaAsset.create({
      data: {
        listingId: listing.id,
        uploaderId: userId,
        kind: dto.kind,
        access,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes,
        storageKey,
      },
    });

    return toMediaSummary(asset);
  }

  async deleteMedia(userId: string, mediaId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
      include: { listing: { include: { seller: true } } },
    });

    if (!asset) {
      throw new NotFoundException('Файл не знайдено');
    }

    if (asset.listing?.seller.userId !== userId) {
      throw new ForbiddenException('Це не ваш файл');
    }

    await this.storage.remove(asset.storageKey);
    await this.prisma.mediaAsset.delete({ where: { id: asset.id } });

    return { deleted: true, id: asset.id };
  }

  // --- sales -----------------------------------------------------------

  async orders(userId: string) {
    const profile = await this.requireApprovedProfile(userId);

    const items = await this.prisma.orderItem.findMany({
      where: { sellerId: profile.id },
      include: {
        order: {
          select: { number: true, status: true, createdAt: true, paidAt: true },
        },
        listing: { select: { slug: true, kind: true } },
      },
      orderBy: { order: { createdAt: 'desc' } },
      take: 200,
    });

    return items.map((item) => ({
      id: item.id,
      orderNumber: item.order.number,
      orderStatus: item.order.status,
      placedAt: item.order.createdAt,
      paidAt: item.order.paidAt,
      title: item.titleSnapshot,
      listingSlug: item.listing.slug,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      commissionMinor: item.commissionMinor,
      payoutMinor: item.unitPriceMinor * item.quantity - item.commissionMinor,
    }));
  }

  // --- helpers ---------------------------------------------------------

  private publishBlockers(listing: {
    description: string | null;
    priceMinor: number;
    coverUrl: string | null;
    kind: string;
    curriculum: Prisma.JsonValue;
    media: { kind: string }[];
  }): string[] {
    const problems: string[] = [];

    if (!listing.description || listing.description.trim().length < 40) {
      problems.push('Опис має містити щонайменше 40 символів');
    }

    if (listing.priceMinor <= 0) {
      problems.push('Вкажіть ціну більшу за нуль');
    }

    const hasCover =
      Boolean(listing.coverUrl) ||
      listing.media.some((asset) => asset.kind === 'cover');
    if (!hasCover) {
      problems.push('Додайте обкладинку (файл або посилання)');
    }

    // A course with no programme is the single most common half-finished
    // listing, and the one buyers complain about — so it is blocked here
    // rather than discovered after a refund request.
    if (listing.kind === 'course' && !listing.curriculum) {
      problems.push('Для курсу потрібна програма (модулі та заняття)');
    }

    return problems;
  }

  private async ownedListing(userId: string, id: string) {
    const profile = await this.requireApprovedProfile(userId);

    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });

    if (!listing) {
      throw new NotFoundException('Лістинг не знайдено');
    }

    if (listing.sellerId !== profile.id) {
      throw new ForbiddenException('Це не ваш лістинг');
    }

    return listing;
  }

  private async categoryIdFor(slug?: string): Promise<string | null> {
    if (!slug) return null;

    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category) {
      throw new BadRequestException(`Категорія "${slug}" не існує`);
    }

    return category.id;
  }
}
