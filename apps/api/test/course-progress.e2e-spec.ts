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

const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const curriculumWithVideo = {
  modules: [
    {
      title: 'Модуль 1',
      lessons: [
        { title: '1 заняття. Вступ', videoUrl: VIDEO_URL },
        { title: '2 заняття. Практика' },
      ],
    },
  ],
};

// docs/migration-plan.md Phase D1/D2/D3: videoUrl must be invisible to
// anyone who has not bought the course, visible (and toggleable as
// watched) to anyone who has.
describe('Course video gating and lesson progress (e2e)', () => {
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

  async function buyListing(listingId: string) {
    await signIn(ctx, BUYER);
    await ctx
      .http()
      .post('/cart/items')
      .set('Authorization', bearer(BUYER))
      .send({ listingId })
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

  it('strips videoUrl from the public catalog detail response', async () => {
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: { curriculum: curriculumWithVideo },
    });

    const detail = await ctx.http().get(`/catalog/${listing.slug}`).expect(200);

    const lessons = detail.body.curriculum.modules[0].lessons;
    expect(lessons[0].title).toBe('1 заняття. Вступ');
    expect(lessons[0].videoUrl).toBeUndefined();
    expect(JSON.stringify(detail.body)).not.toContain(VIDEO_URL);
  });

  it('returns videoUrl on GET /me/library/:slug only after purchase', async () => {
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: { curriculum: curriculumWithVideo },
    });

    // Not entitled yet: 404, not a stripped-down 200.
    await signIn(ctx, BUYER);
    await ctx
      .http()
      .get(`/me/library/${listing.slug}`)
      .set('Authorization', bearer(BUYER))
      .expect(404);

    await buyListing(listing.id);

    const item = await ctx
      .http()
      .get(`/me/library/${listing.slug}`)
      .set('Authorization', bearer(BUYER))
      .expect(200);

    expect(item.body.listing.curriculum.modules[0].lessons[0].videoUrl).toBe(
      VIDEO_URL,
    );
    expect(item.body.progress).toEqual([]);
  });

  it('a stranger never sees the entitled view', async () => {
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: { curriculum: curriculumWithVideo },
    });
    await buyListing(listing.id);

    await signIn(ctx, STRANGER);
    await ctx
      .http()
      .get(`/me/library/${listing.slug}`)
      .set('Authorization', bearer(STRANGER))
      .expect(404);
  });

  it('marks a lesson watched, then unwatched, only for the buyer who owns it', async () => {
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: { curriculum: curriculumWithVideo },
    });
    await buyListing(listing.id);

    const marked = await ctx
      .http()
      .post(`/me/library/${listing.slug}/progress`)
      .set('Authorization', bearer(BUYER))
      .send({ moduleIndex: 0, lessonIndex: 0, completed: true })
      .expect(201);
    expect(marked.body).toEqual([{ moduleIndex: 0, lessonIndex: 0 }]);

    const item = await ctx
      .http()
      .get(`/me/library/${listing.slug}`)
      .set('Authorization', bearer(BUYER))
      .expect(200);
    expect(item.body.progress).toEqual([{ moduleIndex: 0, lessonIndex: 0 }]);

    const unmarked = await ctx
      .http()
      .post(`/me/library/${listing.slug}/progress`)
      .set('Authorization', bearer(BUYER))
      .send({ moduleIndex: 0, lessonIndex: 0, completed: false })
      .expect(201);
    expect(unmarked.body).toEqual([]);

    // Marking the same lesson complete twice must not create two rows —
    // upsert, not insert.
    await ctx
      .http()
      .post(`/me/library/${listing.slug}/progress`)
      .set('Authorization', bearer(BUYER))
      .send({ moduleIndex: 0, lessonIndex: 0, completed: true })
      .expect(201);
    const again = await ctx
      .http()
      .post(`/me/library/${listing.slug}/progress`)
      .set('Authorization', bearer(BUYER))
      .send({ moduleIndex: 0, lessonIndex: 0, completed: true })
      .expect(201);
    expect(again.body).toEqual([{ moduleIndex: 0, lessonIndex: 0 }]);
  });

  it('refuses to record progress for a listing the caller has not bought', async () => {
    const listing = await publishListing(ctx, {
      sellerEmail: SELLER,
      adminEmail: ADMIN,
      overrides: { curriculum: curriculumWithVideo },
    });

    await signIn(ctx, STRANGER);
    await ctx
      .http()
      .post(`/me/library/${listing.slug}/progress`)
      .set('Authorization', bearer(STRANGER))
      .send({ moduleIndex: 0, lessonIndex: 0, completed: true })
      .expect(404);
  });
});
