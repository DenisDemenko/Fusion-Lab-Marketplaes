import {
  bearer,
  createTestApp,
  resetDatabase,
  type TestContext,
} from './utils/test-app';
import { OrdersService } from '../src/orders/orders.service';
import {
  createApprovedSeller,
  makeAdmin,
  publishListing,
  signIn,
  stlFile,
} from './utils/fixtures';

const ADMIN = 'admin@test.dev';
const SELLER = 'seller@test.dev';
const BUYER = 'buyer@test.dev';
const STRANGER = 'stranger@test.dev';

// Cart → checkout → payment → entitlement → download. This is the path the
// money takes, so every step is asserted, including the ones that must
// fail: an unpaid order grants nothing, and a stranger downloads nothing.
describe('Purchase and download (e2e)', () => {
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

  it('buys a course and unlocks its files', async () => {
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
    });

    await signIn(ctx, BUYER);

    const cart = await ctx
      .http()
      .post('/cart/items')
      .set('Authorization', bearer(BUYER))
      .send({ listingId: listing.id })
      .expect(201);

    expect(cart.body.count).toBe(1);
    expect(cart.body.totalMinor).toBe(listing.priceMinor);

    // Before paying: the file is listed on the page but refuses to serve.
    await ctx
      .http()
      .get(`/media/${listing.fileMediaId}/download`)
      .set('Authorization', bearer(BUYER))
      .expect(403);

    const checkout = await ctx
      .http()
      .post('/orders/checkout')
      .set('Authorization', bearer(BUYER))
      .expect(201);

    const orderNumber = checkout.body.order.number as string;
    expect(checkout.body.order.status).toBe('pending');
    expect(orderNumber).toMatch(/^FL-\d{8}-[0-9A-F]{6}$/);
    // No LiqPay keys in the test environment, so the API says so instead
    // of handing out a signature made with an empty secret.
    expect(checkout.body.payment.configured).toBe(false);

    // The cart is emptied by checkout, not by the frontend.
    const emptied = await ctx
      .http()
      .get('/cart')
      .set('Authorization', bearer(BUYER))
      .expect(200);
    expect(emptied.body.count).toBe(0);

    // Still nothing unlocked: an order that is not paid grants nothing.
    await ctx
      .http()
      .get(`/media/${listing.fileMediaId}/download`)
      .set('Authorization', bearer(BUYER))
      .expect(403);

    const paid = await ctx
      .http()
      .post('/payments/dev/confirm')
      .set('Authorization', bearer(BUYER))
      .send({ orderNumber })
      .expect(201);

    expect(paid.body.status).toBe('paid');
    expect(paid.body.paidAt).toBeTruthy();

    const library = await ctx
      .http()
      .get('/me/library')
      .set('Authorization', bearer(BUYER))
      .expect(200);

    expect(library.body).toHaveLength(1);
    expect(library.body[0].listing.slug).toBe(listing.slug);
    expect(library.body[0].orderNumber).toBe(orderNumber);
    expect(library.body[0].files).toHaveLength(2);

    const download = await ctx
      .http()
      .get(`/media/${listing.fileMediaId}/download`)
      .set('Authorization', bearer(BUYER))
      .responseType('blob')
      .expect(200);

    expect(download.body).toEqual(stlFile);
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.headers['cache-control']).toBe('private, no-store');

    const notifications = await ctx
      .http()
      .get('/notifications')
      .set('Authorization', bearer(BUYER))
      .expect(200);

    expect(notifications.body.items[0].type).toBe('order_paid');
  });

  it('serves covers to anyone and paid files to no one else', async () => {
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
    });

    // A catalogue card is fetched by an <img> tag with no token at all.
    const cover = await ctx
      .http()
      .get(`/media/${listing.coverMediaId}/download`)
      .expect(200);
    expect(cover.headers['content-type']).toContain('image/png');
    expect(cover.headers['cache-control']).toContain('immutable');

    await ctx.http().get(`/media/${listing.fileMediaId}/download`).expect(401);

    await signIn(ctx, STRANGER);
    await ctx
      .http()
      .get(`/media/${listing.fileMediaId}/download`)
      .set('Authorization', bearer(STRANGER))
      .expect(403);

    // The seller reaches their own file without buying it, and so does an
    // admin — both need it to support the people who did buy.
    await ctx
      .http()
      .get(`/media/${listing.fileMediaId}/download`)
      .set('Authorization', bearer(SELLER))
      .expect(200);

    await ctx
      .http()
      .get(`/media/${listing.fileMediaId}/download`)
      .set('Authorization', bearer(ADMIN))
      .expect(200);
  });

  it('refuses to sell the same digital item twice', async () => {
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

    const again = await ctx
      .http()
      .post('/cart/items')
      .set('Authorization', bearer(BUYER))
      .send({ listingId: listing.id })
      .expect(409);

    expect(again.body.message).toContain('вже маєте доступ');
  });

  it('reserves stock at checkout and refuses to oversell', async () => {
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: {
        kind: 'product',
        title: 'Друкована рама квадрокоптера',
        curriculum: undefined,
        stock: 2,
        priceMinor: 210000,
      },
    });

    await signIn(ctx, BUYER);

    // Asking for more than exists is rejected at the cart, before anyone
    // reaches a payment page.
    const tooMany = await ctx
      .http()
      .post('/cart/items')
      .set('Authorization', bearer(BUYER))
      .send({ listingId: listing.id, quantity: 5 })
      .expect(400);
    expect(tooMany.body.message).toContain('лише 2');

    await ctx
      .http()
      .post('/cart/items')
      .set('Authorization', bearer(BUYER))
      .send({ listingId: listing.id, quantity: 2 })
      .expect(201);

    await ctx
      .http()
      .post('/orders/checkout')
      .set('Authorization', bearer(BUYER))
      .expect(201);

    const afterCheckout = await ctx.prisma.listing.findUniqueOrThrow({
      where: { id: listing.id },
    });
    expect(afterCheckout.stock).toBe(0);

    // The shelf is empty for the next buyer.
    await signIn(ctx, STRANGER);
    const soldOut = await ctx
      .http()
      .post('/cart/items')
      .set('Authorization', bearer(STRANGER))
      .send({ listingId: listing.id })
      .expect(400);
    expect(soldOut.body.message).toContain('немає в наявності');
  });

  it('returns reserved stock when a payment fails', async () => {
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: {
        kind: 'product',
        title: 'Керамічна ваза лабораторії',
        curriculum: undefined,
        stock: 3,
        priceMinor: 190000,
      },
    });

    await signIn(ctx, BUYER);
    await ctx
      .http()
      .post('/cart/items')
      .set('Authorization', bearer(BUYER))
      .send({ listingId: listing.id, quantity: 2 })
      .expect(201);

    const checkout = await ctx
      .http()
      .post('/orders/checkout')
      .set('Authorization', bearer(BUYER))
      .expect(201);

    // The gateway normally drives this through its callback (covered in
    // payments.e2e-spec.ts); here the service is called directly to assert
    // what the failure does to reserved stock.
    await ctx.app
      .get(OrdersService)
      .markFailed(checkout.body.order.number, 'Картку відхилено');

    const restored = await ctx.prisma.listing.findUniqueOrThrow({
      where: { id: listing.id },
    });
    expect(restored.stock).toBe(3);

    const order = await ctx
      .http()
      .get(`/orders/${checkout.body.order.number}`)
      .set('Authorization', bearer(BUYER))
      .expect(200);
    expect(order.body.order.status).toBe('failed');
  });

  it('is idempotent about confirming the same payment twice', async () => {
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

    const checkout = await ctx
      .http()
      .post('/orders/checkout')
      .set('Authorization', bearer(BUYER))
      .expect(201);

    const orderNumber = checkout.body.order.number;

    await ctx
      .http()
      .post('/payments/dev/confirm')
      .set('Authorization', bearer(BUYER))
      .send({ orderNumber })
      .expect(201);

    const second = await ctx
      .http()
      .post('/payments/dev/confirm')
      .set('Authorization', bearer(BUYER))
      .send({ orderNumber })
      .expect(201);

    expect(second.body.alreadyProcessed).toBe(true);

    const entitlements = await ctx.prisma.entitlement.count();
    expect(entitlements).toBe(1);
  });

  it('will not confirm someone else order', async () => {
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

    const checkout = await ctx
      .http()
      .post('/orders/checkout')
      .set('Authorization', bearer(BUYER))
      .expect(201);

    await signIn(ctx, STRANGER);
    await ctx
      .http()
      .post('/payments/dev/confirm')
      .set('Authorization', bearer(STRANGER))
      .send({ orderNumber: checkout.body.order.number })
      .expect(404);
  });

  it('refuses to delete a listing that has been sold, and archives instead', async () => {
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

    const refused = await ctx
      .http()
      .delete(`/seller/listings/${listing.id}`)
      .set('Authorization', bearer(SELLER))
      .expect(409);
    expect(refused.body.message).toContain('архівувати');

    await ctx
      .http()
      .post(`/seller/listings/${listing.id}/archive`)
      .set('Authorization', bearer(SELLER))
      .expect(201);

    // Gone from the catalogue, still in the buyer's library.
    await ctx.http().get(`/catalog/${listing.slug}`).expect(404);

    const library = await ctx
      .http()
      .get('/me/library')
      .set('Authorization', bearer(BUYER))
      .expect(200);
    expect(library.body).toHaveLength(1);

    await ctx
      .http()
      .get(`/media/${listing.fileMediaId}/download`)
      .set('Authorization', bearer(BUYER))
      .expect(200);
  });

  it('reports what the seller earned after commission', async () => {
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

    const sales = await ctx
      .http()
      .get('/seller/orders')
      .set('Authorization', bearer(SELLER))
      .expect(200);

    // 15% default commission on 1000.00 грн.
    expect(sales.body[0]).toMatchObject({
      orderStatus: 'paid',
      unitPriceMinor: 100000,
      commissionMinor: 15000,
      payoutMinor: 85000,
    });

    const profile = await ctx
      .http()
      .get('/seller/me')
      .set('Authorization', bearer(SELLER))
      .expect(200);

    expect(profile.body.stats).toMatchObject({
      itemsSold: 1,
      grossMinor: 100000,
      commissionMinor: 15000,
      payoutMinor: 85000,
    });
  });
});
