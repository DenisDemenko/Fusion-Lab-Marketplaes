import type { TestContext } from './test-app';
import { bearer } from './test-app';

// A "sign in": the first authenticated request is what creates the
// Postgres user row, exactly as it does in production (FirebaseAuthGuard →
// UsersService.syncFromFirebase). Tests call this instead of inserting
// users directly, so the path they depend on is the real one.
export async function signIn(ctx: TestContext, email: string) {
  const response = await ctx
    .http()
    .get('/me')
    .set('Authorization', bearer(email))
    .expect(200);

  return response.body as {
    id: string;
    email: string;
    role: string;
    seller: { id: string; status: string } | null;
  };
}

export async function makeAdmin(ctx: TestContext, email: string) {
  await signIn(ctx, email);
  await ctx.prisma.user.update({ where: { email }, data: { role: 'admin' } });
}

// Applies as a seller and has an admin approve it — the same two steps a
// real person goes through, kept in one helper because almost every
// catalogue test needs a seller who is allowed to publish.
export async function createApprovedSeller(
  ctx: TestContext,
  options: { email: string; adminEmail: string; displayName?: string },
) {
  await signIn(ctx, options.email);

  const application = await ctx
    .http()
    .post('/seller/apply')
    .set('Authorization', bearer(options.email))
    .send({ displayName: options.displayName ?? 'Тестова майстерня' })
    .expect(201);

  await ctx
    .http()
    .post(`/admin/sellers/${application.body.id}/approve`)
    .set('Authorization', bearer(options.adminEmail))
    .expect(201);

  return application.body as { id: string; slug: string };
}

export const validListing = {
  kind: 'course' as const,
  title: 'Курс Fusion 360 для початківців',
  subtitle: 'Від першого ескізу до друкованої деталі',
  summary: 'Базовий курс параметричного моделювання',
  description:
    'Повний базовий курс Fusion 360: ескізи, обмеження, тіла, збірки та ' +
    'підготовка моделей до 3D-друку. Практика на реальних деталях.',
  priceMinor: 450000,
  highlights: ['12 занять', 'Практика щотижня'],
  curriculum: {
    modules: [
      {
        title: 'Модуль 1. Ескізи',
        lessons: [{ title: '1 заняття. Лінії та розміри' }],
      },
    ],
  },
};

// A 1x1 PNG — the smallest thing that is genuinely an image, so the upload
// path is tested with real bytes and a real mime type rather than a string
// pretending to be a file.
export const pngPixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export const stlFile = Buffer.from(
  'solid cube\n  facet normal 0 0 1\n  endfacet\nendsolid cube\n',
  'utf8',
);

// Full path from nothing to a listing a buyer can actually buy: create,
// attach a cover and one paid file, submit, approve. Returns the ids the
// purchase and download tests need.
export async function publishListing(
  ctx: TestContext,
  options: {
    sellerEmail: string;
    adminEmail: string;
    overrides?: Record<string, unknown>;
  },
) {
  const created = await ctx
    .http()
    .post('/seller/listings')
    .set('Authorization', bearer(options.sellerEmail))
    .send({ ...validListing, ...options.overrides })
    .expect(201);

  const listingId = created.body.id as string;

  const cover = await ctx
    .http()
    .post(`/seller/listings/${listingId}/media`)
    .set('Authorization', bearer(options.sellerEmail))
    .field('kind', 'cover')
    .attach('file', pngPixel, {
      filename: 'cover.png',
      contentType: 'image/png',
    })
    .expect(201);

  const file = await ctx
    .http()
    .post(`/seller/listings/${listingId}/media`)
    .set('Authorization', bearer(options.sellerEmail))
    .field('kind', 'attachment')
    .attach('file', stlFile, {
      filename: 'materials.stl',
      contentType: 'model/stl',
    })
    .expect(201);

  await ctx
    .http()
    .post(`/seller/listings/${listingId}/submit`)
    .set('Authorization', bearer(options.sellerEmail))
    .expect(201);

  await ctx
    .http()
    .post(`/admin/listings/${listingId}/approve`)
    .set('Authorization', bearer(options.adminEmail))
    .expect(201);

  return {
    id: listingId,
    slug: created.body.slug as string,
    coverMediaId: cover.body.id as string,
    fileMediaId: file.body.id as string,
    priceMinor: created.body.priceMinor as number,
  };
}
