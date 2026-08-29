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
const REFERRER = 'referrer@test.dev';
const REFERRED = 'referred@test.dev';

// The flagship domain case — see docs/adr/0005-referral-program.md. Every
// state transition in the model gets its own assertion here: claim once,
// award once, only on a genuine first purchase, never for yourself.
describe('Referral program (e2e)', () => {
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

  it('hands every new account a referral code from its very first request', async () => {
    const me = await signIn(ctx, REFERRER);
    expect(me.referralCode).toMatch(/^[A-Z2-9]{7}$/);

    const info = await ctx
      .http()
      .get('/referrals/me')
      .set('Authorization', bearer(REFERRER))
      .expect(200);
    expect(info.body.referralCode).toBe(me.referralCode);
    expect(info.body.invited).toEqual([]);
  });

  it('walks a referral from claim to bonus on the first paid order', async () => {
    const referrer = await signIn(ctx, REFERRER);
    await signIn(ctx, REFERRED);

    await ctx
      .http()
      .post('/referrals/claim')
      .set('Authorization', bearer(REFERRED))
      .send({ code: referrer.referralCode })
      .expect(201);

    const referrerInfo = await ctx
      .http()
      .get('/referrals/me')
      .set('Authorization', bearer(REFERRER))
      .expect(200);
    expect(referrerInfo.body.invited).toHaveLength(1);
    expect(referrerInfo.body.invited[0].bonusAwarded).toBe(false);

    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: { priceMinor: 50000 },
    });

    await ctx
      .http()
      .post('/cart/items')
      .set('Authorization', bearer(REFERRED))
      .send({ listingId: listing.id })
      .expect(201);

    const checkout = await ctx
      .http()
      .post('/orders/checkout')
      .set('Authorization', bearer(REFERRED))
      .expect(201);

    // Before payment: no bonus yet, being placed is not being paid.
    const beforePay = await ctx
      .http()
      .get('/referrals/me')
      .set('Authorization', bearer(REFERRER))
      .expect(200);
    expect(beforePay.body.invited[0].bonusAwarded).toBe(false);

    await ctx
      .http()
      .post('/payments/dev/confirm')
      .set('Authorization', bearer(REFERRED))
      .send({ orderNumber: checkout.body.order.number })
      .expect(201);

    const afterPay = await ctx
      .http()
      .get('/referrals/me')
      .set('Authorization', bearer(REFERRER))
      .expect(200);
    expect(afterPay.body.invited[0].bonusAwarded).toBe(true);
    expect(afterPay.body.totalBonusPoints).toBe(500);

    const loyalty = await ctx
      .http()
      .get('/me/loyalty')
      .set('Authorization', bearer(REFERRER))
      .expect(200);
    expect(loyalty.body.balance).toBe(500);
    expect(
      loyalty.body.transactions.some(
        (row: { type: string; points: number }) =>
          row.type === 'earned_referral' && row.points === 500,
      ),
    ).toBe(true);

    const notifications = await ctx
      .http()
      .get('/notifications')
      .set('Authorization', bearer(REFERRER))
      .expect(200);
    expect(
      notifications.body.items.some(
        (item: { type: string }) => item.type === 'referral_bonus',
      ),
    ).toBe(true);
  });

  it('only awards the bonus once, even if the callback retries', async () => {
    const referrer = await signIn(ctx, REFERRER);
    await signIn(ctx, REFERRED);
    await ctx
      .http()
      .post('/referrals/claim')
      .set('Authorization', bearer(REFERRED))
      .send({ code: referrer.referralCode })
      .expect(201);

    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
    });
    await ctx
      .http()
      .post('/cart/items')
      .set('Authorization', bearer(REFERRED))
      .send({ listingId: listing.id })
      .expect(201);
    const checkout = await ctx
      .http()
      .post('/orders/checkout')
      .set('Authorization', bearer(REFERRED))
      .expect(201);

    await ctx
      .http()
      .post('/payments/dev/confirm')
      .set('Authorization', bearer(REFERRED))
      .send({ orderNumber: checkout.body.order.number })
      .expect(201);
    // Idempotent markPaid: confirming an already-paid order is a no-op,
    // not a second bonus.
    await ctx
      .http()
      .post('/payments/dev/confirm')
      .set('Authorization', bearer(REFERRED))
      .send({ orderNumber: checkout.body.order.number })
      .expect(201);

    const loyalty = await ctx
      .http()
      .get('/me/loyalty')
      .set('Authorization', bearer(REFERRER))
      .expect(200);
    expect(loyalty.body.balance).toBe(500);
  });

  it('does not award a bonus for a second order, only the first', async () => {
    const referrer = await signIn(ctx, REFERRER);
    await signIn(ctx, REFERRED);
    await ctx
      .http()
      .post('/referrals/claim')
      .set('Authorization', bearer(REFERRED))
      .send({ code: referrer.referralCode })
      .expect(201);

    for (const title of ['Перше', 'Друге']) {
      const listing = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
        overrides: { title },
      });
      await ctx
        .http()
        .post('/cart/items')
        .set('Authorization', bearer(REFERRED))
        .send({ listingId: listing.id })
        .expect(201);
      const checkout = await ctx
        .http()
        .post('/orders/checkout')
        .set('Authorization', bearer(REFERRED))
        .expect(201);
      await ctx
        .http()
        .post('/payments/dev/confirm')
        .set('Authorization', bearer(REFERRED))
        .send({ orderNumber: checkout.body.order.number })
        .expect(201);
    }

    const loyalty = await ctx
      .http()
      .get('/me/loyalty')
      .set('Authorization', bearer(REFERRER))
      .expect(200);
    // 500 for the referral bonus, once — not once per order.
    const referralCredits = loyalty.body.transactions.filter(
      (row: { type: string }) => row.type === 'earned_referral',
    );
    expect(referralCredits).toHaveLength(1);
  });

  it('refuses a self-referral, a duplicate claim, and a code used after buying', async () => {
    const referrer = await signIn(ctx, REFERRER);

    await ctx
      .http()
      .post('/referrals/claim')
      .set('Authorization', bearer(REFERRER))
      .send({ code: referrer.referralCode })
      .expect(400);

    await signIn(ctx, REFERRED);
    await ctx
      .http()
      .post('/referrals/claim')
      .set('Authorization', bearer(REFERRED))
      .send({ code: referrer.referralCode })
      .expect(201);

    await ctx
      .http()
      .post('/referrals/claim')
      .set('Authorization', bearer(REFERRED))
      .send({ code: referrer.referralCode })
      .expect(409);

    // A brand-new buyer who purchases WITHOUT a referral link first can no
    // longer backdate one onto that purchase.
    const lateClaimer = 'late-claimer@test.dev';
    await signIn(ctx, lateClaimer);
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
    });
    await ctx
      .http()
      .post('/cart/items')
      .set('Authorization', bearer(lateClaimer))
      .send({ listingId: listing.id })
      .expect(201);
    const checkout = await ctx
      .http()
      .post('/orders/checkout')
      .set('Authorization', bearer(lateClaimer))
      .expect(201);
    await ctx
      .http()
      .post('/payments/dev/confirm')
      .set('Authorization', bearer(lateClaimer))
      .send({ orderNumber: checkout.body.order.number })
      .expect(201);

    const lateClaim = await ctx
      .http()
      .post('/referrals/claim')
      .set('Authorization', bearer(lateClaimer))
      .send({ code: referrer.referralCode })
      .expect(409);
    expect(lateClaim.body.message).toContain('першої покупки');
  });

  it('rejects an unknown referral code', async () => {
    await signIn(ctx, REFERRED);
    await ctx
      .http()
      .post('/referrals/claim')
      .set('Authorization', bearer(REFERRED))
      .send({ code: 'NOPE123' })
      .expect(404);
  });
});
