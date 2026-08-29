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
  signIn,
} from './utils/fixtures';

const ADMIN = 'admin@test.dev';
const SELLER = 'seller@test.dev';
const BUYER = 'buyer@test.dev';

describe('Promo codes and loyalty points (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await makeAdmin(ctx, ADMIN);
    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('promo codes', () => {
    it('lets an admin create a code and a buyer redeem it at checkout', async () => {
      const listing = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
        overrides: { priceMinor: 100000 },
      });

      await ctx
        .http()
        .post('/admin/promo-codes')
        .set('Authorization', bearer(ADMIN))
        .send({ code: 'WELCOME10', type: 'percent', value: 10 })
        .expect(201);

      await signIn(ctx, BUYER);
      await ctx
        .http()
        .post('/cart/items')
        .set('Authorization', bearer(BUYER))
        .send({ listingId: listing.id })
        .expect(201);

      const preview = await ctx
        .http()
        .post('/promo-codes/preview')
        .send({ code: 'welcome10', subtotalMinor: 100000 })
        .expect(201);
      expect(preview.body).toMatchObject({
        code: 'WELCOME10',
        discountMinor: 10000,
      });

      const checkout = await ctx
        .http()
        .post('/orders/checkout')
        .set('Authorization', bearer(BUYER))
        .send({ promoCode: 'welcome10' })
        .expect(201);

      expect(checkout.body.order).toMatchObject({
        subtotalMinor: 100000,
        promoCode: 'WELCOME10',
        promoDiscountMinor: 10000,
        totalMinor: 90000,
      });

      const promoCodes = await ctx
        .http()
        .get('/admin/promo-codes')
        .set('Authorization', bearer(ADMIN))
        .expect(200);
      expect(promoCodes.body[0].redemptionCount).toBe(1);
    });

    it('refuses an unknown code and one already used up', async () => {
      const listingA = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
        overrides: { title: 'Товар А' },
      });
      const listingB = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
        overrides: { title: 'Товар Б' },
      });

      await ctx
        .http()
        .post('/admin/promo-codes')
        .set('Authorization', bearer(ADMIN))
        .send({ code: 'ONEUSE', type: 'fixed', value: 5000, maxRedemptions: 1 })
        .expect(201);

      await signIn(ctx, BUYER);
      await ctx
        .http()
        .post('/cart/items')
        .set('Authorization', bearer(BUYER))
        .send({ listingId: listingA.id })
        .expect(201);

      await ctx
        .http()
        .post('/orders/checkout')
        .set('Authorization', bearer(BUYER))
        .send({ promoCode: 'oneuse' })
        .expect(201);

      // Exhausted by the checkout above — a second attempt (even by the
      // same buyer, on a different listing) must not spend it twice.
      const stranger = 'stranger@test.dev';
      await signIn(ctx, stranger);
      await ctx
        .http()
        .post('/cart/items')
        .set('Authorization', bearer(stranger))
        .send({ listingId: listingB.id })
        .expect(201);

      await ctx
        .http()
        .post('/orders/checkout')
        .set('Authorization', bearer(stranger))
        .send({ promoCode: 'ONEUSE' })
        .expect(400);

      await ctx
        .http()
        .post('/promo-codes/preview')
        .send({ code: 'NOPE', subtotalMinor: 1000 })
        .expect(404);
    });

    it('rejects a duplicate code and an out-of-range percentage', async () => {
      await ctx
        .http()
        .post('/admin/promo-codes')
        .set('Authorization', bearer(ADMIN))
        .send({ code: 'DUPE', type: 'fixed', value: 100 })
        .expect(201);

      await ctx
        .http()
        .post('/admin/promo-codes')
        .set('Authorization', bearer(ADMIN))
        .send({ code: 'dupe', type: 'fixed', value: 200 })
        .expect(409);

      await ctx
        .http()
        .post('/admin/promo-codes')
        .set('Authorization', bearer(ADMIN))
        .send({ code: 'TOOBIG', type: 'percent', value: 150 })
        .expect(400);
    });

    it('caps a fixed discount at the subtotal instead of going negative', async () => {
      const listing = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
        overrides: { priceMinor: 5000 },
      });

      await ctx
        .http()
        .post('/admin/promo-codes')
        .set('Authorization', bearer(ADMIN))
        .send({ code: 'HUGE', type: 'fixed', value: 999999 })
        .expect(201);

      await signIn(ctx, BUYER);
      await ctx
        .http()
        .post('/cart/items')
        .set('Authorization', bearer(BUYER))
        .send({ listingId: listing.id })
        .expect(201);

      const checkout = await ctx
        .http()
        .post('/orders/checkout')
        .set('Authorization', bearer(BUYER))
        .send({ promoCode: 'huge' })
        .expect(201);

      expect(checkout.body.order.totalMinor).toBe(0);
      expect(checkout.body.order.promoDiscountMinor).toBe(5000);
    });
  });

  describe('loyalty points', () => {
    it('earns cashback on a paid order and lets it be spent on the next one', async () => {
      const first = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
        overrides: { title: 'Перша покупка', priceMinor: 100000 },
      });

      await signIn(ctx, BUYER);
      await ctx
        .http()
        .post('/cart/items')
        .set('Authorization', bearer(BUYER))
        .send({ listingId: first.id })
        .expect(201);

      const checkout1 = await ctx
        .http()
        .post('/orders/checkout')
        .set('Authorization', bearer(BUYER))
        .expect(201);

      await ctx
        .http()
        .post('/payments/dev/confirm')
        .set('Authorization', bearer(BUYER))
        .send({ orderNumber: checkout1.body.order.number })
        .expect(201);

      // 5% cashback on 1000.00 грн = 500 points.
      const loyalty = await ctx
        .http()
        .get('/me/loyalty')
        .set('Authorization', bearer(BUYER))
        .expect(200);
      expect(loyalty.body.balance).toBe(5000);
      expect(loyalty.body.transactions[0]).toMatchObject({
        type: 'earned_purchase',
        points: 5000,
      });

      const second = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
        overrides: { title: 'Друга покупка', priceMinor: 200000 },
      });

      await ctx
        .http()
        .post('/cart/items')
        .set('Authorization', bearer(BUYER))
        .send({ listingId: second.id })
        .expect(201);

      const checkout2 = await ctx
        .http()
        .post('/orders/checkout')
        .set('Authorization', bearer(BUYER))
        .send({ loyaltyPointsToSpend: 5000 })
        .expect(201);

      expect(checkout2.body.order).toMatchObject({
        subtotalMinor: 200000,
        loyaltyPointsSpent: 5000,
        loyaltyDiscountMinor: 5000,
        totalMinor: 195000,
      });

      const afterSpend = await ctx
        .http()
        .get('/me/loyalty')
        .set('Authorization', bearer(BUYER))
        .expect(200);
      expect(afterSpend.body.balance).toBe(0);
    });

    it('caps spending at the available balance instead of erroring', async () => {
      const listing = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
        overrides: { priceMinor: 100000 },
      });

      await signIn(ctx, BUYER);
      await ctx
        .http()
        .post('/cart/items')
        .set('Authorization', bearer(BUYER))
        .send({ listingId: listing.id })
        .expect(201);

      // Buyer has 0 points — asking to spend 9999 must not fail checkout,
      // it should just spend nothing.
      const checkout = await ctx
        .http()
        .post('/orders/checkout')
        .set('Authorization', bearer(BUYER))
        .send({ loyaltyPointsToSpend: 9999 })
        .expect(201);

      expect(checkout.body.order.loyaltyPointsSpent).toBe(0);
      expect(checkout.body.order.totalMinor).toBe(100000);
    });

    it('does not earn points until the order is actually paid', async () => {
      const listing = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
        overrides: { priceMinor: 100000 },
      });

      await signIn(ctx, BUYER);
      await ctx
        .http()
        .post('/cart/items')
        .set('Authorization', bearer(BUYER))
        .send({ listingId: listing.id })
        .expect(201);

      await ctx
        .http()
        .post('/orders/checkout')
        .set('Authorization', bearer(BUYER))
        .expect(201);

      const loyalty = await ctx
        .http()
        .get('/me/loyalty')
        .set('Authorization', bearer(BUYER))
        .expect(200);
      expect(loyalty.body.balance).toBe(0);
    });
  });
});
