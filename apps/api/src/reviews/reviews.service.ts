import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listForListing(listingId: string) {
    const [reviews, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where: { listingId },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { displayName: true, email: true } } },
      }),
      this.prisma.review.aggregate({
        where: { listingId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    return {
      average: aggregate._avg.rating ?? 0,
      count: aggregate._count._all,
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        body: review.body,
        authorName: review.user.displayName || review.user.email.split('@')[0],
        createdAt: review.createdAt,
      })),
    };
  }

  myReview(userId: string, listingId: string) {
    return this.prisma.review.findUnique({
      where: { listingId_userId: { listingId, userId } },
    });
  }

  // Upsert, not create-only: a buyer editing their opinion after using the
  // product longer is normal, and the unique (listingId, userId)
  // constraint means "review already exists" would otherwise be a dead
  // end with no way back in from the UI.
  async upsert(
    userId: string,
    listingId: string,
    input: { rating: number; body?: string },
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { seller: true },
    });
    if (!listing) throw new NotFoundException('Лістинг не знайдено');

    // Ownership of an Entitlement is the same fact that gates file
    // downloads — "this account actually paid for this listing" — reused
    // here rather than re-deriving it from OrderItem, so eligibility for a
    // review and eligibility to download can never quietly disagree.
    const owns = await this.prisma.entitlement.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });
    if (!owns) {
      throw new ForbiddenException(
        'Залишити відгук можна лише після покупки цього лістингу',
      );
    }

    const isNew = !(await this.myReview(userId, listingId));

    const review = await this.prisma.review.upsert({
      where: { listingId_userId: { listingId, userId } },
      create: {
        listingId,
        userId,
        rating: input.rating,
        body: input.body,
      },
      update: { rating: input.rating, body: input.body },
    });

    if (isNew) {
      await this.notifications.notify({
        userId: listing.seller.userId,
        type: 'review_posted',
        title: 'Новий відгук',
        body: `${input.rating}/5 на «${listing.title}»`,
        payload: { listingId },
      });
    }

    return review;
  }

  async remove(userId: string, listingId: string) {
    const review = await this.myReview(userId, listingId);
    if (!review) throw new NotFoundException('Відгук не знайдено');

    await this.prisma.review.delete({ where: { id: review.id } });
    return { deleted: true };
  }
}
