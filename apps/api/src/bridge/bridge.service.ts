import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueSlug } from '../common/slug';
import { toListingCard } from '../catalog/listing.mapper';
import type { PublishBookDto } from './bridge.dto';

export const BOOK_SOURCE = 'book_creality';

// The API bridge from ADR 0001: Book_Creality owns the book, this
// marketplace only lists and sells it. Nothing here edits book content —
// a re-publish overwrites the mirrored fields and that is the whole
// contract.
@Injectable()
export class BridgeService {
  constructor(private readonly prisma: PrismaService) {}

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
