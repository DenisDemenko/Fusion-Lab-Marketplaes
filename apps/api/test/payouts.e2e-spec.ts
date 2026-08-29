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

describe('Seller payouts ledger (e2e)', () => {
  let ctx: TestContext;
  let sellerId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await makeAdmin(ctx, ADMIN);
    const application = await createApprovedSeller(ctx, {
      email: SELLER,
      adminEmail: ADMIN,
    });
    sellerId = application.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function buyAndPay(priceMinor: number, title: string) {
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: { title, priceMinor },
    });

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
      .expect(201);
    await ctx
      .http()
      .post('/payments/dev/confirm')
      .set('Authorization', bearer(BUYER))
      .send({ orderNumber: checkout.body.order.number })
      .expect(201);
  }

  it('shows nothing owed before any sale', async () => {
    const ledger = await ctx
      .http()
      .get('/seller/payouts')
      .set('Authorization', bearer(SELLER))
      .expect(200);

    expect(ledger.body).toMatchObject({
      earnedMinor: 0,
      paidOutMinor: 0,
      outstandingMinor: 0,
      entries: [],
    });
  });

  it('accrues earnings net of commission after each sale', async () => {
    // Each purchase needs its own buyer — an account can't own the same
    // digital listing twice, and reusing BUYER would trip that guard.
    await buyAndPay(100000, 'Продаж перший');

    const ledger = await ctx
      .http()
      .get('/seller/payouts')
      .set('Authorization', bearer(SELLER))
      .expect(200);

    // 15% default commission on 1000.00 грн → 850.00 грн earned.
    expect(ledger.body.earnedMinor).toBe(85000);
    expect(ledger.body.outstandingMinor).toBe(85000);
    expect(ledger.body.entries).toHaveLength(1);
    expect(ledger.body.entries[0]).toMatchObject({
      type: 'sale',
      amountMinor: 85000,
    });
  });

  it('lets an admin record a payout and reduces the outstanding balance', async () => {
    await buyAndPay(100000, 'Продаж для виплати');

    await ctx
      .http()
      .post(`/admin/sellers/${sellerId}/payouts`)
      .set('Authorization', bearer(ADMIN))
      .send({ amountMinor: 50000, note: 'Часткова виплата' })
      .expect(201);

    const ledger = await ctx
      .http()
      .get('/seller/payouts')
      .set('Authorization', bearer(SELLER))
      .expect(200);

    expect(ledger.body).toMatchObject({
      earnedMinor: 85000,
      paidOutMinor: 50000,
      outstandingMinor: 35000,
    });
    expect(ledger.body.entries).toHaveLength(2);
    expect(ledger.body.entries[0]).toMatchObject({
      type: 'payout',
      amountMinor: -50000,
      description: 'Часткова виплата',
    });

    const notifications = await ctx
      .http()
      .get('/notifications')
      .set('Authorization', bearer(SELLER))
      .expect(200);
    expect(
      notifications.body.items.some(
        (item: { type: string }) => item.type === 'payout_recorded',
      ),
    ).toBe(true);
  });

  it('refuses to pay out more than the seller is actually owed', async () => {
    await buyAndPay(50000, 'Малий продаж');

    const overpay = await ctx
      .http()
      .post(`/admin/sellers/${sellerId}/payouts`)
      .set('Authorization', bearer(ADMIN))
      .send({ amountMinor: 999999 })
      .expect(400);
    expect(overpay.body.message).toContain('перевищує заборгованість');

    await ctx
      .http()
      .post(`/admin/sellers/${sellerId}/payouts`)
      .set('Authorization', bearer(ADMIN))
      .send({ amountMinor: 0 })
      .expect(400);
  });

  it('is closed to a seller trying to view or pay out another seller', async () => {
    const otherSellerEmail = 'other-seller@test.dev';
    await createApprovedSeller(ctx, {
      email: otherSellerEmail,
      adminEmail: ADMIN,
      displayName: 'Інша майстерня',
    });

    await buyAndPay(80000, 'Продаж чужого продавця');

    // The seller-facing endpoint only ever resolves the caller's own
    // SellerProfile id server-side — there is no :sellerId param a second
    // seller could substitute to view someone else's ledger.
    const own = await ctx
      .http()
      .get('/seller/payouts')
      .set('Authorization', bearer(otherSellerEmail))
      .expect(200);
    expect(own.body.earnedMinor).toBe(0);

    await ctx
      .http()
      .post(`/admin/sellers/${sellerId}/payouts`)
      .set('Authorization', bearer(otherSellerEmail))
      .send({ amountMinor: 100 })
      .expect(403);
  });
});
