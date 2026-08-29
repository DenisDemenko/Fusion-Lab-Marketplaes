import {
  bearer,
  createTestApp,
  resetDatabase,
  type TestContext,
} from './utils/test-app';
import { makeAdmin, signIn, validListing } from './utils/fixtures';

const ADMIN = 'admin@test.dev';
const BUYER = 'buyer@test.dev';
const WRITER = 'writer@test.dev';
const SALES = 'sales@test.dev';
const EXPERT = 'expert@test.dev';

describe('Roles and permissions (e2e)', () => {
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

  describe('POST /me/role', () => {
    it('lets a fresh account choose a role exactly once', async () => {
      await signIn(ctx, BUYER);

      const chosen = await ctx
        .http()
        .post('/me/role')
        .set('Authorization', bearer(BUYER))
        .send({ role: 'writer' })
        .expect(201);

      expect(chosen.body.role).toBe('writer');
      expect(chosen.body.roleChosen).toBe(true);

      const me = await ctx
        .http()
        .get('/me')
        .set('Authorization', bearer(BUYER))
        .expect(200);
      expect(me.body.role).toBe('writer');
      expect(me.body.roleChosen).toBe(true);
    });

    it('refuses a second self-selection', async () => {
      await signIn(ctx, BUYER);
      await ctx
        .http()
        .post('/me/role')
        .set('Authorization', bearer(BUYER))
        .send({ role: 'expert' })
        .expect(201);

      await ctx
        .http()
        .post('/me/role')
        .set('Authorization', bearer(BUYER))
        .send({ role: 'seller' })
        .expect(409);

      const me = await ctx
        .http()
        .get('/me')
        .set('Authorization', bearer(BUYER))
        .expect(200);
      expect(me.body.role).toBe('expert');
    });

    it('rejects choosing admin through the self-service endpoint', async () => {
      await signIn(ctx, BUYER);

      await ctx
        .http()
        .post('/me/role')
        .set('Authorization', bearer(BUYER))
        .send({ role: 'admin' })
        .expect(400);
    });

    it('rejects an unknown role', async () => {
      await signIn(ctx, BUYER);

      await ctx
        .http()
        .post('/me/role')
        .set('Authorization', bearer(BUYER))
        .send({ role: 'ceo' })
        .expect(400);
    });
  });

  describe('sales:access gate', () => {
    it('is withheld until an admin approves it, even for a role whose preset grants it', async () => {
      await signIn(ctx, WRITER);
      await ctx
        .http()
        .post('/me/role')
        .set('Authorization', bearer(WRITER))
        .send({ role: 'writer' })
        .expect(201);

      const before = await ctx
        .http()
        .get('/me')
        .set('Authorization', bearer(WRITER))
        .expect(200);
      expect(before.body.permissions).not.toContain('sales:access');
      expect(before.body.permissions).toContain('books:write');

      const userId = before.body.id as string;
      await ctx
        .http()
        .patch(`/admin/users/${userId}/sales-approval`)
        .set('Authorization', bearer(ADMIN))
        .send({ approved: true })
        .expect(200);

      const after = await ctx
        .http()
        .get('/me')
        .set('Authorization', bearer(WRITER))
        .expect(200);
      expect(after.body.permissions).toContain('sales:access');
    });

    it('never applies to a role whose preset does not include it', async () => {
      await signIn(ctx, BUYER);
      await ctx
        .http()
        .post('/me/role')
        .set('Authorization', bearer(BUYER))
        .send({ role: 'buyer' })
        .expect(201);

      const me = await ctx
        .http()
        .get('/me')
        .set('Authorization', bearer(BUYER))
        .expect(200);

      await ctx
        .http()
        .patch(`/admin/users/${me.body.id}/sales-approval`)
        .set('Authorization', bearer(ADMIN))
        .send({ approved: true })
        .expect(200);

      const after = await ctx
        .http()
        .get('/me')
        .set('Authorization', bearer(BUYER))
        .expect(200);
      expect(after.body.permissions).not.toContain('sales:access');
    });
  });

  // docs/migration-plan.md, П21: an expert creates courses through the
  // existing seller listing form, not a dedicated course builder. This
  // works with zero new code because seller-cabinet access is already
  // gated by SellerProfile.status, never by user.role — confirmed here
  // rather than left as an inference.
  describe('expert publishing through the existing seller cabinet', () => {
    it('lets an expert apply, get approved, and create a listing without becoming a seller', async () => {
      await signIn(ctx, EXPERT);
      await ctx
        .http()
        .post('/me/role')
        .set('Authorization', bearer(EXPERT))
        .send({ role: 'expert' })
        .expect(201);

      const application = await ctx
        .http()
        .post('/seller/apply')
        .set('Authorization', bearer(EXPERT))
        .send({ displayName: 'Курси від експерта' })
        .expect(201);

      await ctx
        .http()
        .post(`/admin/sellers/${application.body.id}/approve`)
        .set('Authorization', bearer(ADMIN))
        .expect(201);

      const created = await ctx
        .http()
        .post('/seller/listings')
        .set('Authorization', bearer(EXPERT))
        .send(validListing)
        .expect(201);
      expect(created.body.title).toBe(validListing.title);

      // approveSeller only promotes role:'buyer' -> 'seller' — an expert's
      // self-chosen role must survive seller approval untouched.
      const me = await ctx
        .http()
        .get('/me')
        .set('Authorization', bearer(EXPERT))
        .expect(200);
      expect(me.body.role).toBe('expert');
      expect(me.body.seller.status).toBe('approved');
    });
  });

  describe('admin permission overrides', () => {
    it('grants a permission the role preset withholds', async () => {
      const signedIn = await signIn(ctx, SALES);
      await ctx
        .http()
        .post('/me/role')
        .set('Authorization', bearer(SALES))
        .send({ role: 'sales_manager' })
        .expect(201);

      const before = await ctx
        .http()
        .get(`/admin/users/${signedIn.id}/permissions`)
        .set('Authorization', bearer(ADMIN))
        .expect(200);
      expect(before.body.effective).not.toContain('listings:write');

      await ctx
        .http()
        .patch(`/admin/users/${signedIn.id}/permissions`)
        .set('Authorization', bearer(ADMIN))
        .send({ permission: 'listings:write', granted: true })
        .expect(200);

      const me = await ctx
        .http()
        .get('/me')
        .set('Authorization', bearer(SALES))
        .expect(200);
      expect(me.body.permissions).toContain('listings:write');
    });

    it('revokes a permission the role preset would otherwise grant', async () => {
      const signedIn = await signIn(ctx, WRITER);
      await ctx
        .http()
        .post('/me/role')
        .set('Authorization', bearer(WRITER))
        .send({ role: 'writer' })
        .expect(201);

      await ctx
        .http()
        .patch(`/admin/users/${signedIn.id}/permissions`)
        .set('Authorization', bearer(ADMIN))
        .send({ permission: 'books:write', granted: false })
        .expect(200);

      const me = await ctx
        .http()
        .get('/me')
        .set('Authorization', bearer(WRITER))
        .expect(200);
      expect(me.body.permissions).not.toContain('books:write');
    });

    it('a reset override falls back to the role preset', async () => {
      const signedIn = await signIn(ctx, WRITER);
      await ctx
        .http()
        .post('/me/role')
        .set('Authorization', bearer(WRITER))
        .send({ role: 'writer' })
        .expect(201);

      await ctx
        .http()
        .patch(`/admin/users/${signedIn.id}/permissions`)
        .set('Authorization', bearer(ADMIN))
        .send({ permission: 'books:write', granted: false })
        .expect(200);

      await ctx
        .http()
        .patch(`/admin/users/${signedIn.id}/permissions`)
        .set('Authorization', bearer(ADMIN))
        .send({ permission: 'books:write', granted: null })
        .expect(200);

      const me = await ctx
        .http()
        .get('/me')
        .set('Authorization', bearer(WRITER))
        .expect(200);
      expect(me.body.permissions).toContain('books:write');
    });

    it('rejects an unknown permission string', async () => {
      const signedIn = await signIn(ctx, BUYER);

      await ctx
        .http()
        .patch(`/admin/users/${signedIn.id}/permissions`)
        .set('Authorization', bearer(ADMIN))
        .send({ permission: 'time-travel:access', granted: true })
        .expect(400);
    });

    it('is closed to non-admins', async () => {
      const signedIn = await signIn(ctx, BUYER);

      await ctx
        .http()
        .get(`/admin/users/${signedIn.id}/permissions`)
        .set('Authorization', bearer(BUYER))
        .expect(403);
      await ctx
        .http()
        .patch(`/admin/users/${signedIn.id}/sales-approval`)
        .set('Authorization', bearer(BUYER))
        .send({ approved: true })
        .expect(403);
    });
  });
});
