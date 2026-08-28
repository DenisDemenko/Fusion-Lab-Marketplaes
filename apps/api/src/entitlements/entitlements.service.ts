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
    const entitlement = await this.prisma.entitlement.findFirst({
      where: { userId, listing: { slug } },
      include: entitlementInclude,
    });

    if (!entitlement) {
      throw new NotFoundException(
        'У вас немає доступу до цього матеріалу або його не існує',
      );
    }

    return {
      id: entitlement.id,
      grantedAt: entitlement.grantedAt,
      orderNumber: entitlement.order?.number ?? null,
      listing: {
        ...toListingCard(entitlement.listing),
        description: entitlement.listing.description,
        curriculum: entitlement.listing.curriculum,
      },
      files: entitlement.listing.media.map(toMediaSummary),
    };
  }

  has(userId: string, listingId: string) {
    return this.prisma.entitlement.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });
  }
}
