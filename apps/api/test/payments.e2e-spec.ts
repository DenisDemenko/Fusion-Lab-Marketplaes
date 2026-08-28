import crypto from 'node:crypto';
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

const PUBLIC_KEY = 'sandbox_i000000000';
const PRIVATE_KEY = 'sandbox_test_private_key';

// Signs the way LiqPay does, independently of the code under test: if
// LiqpayService ever changes its algorithm, this test fails instead of
// agreeing with the bug.
function sign(data: string): string {
  return crypto
    .createHash('sha1')
    .update(PRIVATE_KEY + data + PRIVATE_KEY)
    .digest('base64');
}

function callbackBody(payload: Record<string, unknown>) {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return { data, signature: sign(data) };
}

describe('LiqPay payments (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // Set before the app is built so the checkout payload is produced as a
    // configured gateway would produce it.
    process.env.LIQPAY_PUBLIC_KEY = PUBLIC_KEY;
    process.env.LIQPAY_PRIVATE_KEY = PRIVATE_KEY;
    ctx = await createTestApp();
  });

  afterAll(async () => {
    delete process.env.LIQPAY_PUBLIC_KEY;
    delete process.env.LIQPAY_PRIVATE_KEY;
    await ctx.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await makeAdmin(ctx, ADMIN);
    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });
  });

  async function placeOrder(overrides?: Record<string, unknown>) {
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides,
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

    return { listing, checkout: checkout.body };
  }

  it('hands the frontend a signed checkout payload', async () => {
    const { checkout } = await placeOrder({ priceMinor: 450000 });

    expect(checkout.payment).toMatchObject({
      provider: 'liqpay',
      configured: true,
      actionUrl: 'https://www.liqpay.ua/api/3/checkout',
    });

    const decoded = JSON.parse(
      Buffer.from(checkout.payment.data, 'base64').toString('utf8'),
    );

    expect(decoded).toMatchObject({
      public_key: PUBLIC_KEY,
      action: 'pay',
      version: '3',
      currency: 'UAH',
      order_id: checkout.order.number,
      // Minor units in the domain, major units on the wire.
      amount: 4500,
    });
    expect(checkout.payment.signature).toBe(sign(checkout.payment.data));
  });

  it('marks an order paid on a correctly signed success callback', async () => {
    const { listing, checkout } = await placeOrder();

    const response = await ctx
      .http()
      .post('/payments/liqpay/callback')
      .type('form')
      .send(
        callbackBody({
          status: 'sandbox',
          order_id: checkout.order.number,
          amount: 4500,
          currency: 'UAH',
          payment_id: 987654321,
        }),
      )
      .expect(200);

    expect(response.body).toMatchObject({ accepted: true, status: 'sandbox' });

    const order = await ctx
      .http()
      .get(`/orders/${checkout.order.number}`)
      .set('Authorization', bearer(BUYER))
      .expect(200);

    expect(order.body.order.status).toBe('paid');
    expect(order.body.order.payment.providerPaymentId).toBe('987654321');

    await ctx
      .http()
      .get(`/media/${listing.fileMediaId}/download`)
      .set('Authorization', bearer(BUYER))
      .expect(200);
  });

  // The callback URL is public: without this check, anyone who knows an
  // order number could take goods for free.
  it('ignores a callback whose signature does not match', async () => {
    const { checkout } = await placeOrder();

    const body = callbackBody({
      status: 'success',
      order_id: checkout.order.number,
      amount: 4500,
      currency: 'UAH',
    });

    const response = await ctx
      .http()
      .post('/payments/liqpay/callback')
      .type('form')
      .send({ data: body.data, signature: 'not-the-right-signature' })
      .expect(200);

    expect(response.body).toEqual({
      accepted: false,
      reason: 'invalid_signature',
    });

    const order = await ctx.prisma.order.findUniqueOrThrow({
      where: { number: checkout.order.number },
    });
    expect(order.status).toBe('pending');
    expect(await ctx.prisma.entitlement.count()).toBe(0);
  });

  it('fails the order and restores stock on a declined payment', async () => {
    const { listing, checkout } = await placeOrder({
      kind: 'product',
      title: 'Набір моделей для школи',
      curriculum: undefined,
      stock: 4,
    });

    const reserved = await ctx.prisma.listing.findUniqueOrThrow({
      where: { id: listing.id },
    });
    expect(reserved.stock).toBe(3);

    await ctx
      .http()
      .post('/payments/liqpay/callback')
      .type('form')
      .send(
        callbackBody({
          status: 'failure',
          order_id: checkout.order.number,
          amount: 4500,
          currency: 'UAH',
          err_description: 'Недостатньо коштів',
        }),
      )
      .expect(200);

    const restored = await ctx.prisma.listing.findUniqueOrThrow({
      where: { id: listing.id },
    });
    expect(restored.stock).toBe(4);

    const order = await ctx.prisma.order.findUniqueOrThrow({
      where: { number: checkout.order.number },
    });
    expect(order.status).toBe('failed');
  });

  it('leaves the order pending on an intermediate status', async () => {
    const { checkout } = await placeOrder();

    const response = await ctx
      .http()
      .post('/payments/liqpay/callback')
      .type('form')
      .send(
        callbackBody({
          status: 'processing',
          order_id: checkout.order.number,
          amount: 4500,
          currency: 'UAH',
        }),
      )
      .expect(200);

    expect(response.body.ignored).toBe(true);

    const order = await ctx.prisma.order.findUniqueOrThrow({
      where: { number: checkout.order.number },
    });
    expect(order.status).toBe('pending');
  });

  // The demo confirmation is the one thing that must not survive real keys.
  it('disables the demo confirmation endpoint when LiqPay is configured', async () => {
    const { checkout } = await placeOrder();

    await ctx
      .http()
      .post('/payments/dev/confirm')
      .set('Authorization', bearer(BUYER))
      .send({ orderNumber: checkout.order.number })
      .expect(404);
  });
});
