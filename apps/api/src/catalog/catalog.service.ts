import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogQueryDto } from './catalog.dto';
import { toListingCard, toListingDetail } from './listing.mapper';

const DEFAULT_PER_PAGE = 12;
// Upper bound on how many search hits are ranked in one request. The
// catalog is in the hundreds of listings, not millions; when it stops
// being, the whole search moves to OpenSearch (ROADMAP phase 3) rather
// than growing this number.
const MAX_SEARCH_HITS = 300;

const listingInclude = {
  seller: true,
  category: true,
  media: true,
} satisfies Prisma.ListingInclude;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: CatalogQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? DEFAULT_PER_PAGE;
    const where = this.buildWhere(query);

    // Two paths on purpose. Without a search term, Postgres does the
    // paging (ORDER BY + LIMIT/OFFSET on an indexed column). With one,
    // relevance ranking comes from the full-text index, and that ordering
    // cannot be expressed through Prisma's query builder — so ranked ids
    // are fetched first and the page is cut from them.
    if (query.q?.trim()) {
      const rankedIds = await this.rankedIds(query.q.trim());
      if (rankedIds.length === 0) {
        return { items: [], total: 0, page, perPage, pages: 0 };
      }

      const matches = await this.prisma.listing.findMany({
        where: { AND: [where, { id: { in: rankedIds } }] },
        include: listingInclude,
      });

      const rankOf = new Map(rankedIds.map((id, index) => [id, index]));
      const ordered = this.applySort(
        matches,
        query.sort ?? 'relevance',
        rankOf,
      );

      return {
        items: ordered
          .slice((page - 1) * perPage, page * perPage)
          .map(toListingCard),
        total: ordered.length,
        page,
        perPage,
        pages: Math.ceil(ordered.length / perPage),
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: listingInclude,
        orderBy: this.orderBy(query.sort),
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      items: rows.map(toListingCard),
      total,
      page,
      perPage,
      pages: Math.ceil(total / perPage),
    };
  }

  async findBySlug(slug: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { slug, status: 'published' },
      include: listingInclude,
    });

    if (!listing) {
      throw new NotFoundException(`Лістинг "${slug}" не знайдено`);
    }

    return toListingDetail(listing);
  }

  async categories() {
    const rows = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { listings: { where: { status: 'published' } } } },
      },
    });

    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      listingCount: row._count.listings,
    }));
  }

  async sellers() {
    const rows = await this.prisma.sellerProfile.findMany({
      where: { status: 'approved' },
      orderBy: { displayName: 'asc' },
      include: {
        _count: { select: { listings: { where: { status: 'published' } } } },
      },
    });

    return rows.map((row) => ({
      slug: row.slug,
      displayName: row.displayName,
      bio: row.bio,
      listingCount: row._count.listings,
    }));
  }

  // Ordered listing ids, best match first. `websearch_to_tsquery` is what
  // gives users the syntax they already expect from a search box (quoted
  // phrases, OR, -exclusion) and, unlike `to_tsquery`, it cannot throw a
  // syntax error on stray punctuation typed by a human.
  //
  // The trigram half catches what full-text cannot: partial words and
  // typos ("фрезер" inside "фрезерування"), which matter in a small
  // catalog where a single missed hit is an empty results page.
  private async rankedIds(term: string): Promise<string[]> {
    const like = `%${term}%`;

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "Listing"
      WHERE "status" = 'published'
        AND (
          "searchVector" @@ websearch_to_tsquery('simple', ${term})
          OR "title" ILIKE ${like}
          OR similarity("title", ${term}) > 0.25
        )
      ORDER BY
        ts_rank("searchVector", websearch_to_tsquery('simple', ${term})) DESC,
        similarity("title", ${term}) DESC,
        "publishedAt" DESC NULLS LAST
      LIMIT ${MAX_SEARCH_HITS}
    `;

    return rows.map((row) => row.id);
  }

  private buildWhere(query: CatalogQueryDto): Prisma.ListingWhereInput {
    const where: Prisma.ListingWhereInput = { status: 'published' };

    if (query.kind) where.kind = query.kind;
    if (query.category) where.category = { slug: query.category };
    if (query.seller) where.seller = { slug: query.seller };

    if (
      query.minPriceMinor !== undefined ||
      query.maxPriceMinor !== undefined
    ) {
      where.priceMinor = {
        ...(query.minPriceMinor !== undefined
          ? { gte: query.minPriceMinor }
          : {}),
        ...(query.maxPriceMinor !== undefined
          ? { lte: query.maxPriceMinor }
          : {}),
      };
    }

    return where;
  }

  private orderBy(
    sort: CatalogQueryDto['sort'],
  ): Prisma.ListingOrderByWithRelationInput {
    switch (sort) {
      case 'price_asc':
        return { priceMinor: 'asc' };
      case 'price_desc':
        return { priceMinor: 'desc' };
      default:
        return { publishedAt: 'desc' };
    }
  }

  private applySort<
    T extends { id: string; priceMinor: number; publishedAt: Date | null },
  >(
    rows: T[],
    sort: NonNullable<CatalogQueryDto['sort']>,
    rankOf: Map<string, number>,
  ): T[] {
    const sorted = [...rows];

    switch (sort) {
      case 'price_asc':
        return sorted.sort((a, b) => a.priceMinor - b.priceMinor);
      case 'price_desc':
        return sorted.sort((a, b) => b.priceMinor - a.priceMinor);
      case 'newest':
        return sorted.sort(
          (a, b) =>
            (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
        );
      default:
        return sorted.sort(
          (a, b) =>
            (rankOf.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (rankOf.get(b.id) ?? Number.MAX_SAFE_INTEGER),
        );
    }
  }
}
