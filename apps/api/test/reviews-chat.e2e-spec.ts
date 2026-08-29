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
const STRANGER = 'stranger@test.dev';

describe('Reviews and buyer<->seller chat (e2e)', () => {
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

  describe('reviews', () => {
    it('refuses a review from someone who never bought the listing', async () => {
      const listing = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
      });

      await signIn(ctx, STRANGER);
      const refused = await ctx
        .http()
        .put(`/reviews/${listing.id}`)
        .set('Authorization', bearer(STRANGER))
        .send({ rating: 5, body: 'Чудово!' })
        .expect(403);
      expect(refused.body.message).toContain('після покупки');
    });

    it('lets a buyer review after purchase, edit it, and see it aggregated', async () => {
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

      const created = await ctx
        .http()
        .put(`/reviews/${listing.id}`)
        .set('Authorization', bearer(BUYER))
        .send({ rating: 4, body: 'Добре, але є куди рости' })
        .expect(200);
      expect(created.body.rating).toBe(4);

      const sellerNotifications = await ctx
        .http()
        .get('/notifications')
        .set('Authorization', bearer(SELLER))
        .expect(200);
      expect(
        sellerNotifications.body.items.some(
          (item: { type: string }) => item.type === 'review_posted',
        ),
      ).toBe(true);

      // Editing is an upsert, not a second review — the unique constraint
      // on (listingId, userId) is exactly what makes that true.
      const edited = await ctx
        .http()
        .put(`/reviews/${listing.id}`)
        .set('Authorization', bearer(BUYER))
        .send({ rating: 5, body: 'Переглянув думку — чудово' })
        .expect(200);
      expect(edited.body.rating).toBe(5);

      const list = await ctx.http().get(`/reviews/${listing.id}`).expect(200);
      expect(list.body).toMatchObject({ average: 5, count: 1 });
      expect(list.body.reviews[0].body).toContain('чудово');

      const mine = await ctx
        .http()
        .get(`/reviews/${listing.id}/mine`)
        .set('Authorization', bearer(BUYER))
        .expect(200);
      expect(mine.body.rating).toBe(5);

      await ctx
        .http()
        .delete(`/reviews/${listing.id}`)
        .set('Authorization', bearer(BUYER))
        .expect(200);

      const afterDelete = await ctx
        .http()
        .get(`/reviews/${listing.id}`)
        .expect(200);
      expect(afterDelete.body.count).toBe(0);
    });

    it('rejects a rating outside 1-5', async () => {
      const listing = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
      });
      await signIn(ctx, BUYER);

      await ctx
        .http()
        .put(`/reviews/${listing.id}`)
        .set('Authorization', bearer(BUYER))
        .send({ rating: 6 })
        .expect(400);
      await ctx
        .http()
        .put(`/reviews/${listing.id}`)
        .set('Authorization', bearer(BUYER))
        .send({ rating: 0 })
        .expect(400);
    });
  });

  describe('chat', () => {
    it('opens a thread, exchanges messages, and marks them read on open', async () => {
      const listing = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
      });

      await signIn(ctx, BUYER);
      const opened = await ctx
        .http()
        .post('/chat/threads')
        .set('Authorization', bearer(BUYER))
        .send({ listingId: listing.id })
        .expect(201);
      const threadId = opened.body.id as string;

      await ctx
        .http()
        .post(`/chat/threads/${threadId}/messages`)
        .set('Authorization', bearer(BUYER))
        .send({ body: 'Чи є знижка для гуртової закупівлі?' })
        .expect(201);

      const sellerUnread = await ctx
        .http()
        .get('/chat/unread-count')
        .set('Authorization', bearer(SELLER))
        .expect(200);
      expect(sellerUnread.body.count).toBe(1);

      const sellerThreads = await ctx
        .http()
        .get('/chat/threads')
        .set('Authorization', bearer(SELLER))
        .expect(200);
      expect(sellerThreads.body[0]).toMatchObject({
        unreadCount: 1,
        lastMessage: 'Чи є знижка для гуртової закупівлі?',
      });

      await ctx
        .http()
        .post(`/chat/threads/${threadId}/messages`)
        .set('Authorization', bearer(SELLER))
        .send({ body: 'Так, від 10 штук — 10%' })
        .expect(201);

      // Reading the thread marks the counterpart's messages read — this
      // is what makes the buyer's unread count drop without a separate
      // "mark read" action.
      const buyerUnreadBefore = await ctx
        .http()
        .get('/chat/unread-count')
        .set('Authorization', bearer(BUYER))
        .expect(200);
      expect(buyerUnreadBefore.body.count).toBe(1);

      const opened2 = await ctx
        .http()
        .get(`/chat/threads/${threadId}/messages`)
        .set('Authorization', bearer(BUYER))
        .expect(200);
      expect(opened2.body.messages).toHaveLength(2);
      expect(
        opened2.body.messages.map((m: { mine: boolean }) => m.mine),
      ).toEqual([true, false]);

      const buyerUnreadAfter = await ctx
        .http()
        .get('/chat/unread-count')
        .set('Authorization', bearer(BUYER))
        .expect(200);
      expect(buyerUnreadAfter.body.count).toBe(0);
    });

    it('reuses the same thread when a buyer reopens it', async () => {
      const listing = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
      });
      await signIn(ctx, BUYER);

      const first = await ctx
        .http()
        .post('/chat/threads')
        .set('Authorization', bearer(BUYER))
        .send({ listingId: listing.id })
        .expect(201);
      const second = await ctx
        .http()
        .post('/chat/threads')
        .set('Authorization', bearer(BUYER))
        .send({ listingId: listing.id })
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
    });

    it('refuses a seller opening a chat on their own listing, and a stranger reading someone else thread', async () => {
      const listing = await publishListing(ctx, {
        sellerEmail: SELLER,
        adminEmail: ADMIN,
      });

      await ctx
        .http()
        .post('/chat/threads')
        .set('Authorization', bearer(SELLER))
        .send({ listingId: listing.id })
        .expect(400);

      await signIn(ctx, BUYER);
      const thread = await ctx
        .http()
        .post('/chat/threads')
        .set('Authorization', bearer(BUYER))
        .send({ listingId: listing.id })
        .expect(201);

      await signIn(ctx, STRANGER);
      await ctx
        .http()
        .get(`/chat/threads/${thread.body.id}/messages`)
        .set('Authorization', bearer(STRANGER))
        .expect(403);
      await ctx
        .http()
        .post(`/chat/threads/${thread.body.id}/messages`)
        .set('Authorization', bearer(STRANGER))
        .send({ body: 'Втручання' })
        .expect(403);
    });
  });
});
