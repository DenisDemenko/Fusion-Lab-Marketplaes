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

describe('Admin panel (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await makeAdmin(ctx, ADMIN);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('is closed to buyers and sellers', async () => {
    await signIn(ctx, BUYER);

    await ctx.http().get('/admin/stats').expect(401);
    await ctx
      .http()
      .get('/admin/stats')
      .set('Authorization', bearer(BUYER))
      .expect(403);
    await ctx
      .http()
      .get('/admin/users')
      .set('Authorization', bearer(BUYER))
      .expect(403);
  });

  it('reports marketplace numbers that match the data', async () => {
    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });
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

    const stats = await ctx
      .http()
      .get('/admin/stats')
      .set('Authorization', bearer(ADMIN))
      .expect(200);

    expect(stats.body).toMatchObject({
      users: 3,
      listingsPublished: 1,
      listingsPending: 0,
      paidOrders: 1,
      grossMinor: 100000,
      commissionMinor: 15000,
      grossLabel: '1000.00 грн',
    });
  });

  it('approves and rejects seller applications', async () => {
    await signIn(ctx, SELLER);
    const application = await ctx
      .http()
      .post('/seller/apply')
      .set('Authorization', bearer(SELLER))
      .send({ displayName: 'Майстерня на розгляді' })
      .expect(201);

    const pending = await ctx
      .http()
      .get('/admin/sellers?status=pending')
      .set('Authorization', bearer(ADMIN))
      .expect(200);
    expect(pending.body).toHaveLength(1);

    await ctx
      .http()
      .post(`/admin/sellers/${application.body.id}/reject`)
      .set('Authorization', bearer(ADMIN))
      .send({ reason: 'Немає портфоліо' })
      .expect(201);

    const stillRefused = await ctx
      .http()
      .get('/seller/listings')
      .set('Authorization', bearer(SELLER))
      .expect(403);
    expect(stillRefused.body.message).toContain('rejected');

    await ctx
      .http()
      .post(`/admin/sellers/${application.body.id}/approve`)
      .set('Authorization', bearer(ADMIN))
      .expect(201);

    // Approval promotes the account: the profile and the user row have to
    // agree, or role checks and seller checks disagree forever after.
    const me = await signIn(ctx, SELLER);
    expect(me.role).toBe('seller');
    expect(me.seller?.status).toBe('approved');
  });

  it('changes user roles but will not let an admin demote themselves', async () => {
    await signIn(ctx, BUYER);

    const users = await ctx
      .http()
      .get('/admin/users')
      .query({ q: 'buyer@' })
      .set('Authorization', bearer(ADMIN))
      .expect(200);

    expect(users.body).toHaveLength(1);
    const buyerId = users.body[0].id;

    await ctx
      .http()
      .patch(`/admin/users/${buyerId}/role`)
      .set('Authorization', bearer(ADMIN))
      .send({ role: 'admin' })
      .expect(200);

    const promoted = await signIn(ctx, BUYER);
    expect(promoted.role).toBe('admin');

    const adminUser = await ctx.prisma.user.findUniqueOrThrow({
      where: { email: ADMIN },
    });

    const refused = await ctx
      .http()
      .patch(`/admin/users/${adminUser.id}/role`)
      .set('Authorization', bearer(ADMIN))
      .send({ role: 'buyer' })
      .expect(400);

    expect(refused.body.message).toContain('Не можна зняти з себе');
  });

  it('manages categories and refuses to delete one still in use', async () => {
    const created = await ctx
      .http()
      .post('/admin/categories')
      .set('Authorization', bearer(ADMIN))
      .send({ name: 'Робототехніка' })
      .expect(201);

    expect(created.body.slug).toBe('robototekhnika');

    await ctx
      .http()
      .post('/admin/categories')
      .set('Authorization', bearer(ADMIN))
      .send({ name: 'Робототехніка', slug: 'robototekhnika' })
      .expect(409);

    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });
    await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: { categorySlug: 'robototekhnika' },
    });

    const blocked = await ctx
      .http()
      .delete('/admin/categories/robototekhnika')
      .set('Authorization', bearer(ADMIN))
      .expect(409);
    expect(blocked.body.message).toContain('використовується');
  });

  it('shows every order with its buyer and payment state', async () => {
    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
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

    const pending = await ctx
      .http()
      .get('/admin/orders?status=pending')
      .set('Authorization', bearer(ADMIN))
      .expect(200);

    expect(pending.body).toHaveLength(1);
    expect(pending.body[0]).toMatchObject({
      buyerEmail: BUYER,
      status: 'pending',
      itemCount: 1,
      payment: { provider: 'liqpay', status: 'pending' },
    });
  });

  it('marks notifications read', async () => {
    await signIn(ctx, SELLER);
    await ctx
      .http()
      .post('/seller/apply')
      .set('Authorization', bearer(SELLER))
      .send({ displayName: 'Заявка для сповіщення' })
      .expect(201);

    const before = await ctx
      .http()
      .get('/notifications')
      .set('Authorization', bearer(ADMIN))
      .expect(200);

    expect(before.body.unread).toBe(1);
    expect(before.body.items[0].type).toBe('seller_application');

    await ctx
      .http()
      .post(`/notifications/${before.body.items[0].id}/read`)
      .set('Authorization', bearer(ADMIN))
      .expect(201);

    const after = await ctx
      .http()
      .get('/notifications')
      .set('Authorization', bearer(ADMIN))
      .expect(200);
    expect(after.body.unread).toBe(0);

    // Another account cannot mark a notification that is not theirs.
    await signIn(ctx, BUYER);
    const foreign = await ctx
      .http()
      .post(`/notifications/${before.body.items[0].id}/read`)
      .set('Authorization', bearer(BUYER))
      .expect(201);
    expect(foreign.body.updated).toBe(0);
  });
});
