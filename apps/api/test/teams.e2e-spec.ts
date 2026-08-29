import {
  bearer,
  createTestApp,
  resetDatabase,
  type TestContext,
} from './utils/test-app';
import { makeAdmin, pngPixel, signIn } from './utils/fixtures';

const ADMIN = 'admin@test.dev';
const OWNER = 'owner@test.dev';
const OUTSIDER = 'outsider@test.dev';
const MEMBERS = Array.from({ length: 6 }, (_, i) => `member${i + 1}@test.dev`);

const validTeam = {
  name: 'Мінайські механіки',
  direction: 'Робототехніка',
  description: 'Крокуючий робот на Arduino з дерев’яним корпусом.',
  consent: true,
};

// docs/migration-plan.md Phase F1: STEAM teams, moderated before
// publication, capped at 5 people including the owner. The point of the
// concurrency test here is the same as schedule.e2e-spec.ts's: proving the
// capacity guard holds when two invites race for the last seat, not just
// when they arrive one after another.
describe('STEAM teams (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await makeAdmin(ctx, ADMIN);
    await signIn(ctx, OWNER);
    await signIn(ctx, OUTSIDER);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function createTeam(overrides: Record<string, unknown> = {}) {
    const created = await ctx
      .http()
      .post('/teams')
      .set('Authorization', bearer(OWNER))
      .send({ ...validTeam, ...overrides })
      .expect(201);
    return created.body.id as string;
  }

  it('rejects team creation without the photo-consent checkbox', async () => {
    await ctx
      .http()
      .post('/teams')
      .set('Authorization', bearer(OWNER))
      .send({ ...validTeam, consent: false })
      .expect(400);
  });

  it('starts a new team as pending, hidden from the public catalog', async () => {
    const teamId = await createTeam();

    const list = await ctx.http().get('/teams').expect(200);
    expect(list.body).toHaveLength(0);

    await ctx.http().get(`/teams/${teamId}`).expect(404);

    const adminList = await ctx
      .http()
      .get('/admin/teams')
      .set('Authorization', bearer(ADMIN))
      .expect(200);
    expect(adminList.body.find((t: { id: string }) => t.id === teamId)).toMatchObject({
      status: 'pending',
      memberCount: 1,
    });
  });

  it('refuses a duplicate team name', async () => {
    await createTeam();
    await ctx
      .http()
      .post('/teams')
      .set('Authorization', bearer(OWNER))
      .send(validTeam)
      .expect(409);
  });

  it('is closed to non-owners for invites and media', async () => {
    const teamId = await createTeam();

    await ctx
      .http()
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', bearer(OUTSIDER))
      .send({ email: MEMBERS[0] })
      .expect(403);

    await ctx
      .http()
      .post(`/teams/${teamId}/media`)
      .set('Authorization', bearer(OUTSIDER))
      .field('kind', 'cover')
      .attach('file', pngPixel, { filename: 'cover.png', contentType: 'image/png' })
      .expect(403);
  });

  it('invites a registered user, who sees it, accepts it, and shows up as a member', async () => {
    const teamId = await createTeam();
    await signIn(ctx, MEMBERS[0]);

    await ctx
      .http()
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', bearer(OWNER))
      .send({ email: MEMBERS[0] })
      .expect(201);

    const invites = await ctx
      .http()
      .get('/me/team-invites')
      .set('Authorization', bearer(MEMBERS[0]))
      .expect(200);
    expect(invites.body).toHaveLength(1);
    const memberId = invites.body[0].id as string;

    await ctx
      .http()
      .post(`/me/team-invites/${memberId}/accept`)
      .set('Authorization', bearer(MEMBERS[0]))
      .expect(201);

    const mine = await ctx
      .http()
      .get('/me/teams')
      .set('Authorization', bearer(MEMBERS[0]))
      .expect(200);
    expect(mine.body[0].members.map((m: { displayName: string }) => m.displayName))
      .toContain('member1');
  });

  it('frees the reserved seat when an invite is declined', async () => {
    const teamId = await createTeam();
    await signIn(ctx, MEMBERS[0]);

    const invite = await ctx
      .http()
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', bearer(OWNER))
      .send({ email: MEMBERS[0] })
      .expect(201);

    let team = await ctx.prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    expect(team.memberCount).toBe(2);

    await ctx
      .http()
      .post(`/me/team-invites/${invite.body.id}/decline`)
      .set('Authorization', bearer(MEMBERS[0]))
      .expect(201);

    team = await ctx.prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    expect(team.memberCount).toBe(1);
  });

  it('refuses a duplicate invite for the same person', async () => {
    const teamId = await createTeam();
    await signIn(ctx, MEMBERS[0]);

    await ctx
      .http()
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', bearer(OWNER))
      .send({ email: MEMBERS[0] })
      .expect(201);

    await ctx
      .http()
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', bearer(OWNER))
      .send({ email: MEMBERS[0] })
      .expect(409);
  });

  it('refuses to invite past 5 people total, sequentially', async () => {
    const teamId = await createTeam();
    for (const email of MEMBERS.slice(0, 4)) {
      await signIn(ctx, email);
      await ctx
        .http()
        .post(`/teams/${teamId}/invite`)
        .set('Authorization', bearer(OWNER))
        .send({ email })
        .expect(201);
    }

    await signIn(ctx, MEMBERS[4]);
    await ctx
      .http()
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', bearer(OWNER))
      .send({ email: MEMBERS[4] })
      .expect(409);

    const team = await ctx.prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    expect(team.memberCount).toBe(5);
  });

  // The real point of this suite: two invites racing for the one seat left
  // must never both succeed, and memberCount must never overshoot 5.
  it('holds the 5-person cap under real concurrency, not just in sequence', async () => {
    const teamId = await createTeam();
    for (const email of MEMBERS.slice(0, 3)) {
      await signIn(ctx, email);
      await ctx
        .http()
        .post(`/teams/${teamId}/invite`)
        .set('Authorization', bearer(OWNER))
        .send({ email })
        .expect(201);
    }
    await signIn(ctx, MEMBERS[3]);
    await signIn(ctx, MEMBERS[4]);

    const results = await Promise.allSettled([
      ctx
        .http()
        .post(`/teams/${teamId}/invite`)
        .set('Authorization', bearer(OWNER))
        .send({ email: MEMBERS[3] }),
      ctx
        .http()
        .post(`/teams/${teamId}/invite`)
        .set('Authorization', bearer(OWNER))
        .send({ email: MEMBERS[4] }),
    ]);

    const statuses = results.map((result) =>
      result.status === 'fulfilled' ? result.value.status : -1,
    );
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(1);

    const team = await ctx.prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    expect(team.memberCount).toBe(5);

    const reservedRows = await ctx.prisma.teamMember.count({
      where: { teamId, status: { in: ['invited', 'confirmed'] } },
    });
    expect(reservedRows).toBe(5);
  });

  it('replaces the team photo on re-upload instead of keeping both', async () => {
    const teamId = await createTeam();

    await ctx
      .http()
      .post(`/teams/${teamId}/media`)
      .set('Authorization', bearer(OWNER))
      .field('kind', 'cover')
      .attach('file', pngPixel, { filename: 'first.png', contentType: 'image/png' })
      .expect(201);

    await ctx
      .http()
      .post(`/teams/${teamId}/media`)
      .set('Authorization', bearer(OWNER))
      .field('kind', 'cover')
      .attach('file', pngPixel, { filename: 'second.png', contentType: 'image/png' })
      .expect(201);

    const covers = await ctx.prisma.mediaAsset.count({
      where: { teamId, kind: 'cover' },
    });
    expect(covers).toBe(1);
  });

  it('publishes a team on admin approval and notifies its confirmed members', async () => {
    const teamId = await createTeam();
    await signIn(ctx, MEMBERS[0]);
    const invite = await ctx
      .http()
      .post(`/teams/${teamId}/invite`)
      .set('Authorization', bearer(OWNER))
      .send({ email: MEMBERS[0] })
      .expect(201);
    await ctx
      .http()
      .post(`/me/team-invites/${invite.body.id}/accept`)
      .set('Authorization', bearer(MEMBERS[0]))
      .expect(201);

    await ctx
      .http()
      .post(`/admin/teams/${teamId}/approve`)
      .set('Authorization', bearer(ADMIN))
      .expect(201);

    const list = await ctx.http().get('/teams').expect(200);
    expect(list.body.map((t: { id: string }) => t.id)).toContain(teamId);

    const detail = await ctx.http().get(`/teams/${teamId}`).expect(200);
    expect(detail.body.members).toHaveLength(2);

    const notifications = await ctx
      .http()
      .get('/notifications')
      .set('Authorization', bearer(MEMBERS[0]))
      .expect(200);
    expect(notifications.body.items[0]).toMatchObject({ type: 'team_published' });
  });

  it('rejects a team with a reason and notifies the owner', async () => {
    const teamId = await createTeam();

    await ctx
      .http()
      .post(`/admin/teams/${teamId}/reject`)
      .set('Authorization', bearer(ADMIN))
      .send({ reason: 'Опис проєкту занадто короткий' })
      .expect(201);

    const notifications = await ctx
      .http()
      .get('/notifications')
      .set('Authorization', bearer(OWNER))
      .expect(200);
    expect(notifications.body.items[0]).toMatchObject({
      type: 'team_rejected',
      body: 'Опис проєкту занадто короткий',
    });

    await ctx.http().get(`/teams/${teamId}`).expect(404);
  });

  it('filters the public catalog by direction and by name', async () => {
    const roboticsId = await createTeam({ name: 'Мінайські механіки', direction: 'Робототехніка' });
    const ceramicsId = await createTeam({ name: 'Тепла форма', direction: 'Кераміка' });

    await ctx
      .http()
      .post(`/admin/teams/${roboticsId}/approve`)
      .set('Authorization', bearer(ADMIN))
      .expect(201);
    await ctx
      .http()
      .post(`/admin/teams/${ceramicsId}/approve`)
      .set('Authorization', bearer(ADMIN))
      .expect(201);

    const byDirection = await ctx.http().get('/teams?direction=Кераміка').expect(200);
    expect(byDirection.body.map((t: { id: string }) => t.id)).toEqual([ceramicsId]);

    const bySearch = await ctx.http().get('/teams?q=механіки').expect(200);
    expect(bySearch.body.map((t: { id: string }) => t.id)).toEqual([roboticsId]);
  });
});
