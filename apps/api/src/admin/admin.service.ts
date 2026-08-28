import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingStatus,
  OrderStatus,
  SellerStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toListingCard } from '../catalog/listing.mapper';
import { formatUah } from '../common/money';
import { uniqueSlug } from '../common/slug';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // --- dashboard -------------------------------------------------------

  async stats() {
    const [users, sellersPending, listingsPending, listingsPublished, paid] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.sellerProfile.count({ where: { status: 'pending' } }),
        this.prisma.listing.count({ where: { status: 'pending_review' } }),
        this.prisma.listing.count({ where: { status: 'published' } }),
        this.prisma.order.aggregate({
          where: { status: 'paid' },
          _count: { _all: true },
          _sum: { totalMinor: true, commissionMinor: true },
        }),
      ]);

    const grossMinor = paid._sum.totalMinor ?? 0;
    const commissionMinor = paid._sum.commissionMinor ?? 0;

    return {
      users,
      sellersPending,
      listingsPending,
      listingsPublished,
      paidOrders: paid._count._all,
      grossMinor,
      grossLabel: formatUah(grossMinor),
      commissionMinor,
      commissionLabel: formatUah(commissionMinor),
    };
  }

  // --- listing moderation ----------------------------------------------

  async listings(status?: ListingStatus) {
    const rows = await this.prisma.listing.findMany({
      where: status ? { status } : {},
      include: { seller: true, category: true, media: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    return rows.map((row) => ({
      ...toListingCard(row),
      rejectionReason: row.rejectionReason,
      description: row.description,
      lockedFiles: row.media.filter((asset) => asset.access === 'entitled')
        .length,
    }));
  }

  async approveListing(listingId: string) {
    const listing = await this.requireListing(listingId);

    if (listing.status === 'published') {
      throw new ConflictException('Лістинг уже опубліковано');
    }

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data: {
        status: 'published',
        rejectionReason: null,
        // Set once: a listing that is archived and republished keeps the
        // date it first appeared, which is what "newest" should mean.
        publishedAt: listing.publishedAt ?? new Date(),
      },
      include: { seller: true, category: true, media: true },
    });

    await this.notifications.notify({
      userId: listing.seller.userId,
      type: 'listing_approved',
      title: 'Лістинг опубліковано',
      body: `"${listing.title}" уже в каталозі`,
      payload: { listingId: listing.id, slug: listing.slug },
    });

    return toListingCard(updated);
  }

  async rejectListing(listingId: string, reason: string) {
    if (!reason?.trim()) {
      throw new BadRequestException(
        'Вкажіть причину відхилення — продавцю треба знати, що виправити',
      );
    }

    const listing = await this.requireListing(listingId);

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data: { status: 'rejected', rejectionReason: reason.trim() },
      include: { seller: true, category: true, media: true },
    });

    await this.notifications.notify({
      userId: listing.seller.userId,
      type: 'listing_rejected',
      title: 'Лістинг відхилено',
      body: reason.trim(),
      payload: { listingId: listing.id },
    });

    return toListingCard(updated);
  }

  // --- sellers ---------------------------------------------------------

  async sellers(status?: SellerStatus) {
    return this.prisma.sellerProfile.findMany({
      where: status ? { status } : {},
      include: {
        user: { select: { email: true, role: true } },
        _count: { select: { listings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveSeller(profileId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new NotFoundException('Заявку не знайдено');
    }

    // Both halves or neither: a profile marked approved while the user row
    // still says "buyer" would pass the seller check and fail every role
    // check, which is the kind of split-brain that is painful to debug.
    const [updated] = await this.prisma.$transaction([
      this.prisma.sellerProfile.update({
        where: { id: profile.id },
        data: { status: 'approved' },
      }),
      this.prisma.user.updateMany({
        where: { id: profile.userId, role: 'buyer' },
        data: { role: 'seller' },
      }),
    ]);

    await this.notifications.notify({
      userId: profile.userId,
      type: 'seller_approved',
      title: 'Ви тепер продавець',
      body: 'Кабінет продавця відкрито — можна створювати лістинги',
      payload: { sellerProfileId: profile.id },
    });

    return updated;
  }

  async rejectSeller(profileId: string, reason?: string) {
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new NotFoundException('Заявку не знайдено');
    }

    const updated = await this.prisma.sellerProfile.update({
      where: { id: profile.id },
      data: { status: 'rejected' },
    });

    await this.notifications.notify({
      userId: profile.userId,
      type: 'listing_rejected',
      title: 'Заявку продавця відхилено',
      body: reason?.trim() || 'Зверніться до підтримки за деталями',
    });

    return updated;
  }

  // --- users -----------------------------------------------------------

  async users(query?: string) {
    return this.prisma.user.findMany({
      where: query
        ? { email: { contains: query, mode: 'insensitive' } }
        : undefined,
      include: {
        sellerProfile: { select: { status: true, displayName: true } },
        _count: { select: { orders: true, entitlements: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async setRole(userId: string, role: UserRole, actingAdminId: string) {
    // An admin who demotes themselves locks the whole panel — including
    // the ability to undo it. Refused rather than confirmed, because there
    // is no legitimate reason to do it from this screen.
    if (userId === actingAdminId && role !== 'admin') {
      throw new BadRequestException(
        'Не можна зняти з себе роль адміністратора в цьому екрані',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }

    return this.prisma.user.update({ where: { id: userId }, data: { role } });
  }

  // --- orders ----------------------------------------------------------

  async orders(status?: OrderStatus) {
    const rows = await this.prisma.order.findMany({
      where: status ? { status } : {},
      include: {
        buyer: { select: { email: true } },
        items: true,
        payment: { select: { status: true, provider: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return rows.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      buyerEmail: order.buyer.email,
      totalMinor: order.totalMinor,
      totalLabel: formatUah(order.totalMinor),
      commissionMinor: order.commissionMinor,
      itemCount: order.items.length,
      payment: order.payment,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
    }));
  }

  // --- categories ------------------------------------------------------

  async categories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async createCategory(name: string, slug?: string) {
    const finalSlug = slug
      ? slug
      : await uniqueSlug(name, async (candidate) =>
          Boolean(
            await this.prisma.category.findUnique({
              where: { slug: candidate },
            }),
          ),
        );

    const existing = await this.prisma.category.findUnique({
      where: { slug: finalSlug },
    });
    if (existing) {
      throw new ConflictException(`Категорія "${finalSlug}" уже існує`);
    }

    return this.prisma.category.create({ data: { name, slug: finalSlug } });
  }

  async deleteCategory(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: { _count: { select: { listings: true } } },
    });

    if (!category) {
      throw new NotFoundException('Категорію не знайдено');
    }

    if (category._count.listings > 0) {
      throw new ConflictException(
        `Категорія використовується в ${category._count.listings} лістингах`,
      );
    }

    await this.prisma.category.delete({ where: { id: category.id } });
    return { deleted: true, slug };
  }

  private async requireListing(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { seller: true },
    });

    if (!listing) {
      throw new NotFoundException('Лістинг не знайдено');
    }

    return listing;
  }
}
