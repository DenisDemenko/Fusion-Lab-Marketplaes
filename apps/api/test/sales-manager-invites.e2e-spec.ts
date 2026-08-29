import {
  bearer,
  createTestApp,
  resetDatabase,
  type TestContext,
} from './utils/test-app';
import { makeAdmin, signIn } from './utils/fixtures';

const ADMIN = 'admin@test.dev';
const WRITER = 'writer@test.dev';
const INVITEE = 'manager@test.dev';
const OUTSIDER = 'outsider@test.dev';
const BUYER = 'buyer@test.dev';

// Phase H2: sales_manager is absent from SELF_SELECTABLE_ROLES, so this
// flow is the only way into the role. These tests are about that being
// true — not just that the happy path works, but that the alternatives
// stay closed.
describe('Sales manager invites (e2e)', () => {
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

  async function becomeWriter(email: string) {
    await signIn(ctx, email);
    await ctx
      .http()
      .post('/me/role')
      .set('Authorization', bearer(email))
      .send({ role: 'writer' })
      .expect(201);
  }

  async function inviteToken(email: string): Promise<string> {
    const invite = await ctx.prisma.salesManagerInvite.findFirstOrThrow({
      where: { email },
    });
    return invite.token;
  }

  it('turns an invited account into a sales manager', async () => {
    await becomeWriter(WRITER);

    const created = await ctx
      .http()
      .post('/me/sales-manager-invites')
      .set('Authorization', bearer(WRITER))
      .send({ email: INVITEE })
      .expect(201);
    expect(created.body.email).toBe(INVITEE);

    await signIn(ctx, INVITEE);
    const accepted = await ctx
      .http()
      .post(`/sales-manager-invites/${await inviteToken(INVITEE)}/accept`)
      .set('Authorization', bearer(INVITEE))
      .expect(201);
    expect(accepted.body.role).toBe('sales_manager');

    const me = await ctx
      .http()
      .get('/me')
      .set('Authorization', bearer(INVITEE))
      .expect(200);
    expect(me.body.role).toBe('sales_manager');
    // publishing:* comes from the role preset; sales:access does not,
    // because salesApproved is still false (the Phase A gate).
    expect(me.body.permissions).toContain('publishing:external');
    expect(me.body.permissions).toContain('publishing:nova');
    expect(me.body.permissions).not.toContain('sales:access');
  });

  it('refuses a forwarded link opened by a different address', async () => {
    await becomeWriter(WRITER);
    await ctx
      .http()
      .post('/me/sales-manager-invites')
      .set('Authorization', bearer(WRITER))
      .send({ email: INVITEE })
      .expect(201);

    await signIn(ctx, OUTSIDER);
    await ctx
      .http()
      .post(`/sales-manager-invites/${await inviteToken(INVITEE)}/accept`)
      .set('Authorization', bearer(OUTSIDER))
      .expect(403);
  });

  it('spends the invite exactly once', async () => {
    await becomeWriter(WRITER);
    await ctx
      .http()
      .post('/me/sales-manager-invites')
      .set('Authorization', bearer(WRITER))
      .send({ email: INVITEE })
      .expect(201);

    const token = await inviteToken(INVITEE);
    await signIn(ctx, INVITEE);
    await ctx
      .http()
      .post(`/sales-manager-invites/${token}/accept`)
      .set('Authorization', bearer(INVITEE))
      .expect(201);

    await ctx
      .http()
      .post(`/sales-manager-invites/${token}/accept`)
      .set('Authorization', bearer(INVITEE))
      .expect(409);
  });

  it('does not let a non-writer hand out the role', async () => {
    await signIn(ctx, BUYER);
    await ctx
      .http()
      .post('/me/role')
      .set('Authorization', bearer(BUYER))
      .send({ role: 'buyer' })
      .expect(201);

    await ctx
      .http()
      .post('/me/sales-manager-invites')
      .set('Authorization', bearer(BUYER))
      .send({ email: INVITEE })
      .expect(403);
  });

  it('refuses a second outstanding invite for the same address', async () => {
    await becomeWriter(WRITER);
    await ctx
      .http()
      .post('/me/sales-manager-invites')
      .set('Authorization', bearer(WRITER))
      .send({ email: INVITEE })
      .expect(201);

    await ctx
      .http()
      .post('/me/sales-manager-invites')
      .set('Authorization', bearer(WRITER))
      .send({ email: INVITEE })
      .expect(409);
  });

  it('revokes an unaccepted invite, killing its token', async () => {
    await becomeWriter(WRITER);
    const created = await ctx
      .http()
      .post('/me/sales-manager-invites')
      .set('Authorization', bearer(WRITER))
      .send({ email: INVITEE })
      .expect(201);

    const token = await inviteToken(INVITEE);

    await ctx
      .http()
      .delete(`/me/sales-manager-invites/${created.body.id}`)
      .set('Authorization', bearer(WRITER))
      .expect(200);

    await signIn(ctx, INVITEE);
    await ctx
      .http()
      .post(`/sales-manager-invites/${token}/accept`)
      .set('Authorization', bearer(INVITEE))
      .expect(404);
  });

  it('expires an invite past its deadline', async () => {
    await becomeWriter(WRITER);
    await ctx
      .http()
      .post('/me/sales-manager-invites')
      .set('Authorization', bearer(WRITER))
      .send({ email: INVITEE })
      .expect(201);

    await ctx.prisma.salesManagerInvite.updateMany({
      where: { email: INVITEE },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await signIn(ctx, INVITEE);
    await ctx
      .http()
      .post(`/sales-manager-invites/${await inviteToken(INVITEE)}/accept`)
      .set('Authorization', bearer(INVITEE))
      .expect(409);
  });
});
