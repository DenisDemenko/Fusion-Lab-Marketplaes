import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toListingCard, toMediaSummary } from '../catalog/listing.mapper';

const entitlementInclude = {
  listing: {
    include: { seller: true, category: true, media: true },
  },
  order: { select: { number: true, paidAt: true } },
};

// "Мої матеріали" — everything the buyer owns, with working download links.
// It reads entitlements rather than order items on purpose: an entitlement
// is the thing that grants access, and it can exist without a purchase
// (admin grant), while an order item can exist without granting anything
// (order still pending).
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async library(userId: string) {
    const rows = await this.prisma.entitlement.findMany({
      where: { userId },
      include: entitlementInclude,
      orderBy: { grantedAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      grantedAt: row.grantedAt,
      orderNumber: row.order?.number ?? null,
      listing: toListingCard(row.listing),
      // Once entitled, every asset of the listing is downloadable — the
      // whole point of the section. The gate still lives in MediaService;
      // this only decides what to show a link for.
      files: row.listing.media.map(toMediaSummary),
    }));
  }

  async item(userId: string, slug: string) {
    const entitlement = await this.requireEntitlement(userId, slug);

    const progress = await this.prisma.lessonProgress.findMany({
      where: { userId, listingId: entitlement.listingId },
      select: { moduleIndex: true, lessonIndex: true },
    });

    return {
      id: entitlement.id,
      grantedAt: entitlement.grantedAt,
      orderNumber: entitlement.order?.number ?? null,
      listing: {
        ...toListingCard(entitlement.listing),
        description: entitlement.listing.description,
        // Unlike the public toListingDetail, this is the entitled view —
        // videoUrl stays. The whole point of Phase D2's gate is that this
        // endpoint requires FirebaseAuthGuard AND an Entitlement row, so
        // reaching this line already proves the buyer paid.
        curriculum: entitlement.listing.curriculum,
      },
      files: entitlement.listing.media.map(toMediaSummary),
      progress,
    };
  }

  // Toggles one lesson's watched state. `completed: false` deletes the row
  // rather than storing it — a lesson is either in the table or it isn't,
  // there is no third state worth persisting.
  async setLessonProgress(
    userId: string,
    slug: string,
    input: { moduleIndex: number; lessonIndex: number; completed: boolean },
  ) {
    const entitlement = await this.requireEntitlement(userId, slug);

    if (input.completed) {
      await this.prisma.lessonProgress.upsert({
        where: {
          userId_listingId_moduleIndex_lessonIndex: {
            userId,
            listingId: entitlement.listingId,
            moduleIndex: input.moduleIndex,
            lessonIndex: input.lessonIndex,
          },
        },
        update: {},
        create: {
          userId,
          listingId: entitlement.listingId,
          moduleIndex: input.moduleIndex,
          lessonIndex: input.lessonIndex,
        },
      });
    } else {
      await this.prisma.lessonProgress.deleteMany({
        where: {
          userId,
          listingId: entitlement.listingId,
          moduleIndex: input.moduleIndex,
          lessonIndex: input.lessonIndex,
        },
      });
    }

    return this.prisma.lessonProgress.findMany({
      where: { userId, listingId: entitlement.listingId },
      select: { moduleIndex: true, lessonIndex: true },
    });
  }

  has(userId: string, listingId: string) {
    return this.prisma.entitlement.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });
  }

  private async requireEntitlement(userId: string, slug: string) {
    const entitlement = await this.prisma.entitlement.findFirst({
      where: { userId, listing: { slug } },
      include: entitlementInclude,
    });

    if (!entitlement) {
      throw new NotFoundException(
        'У вас немає доступу до цього матеріалу або його не існує',
      );
    }

    return entitlement;
  }
}
