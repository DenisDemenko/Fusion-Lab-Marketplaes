import {
  bearer,
  createTestApp,
  resetDatabase,
  type TestContext,
} from './utils/test-app';
import {
  createApprovedSeller,
  makeAdmin,
  publishListing,
} from './utils/fixtures';

const ADMIN = 'admin@test.dev';
const SELLER = 'seller@test.dev';

describe('Catalog and search (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    await makeAdmin(ctx, ADMIN);
    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });

    await ctx.prisma.category.createMany({
      data: [
        { slug: 'chpu', name: 'ЧПУ та верстати' },
        { slug: 'bpla', name: 'БПЛА та дрони' },
      ],
    });

    await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: {
        title: 'ЧПУ-фрезерування у Fusion 360',
        summary: 'Стратегії обробки, постпроцесори, стійкість інструменту',
        description:
          'Курс про фрезерну обробку на верстатах з ЧПУ: підготовка моделі, ' +
          'вибір стратегій, симуляція, постпроцесор і робота на верстаті.',
        priceMinor: 1120000,
        categorySlug: 'chpu',
      },
    });

    await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: {
        title: 'Конструювання БПЛА',
        summary: 'Рами, вузли, розрахунок навантажень',
        description:
          'Проєктування безпілотних апаратів у Fusion 360: рами, кріплення ' +
          'моторів, розрахунок навантажень і підготовка деталей до друку.',
        priceMinor: 980000,
        categorySlug: 'bpla',
      },
    });

    await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: {
        kind: 'product',
        title: 'Рама квадрокоптера 250 мм',
        curriculum: undefined,
        stock: 5,
        priceMinor: 210000,
        categorySlug: 'bpla',
      },
    });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lists only published items, newest first', async () => {
    const response = await ctx.http().get('/catalog').expect(200);

    expect(response.body.total).toBe(3);
    expect(response.body.items).toHaveLength(3);
    expect(
      response.body.items.every(
        (item: { status: string }) => item.status === 'published',
      ),
    ).toBe(true);
  });

  it('finds a course by a word from its description', async () => {
    const response = await ctx
      .http()
      .get('/catalog')
      .query({ q: 'постпроцесор' })
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items[0].title).toContain('ЧПУ');
  });

  // Trigram fallback: full-text search matches whole words only, and a
  // buyer typing part of one still has to find the listing.
  it('finds a listing by part of a word', async () => {
    const response = await ctx
      .http()
      .get('/catalog')
      .query({ q: 'квадрокоптер' })
      .expect(200);

    expect(response.body.items[0].title).toContain('Рама квадрокоптера');
  });

  it('returns an empty page rather than an error for nonsense', async () => {
    const response = await ctx
      .http()
      .get('/catalog')
      .query({ q: 'ксзщшгь !!! "' })
      .expect(200);

    expect(response.body).toMatchObject({ total: 0, items: [], pages: 0 });
  });

  it('filters by kind, category and price', async () => {
    const products = await ctx
      .http()
      .get('/catalog')
      .query({ kind: 'product' })
      .expect(200);
    expect(products.body.total).toBe(1);

    const drones = await ctx
      .http()
      .get('/catalog')
      .query({ category: 'bpla' })
      .expect(200);
    expect(drones.body.total).toBe(2);

    const cheap = await ctx
      .http()
      .get('/catalog')
      .query({ maxPriceMinor: 500000 })
      .expect(200);
    expect(cheap.body.total).toBe(1);
    expect(cheap.body.items[0].kind).toBe('product');
  });

  it('sorts by price in both directions', async () => {
    const asc = await ctx
      .http()
      .get('/catalog')
      .query({ sort: 'price_asc' })
      .expect(200);
    const desc = await ctx
      .http()
      .get('/catalog')
      .query({ sort: 'price_desc' })
      .expect(200);

    expect(asc.body.items[0].priceMinor).toBe(210000);
    expect(desc.body.items[0].priceMinor).toBe(1120000);
  });

  it('paginates', async () => {
    const page = await ctx
      .http()
      .get('/catalog')
      .query({ perPage: 2, page: 2 })
      .expect(200);

    expect(page.body).toMatchObject({ page: 2, perPage: 2, pages: 2 });
    expect(page.body.items).toHaveLength(1);
  });

  it('rejects a bad query instead of ignoring it', async () => {
    await ctx.http().get('/catalog').query({ perPage: 500 }).expect(400);
    await ctx.http().get('/catalog').query({ kind: 'spaceship' }).expect(400);
  });

  it('exposes categories and sellers with their published counts', async () => {
    const categories = await ctx.http().get('/catalog/categories').expect(200);
    const bpla = categories.body.find(
      (row: { slug: string }) => row.slug === 'bpla',
    );
    expect(bpla.listingCount).toBe(2);

    const sellers = await ctx.http().get('/catalog/sellers').expect(200);
    expect(sellers.body[0].listingCount).toBe(3);
  });

  it('hides a listing again once it is archived', async () => {
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: { title: 'Тимчасовий курс для архівації' },
    });

    await ctx.http().get(`/catalog/${listing.slug}`).expect(200);

    await ctx
      .http()
      .post(`/seller/listings/${listing.id}/archive`)
      .set('Authorization', bearer(SELLER))
      .expect(201);

    await ctx.http().get(`/catalog/${listing.slug}`).expect(404);
  });
});
