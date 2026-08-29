import {
  bearer,
  createTestApp,
  resetDatabase,
  type TestContext,
} from './utils/test-app';
import { makeAdmin, signIn } from './utils/fixtures';

const ADMIN = 'admin@test.dev';
const BUYER = 'buyer@test.dev';
const BUYER_2 = 'buyer2@test.dev';
const BUYER_3 = 'buyer3@test.dev';

function inTwoDays(): string {
  return new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
}

// docs/migration-plan.md Phase F2: real, capacity-checked booking for the
// lab's offline sessions — the point of this suite is proving the
// capacity guard actually holds under concurrency, not just in sequence.
describe('Class schedule and booking (e2e)', () => {
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

  async function createSlot(capacity: number) {
    const created = await ctx
      .http()
      .post('/admin/schedule')
      .set('Authorization', bearer(ADMIN))
      .send({
        title: 'Робототехніка для дітей',
        direction: 'robotics',
        startsAt: inTwoDays(),
        capacity,
      })
      .expect(201);
    return created.body.id as string;
  }

  it('is closed to non-admins for slot management', async () => {
    await signIn(ctx, BUYER);
    await ctx
      .http()
      .post('/admin/schedule')
      .set('Authorization', bearer(BUYER))
      .send({ title: 'x', startsAt: inTwoDays(), capacity: 1 })
      .expect(403);
  });

  it('books a seat, shows it in /me/bookings, and lets the buyer cancel it', async () => {
    const scheduleId = await createSlot(12);
    await signIn(ctx, BUYER);

    const booked = await ctx
      .http()
      .post(`/schedule/${scheduleId}/book`)
      .set('Authorization', bearer(BUYER))
      .expect(201);
    expect(booked.body.status).toBe('confirmed');

    const list = await ctx.http().get('/schedule').expect(200);
    expect(list.body.find((s: { id: string }) => s.id === scheduleId).bookedCount).toBe(1);

    const mine = await ctx
      .http()
      .get('/me/bookings')
      .set('Authorization', bearer(BUYER))
      .expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].schedule.id).toBe(scheduleId);

    await ctx
      .http()
      .delete(`/schedule/${scheduleId}/book`)
      .set('Authorization', bearer(BUYER))
      .expect(200);

    const afterCancel = await ctx
      .http()
      .get('/me/bookings')
      .set('Authorization', bearer(BUYER))
      .expect(200);
    expect(afterCancel.body).toHaveLength(0);

    const scheduleAfter = await ctx.prisma.classSchedule.findUniqueOrThrow({
      where: { id: scheduleId },
    });
    expect(scheduleAfter.bookedCount).toBe(0);
  });

  it('refuses a second booking from the same buyer', async () => {
    const scheduleId = await createSlot(12);
    await signIn(ctx, BUYER);

    await ctx
      .http()
      .post(`/schedule/${scheduleId}/book`)
      .set('Authorization', bearer(BUYER))
      .expect(201);

    await ctx
      .http()
      .post(`/schedule/${scheduleId}/book`)
      .set('Authorization', bearer(BUYER))
      .expect(409);
  });

  it('lets a buyer re-book after cancelling, without leaking a phantom seat', async () => {
    const scheduleId = await createSlot(12);
    await signIn(ctx, BUYER);

    await ctx
      .http()
      .post(`/schedule/${scheduleId}/book`)
      .set('Authorization', bearer(BUYER))
      .expect(201);
    await ctx
      .http()
      .delete(`/schedule/${scheduleId}/book`)
      .set('Authorization', bearer(BUYER))
      .expect(200);
    await ctx
      .http()
      .post(`/schedule/${scheduleId}/book`)
      .set('Authorization', bearer(BUYER))
      .expect(201);

    const schedule = await ctx.prisma.classSchedule.findUniqueOrThrow({
      where: { id: scheduleId },
    });
    expect(schedule.bookedCount).toBe(1);

    const bookings = await ctx.prisma.classBooking.count({
      where: { scheduleId, userId: (await ctx.prisma.user.findFirstOrThrow({ where: { email: BUYER } })).id },
    });
    // Re-booking reuses the same row (upsert-by-status), not a second one.
    expect(bookings).toBe(1);
  });

  it('refuses to book once the slot is full, sequentially', async () => {
    const scheduleId = await createSlot(1);
    await signIn(ctx, BUYER);
    await ctx
      .http()
      .post(`/schedule/${scheduleId}/book`)
      .set('Authorization', bearer(BUYER))
      .expect(201);

    await signIn(ctx, BUYER_2);
    await ctx
      .http()
      .post(`/schedule/${scheduleId}/book`)
      .set('Authorization', bearer(BUYER_2))
      .expect(409);
  });

  // The real point of this suite: three different people racing for two
  // seats must never leave bookedCount at 3, or let all three "succeed".
  it('holds the capacity guard under real concurrency, not just in sequence', async () => {
    const scheduleId = await createSlot(2);
    await signIn(ctx, BUYER);
    await signIn(ctx, BUYER_2);
    await signIn(ctx, BUYER_3);

    const results = await Promise.allSettled([
      ctx.http().post(`/schedule/${scheduleId}/book`).set('Authorization', bearer(BUYER)),
      ctx.http().post(`/schedule/${scheduleId}/book`).set('Authorization', bearer(BUYER_2)),
      ctx.http().post(`/schedule/${scheduleId}/book`).set('Authorization', bearer(BUYER_3)),
    ]);

    const statuses = results.map((result) =>
      result.status === 'fulfilled' ? result.value.status : -1,
    );
    const succeeded = statuses.filter((status) => status === 201).length;
    const refused = statuses.filter((status) => status === 409).length;

    expect(succeeded).toBe(2);
    expect(refused).toBe(1);

    const schedule = await ctx.prisma.classSchedule.findUniqueOrThrow({
      where: { id: scheduleId },
    });
    expect(schedule.bookedCount).toBe(2);

    const confirmedRows = await ctx.prisma.classBooking.count({
      where: { scheduleId, status: 'confirmed' },
    });
    expect(confirmedRows).toBe(2);
  });

  it('notifies everyone with a confirmed seat when admin cancels the slot', async () => {
    const scheduleId = await createSlot(12);
    await signIn(ctx, BUYER);
    await ctx
      .http()
      .post(`/schedule/${scheduleId}/book`)
      .set('Authorization', bearer(BUYER))
      .expect(201);

    await ctx
      .http()
      .post(`/admin/schedule/${scheduleId}/cancel`)
      .set('Authorization', bearer(ADMIN))
      .expect(201);

    const notifications = await ctx
      .http()
      .get('/notifications')
      .set('Authorization', bearer(BUYER))
      .expect(200);
    expect(notifications.body.items[0]).toMatchObject({ type: 'class_cancelled' });

    const list = await ctx.http().get('/schedule').expect(200);
    expect(list.body.find((s: { id: string }) => s.id === scheduleId)).toBeUndefined();
  });

  it('refuses to book a cancelled slot', async () => {
    const scheduleId = await createSlot(12);
    await ctx
      .http()
      .post(`/admin/schedule/${scheduleId}/cancel`)
      .set('Authorization', bearer(ADMIN))
      .expect(201);

    await signIn(ctx, BUYER);
    await ctx
      .http()
      .post(`/schedule/${scheduleId}/book`)
      .set('Authorization', bearer(BUYER))
      .expect(409);
  });
});
