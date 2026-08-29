import {
  bearer,
  createTestApp,
  resetDatabase,
  type TestContext,
} from './utils/test-app';
import {
  createApprovedSeller,
  makeAdmin,
  pngPixel,
  signIn,
  stlFile,
  validListing,
} from './utils/fixtures';

const ADMIN = 'admin@test.dev';
const SELLER = 'seller@test.dev';
const OTHER_SELLER = 'other-seller@test.dev';

// The publishing pipeline end to end: apply → approve → create → upload →
// submit → moderate → appear in the catalogue. Every button the seller
// cabinet and the admin panel expose is one request in here.
describe('Seller publishing (e2e)', () => {
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

  it('refuses listing creation until the seller application is approved', async () => {
    await signIn(ctx, SELLER);

    await ctx
      .http()
      .post('/seller/apply')
      .set('Authorization', bearer(SELLER))
      .send({ displayName: 'Майстерня без схвалення' })
      .expect(201);

    const refused = await ctx
      .http()
      .post('/seller/listings')
      .set('Authorization', bearer(SELLER))
      .send(validListing)
      .expect(403);

    expect(refused.body.message).toContain('ще не схвалено');
  });

  it('rejects a second application from the same account', async () => {
    await signIn(ctx, SELLER);

    await ctx
      .http()
      .post('/seller/apply')
      .set('Authorization', bearer(SELLER))
      .send({ displayName: 'Перша заявка' })
      .expect(201);

    await ctx
      .http()
      .post('/seller/apply')
      .set('Authorization', bearer(SELLER))
      .send({ displayName: 'Друга заявка' })
      .expect(409);
  });

  it('walks a course from draft to published catalogue entry', async () => {
    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });

    const created = await ctx
      .http()
      .post('/seller/listings')
      .set('Authorization', bearer(SELLER))
      .send(validListing)
      .expect(201);

    const listingId = created.body.id as string;
    expect(created.body.status).toBe('draft');
    expect(created.body.slug).toMatch(/^kurs-fusion-360/);

    // Without a cover the publish button must refuse, and say why: the
    // seller has to be able to fix it without guessing.
    const blocked = await ctx
      .http()
      .post(`/seller/listings/${listingId}/submit`)
      .set('Authorization', bearer(SELLER))
      .expect(400);

    expect(blocked.body.problems).toEqual(
      expect.arrayContaining([expect.stringContaining('обкладинку')]),
    );

    const cover = await ctx
      .http()
      .post(`/seller/listings/${listingId}/media`)
      .set('Authorization', bearer(SELLER))
      .field('kind', 'cover')
      .attach('file', pngPixel, {
        filename: 'cover.png',
        contentType: 'image/png',
      })
      .expect(201);

    // A cover is public no matter what the client asked for — it has to
    // render in a catalogue card that carries no token.
    expect(cover.body.access).toBe('public');

    const material = await ctx
      .http()
      .post(`/seller/listings/${listingId}/media`)
      .set('Authorization', bearer(SELLER))
      .field('kind', 'attachment')
      .attach('file', stlFile, {
        filename: 'модель-уроку.stl',
        contentType: 'model/stl',
      })
      .expect(201);

    expect(material.body.access).toBe('entitled');
    expect(material.body.sizeBytes).toBe(stlFile.byteLength);

    const submitted = await ctx
      .http()
      .post(`/seller/listings/${listingId}/submit`)
      .set('Authorization', bearer(SELLER))
      .expect(201);

    expect(submitted.body.status).toBe('pending_review');

    // Still invisible to buyers while it waits for review.
    await ctx.http().get(`/catalog/${created.body.slug}`).expect(404);

    const queue = await ctx
      .http()
      .get('/admin/listings?status=pending_review')
      .set('Authorization', bearer(ADMIN))
      .expect(200);

    expect(queue.body).toHaveLength(1);
    expect(queue.body[0].id).toBe(listingId);

    const approved = await ctx
      .http()
      .post(`/admin/listings/${listingId}/approve`)
      .set('Authorization', bearer(ADMIN))
      .expect(201);

    expect(approved.body.status).toBe('published');
    expect(approved.body.publishedAt).toBeTruthy();

    const publicView = await ctx
      .http()
      .get(`/catalog/${created.body.slug}`)
      .expect(200);

    expect(publicView.body.title).toBe(validListing.title);
    // The paid file is listed but not linked: buyers see what they get,
    // without a URL that would serve it.
    expect(publicView.body.lockedMedia).toHaveLength(1);
    expect(
      publicView.body.media.every(
        (asset: { access: string }) => asset.access === 'public',
      ),
    ).toBe(true);
    expect(publicView.body.coverUrl).toBe(`/media/${cover.body.id}/download`);

    const seller = await ctx
      .http()
      .get('/seller/me')
      .set('Authorization', bearer(SELLER))
      .expect(200);

    expect(seller.body.stats.listingsByStatus.published).toBe(1);
  });

  it('sends a rejection with a reason back to the seller, and allows a resubmit', async () => {
    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });
    const listingId = await publishableListing(ctx, SELLER);

    await ctx
      .http()
      .post(`/seller/listings/${listingId}/submit`)
      .set('Authorization', bearer(SELLER))
      .expect(201);

    // An empty reason is refused — "rejected, no explanation" is the one
    // outcome a seller cannot act on.
    await ctx
      .http()
      .post(`/admin/listings/${listingId}/reject`)
      .set('Authorization', bearer(ADMIN))
      .send({ reason: '   ' })
      .expect(400);

    const rejected = await ctx
      .http()
      .post(`/admin/listings/${listingId}/reject`)
      .set('Authorization', bearer(ADMIN))
      .send({ reason: 'Потрібні приклади робіт у описі' })
      .expect(201);

    expect(rejected.body.status).toBe('rejected');

    const notifications = await ctx
      .http()
      .get('/notifications')
      .set('Authorization', bearer(SELLER))
      .expect(200);

    expect(notifications.body.items[0]).toMatchObject({
      type: 'listing_rejected',
      body: 'Потрібні приклади робіт у описі',
    });
    expect(notifications.body.unread).toBeGreaterThan(0);

    const resubmitted = await ctx
      .http()
      .post(`/seller/listings/${listingId}/submit`)
      .set('Authorization', bearer(SELLER))
      .expect(201);

    expect(resubmitted.body.status).toBe('pending_review');

    await ctx
      .http()
      .post(`/admin/listings/${listingId}/approve`)
      .set('Authorization', bearer(ADMIN))
      .expect(201);
  });

  it('keeps a listing on moderation immutable, and lets the seller withdraw it', async () => {
    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });
    const listingId = await publishableListing(ctx, SELLER);

    await ctx
      .http()
      .post(`/seller/listings/${listingId}/submit`)
      .set('Authorization', bearer(SELLER))
      .expect(201);

    await ctx
      .http()
      .patch(`/seller/listings/${listingId}`)
      .set('Authorization', bearer(SELLER))
      .send({ title: 'Змінена назва під час модерації' })
      .expect(409);

    const withdrawn = await ctx
      .http()
      .post(`/seller/listings/${listingId}/withdraw`)
      .set('Authorization', bearer(SELLER))
      .expect(201);

    expect(withdrawn.body.status).toBe('draft');

    const edited = await ctx
      .http()
      .patch(`/seller/listings/${listingId}`)
      .set('Authorization', bearer(SELLER))
      .send({ title: 'Назва після відкликання', priceMinor: 500000 })
      .expect(200);

    expect(edited.body.title).toBe('Назва після відкликання');
    expect(edited.body.priceMinor).toBe(500000);
  });

  it('will not let one seller touch another seller listing', async () => {
    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });
    await createApprovedSeller(ctx, {
      email: OTHER_SELLER,
      adminEmail: ADMIN,
      displayName: 'Чужа майстерня',
    });

    const listingId = await publishableListing(ctx, SELLER);

    await ctx
      .http()
      .patch(`/seller/listings/${listingId}`)
      .set('Authorization', bearer(OTHER_SELLER))
      .send({ title: 'Захоплений лістинг' })
      .expect(403);

    await ctx
      .http()
      .post(`/seller/listings/${listingId}/media`)
      .set('Authorization', bearer(OTHER_SELLER))
      .field('kind', 'attachment')
      .attach('file', stlFile, { filename: 'x.stl', contentType: 'model/stl' })
      .expect(403);

    await ctx
      .http()
      .delete(`/seller/listings/${listingId}`)
      .set('Authorization', bearer(OTHER_SELLER))
      .expect(403);
  });

  it('refuses an unsupported file type', async () => {
    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });
    const listingId = await publishableListing(ctx, SELLER);

    const refused = await ctx
      .http()
      .post(`/seller/listings/${listingId}/media`)
      .set('Authorization', bearer(SELLER))
      .field('kind', 'attachment')
      .attach('file', Buffer.from('<?php echo 1; ?>'), {
        filename: 'shell.php',
        contentType: 'application/x-httpd-php',
      })
      .expect(400);

    expect(refused.body.message).toContain('не підтримується');
  });

  it('replaces the cover instead of stacking copies of it', async () => {
    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });
    const listingId = await publishableListing(ctx, SELLER);

    const second = await ctx
      .http()
      .post(`/seller/listings/${listingId}/media`)
      .set('Authorization', bearer(SELLER))
      .field('kind', 'cover')
      .attach('file', pngPixel, {
        filename: 'new-cover.png',
        contentType: 'image/png',
      })
      .expect(201);

    const detail = await ctx
      .http()
      .get(`/seller/listings/${listingId}`)
      .set('Authorization', bearer(SELLER))
      .expect(200);

    const covers = await ctx.prisma.mediaAsset.findMany({
      where: { listingId, kind: 'cover' },
    });

    expect(covers).toHaveLength(1);
    expect(covers[0].id).toBe(second.body.id);
    expect(detail.body.coverUrl).toBe(`/media/${second.body.id}/download`);
  });

  // docs/migration-plan.md Phase D4: gallery images are always public,
  // regardless of what the caller passes for `access` — same rule as the
  // cover, and for the same reason (a hole in the storefront otherwise).
  it('uploads gallery images as public and separates them from paid attachments', async () => {
    await createApprovedSeller(ctx, { email: SELLER, adminEmail: ADMIN });
    const listingId = await publishableListing(ctx, SELLER);

    const gallery = await ctx
      .http()
      .post(`/seller/listings/${listingId}/media`)
      .set('Authorization', bearer(SELLER))
      .field('kind', 'gallery')
      .field('access', 'entitled') // ignored — gallery is always public
      .attach('file', pngPixel, {
        filename: 'workshop.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(gallery.body.access).toBe('public');

    const ownerView = await ctx
      .http()
      .get(`/seller/listings/${listingId}`)
      .set('Authorization', bearer(SELLER))
      .expect(200);
    expect(
      ownerView.body.gallery.map((asset: { id: string }) => asset.id),
    ).toEqual([gallery.body.id]);
    expect(
      ownerView.body.attachments.some(
        (asset: { id: string }) => asset.id === gallery.body.id,
      ),
    ).toBe(false);

    // Public detail: the gallery image rides along in `media` (it's
    // access:public, same as the cover) so an anonymous visitor sees it
    // without being entitled.
    await ctx
      .http()
      .post(`/seller/listings/${listingId}/submit`)
      .set('Authorization', bearer(SELLER))
      .expect(201);
    await ctx
      .http()
      .post(`/admin/listings/${listingId}/approve`)
      .set('Authorization', bearer(ADMIN))
      .expect(201);

    const listing = await ctx.prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
    });
    const publicDetail = await ctx
      .http()
      .get(`/catalog/${listing.slug}`)
      .expect(200);
    expect(
      publicDetail.body.media.some(
        (asset: { id: string }) => asset.id === gallery.body.id,
      ),
    ).toBe(true);
  });
});

// A listing that satisfies every publish requirement: description, price
// and a cover. Returns its id.
async function publishableListing(ctx: TestContext, sellerEmail: string) {
  const created = await ctx
    .http()
    .post('/seller/listings')
    .set('Authorization', bearer(sellerEmail))
    .send(validListing)
    .expect(201);

  await ctx
    .http()
    .post(`/seller/listings/${created.body.id}/media`)
    .set('Authorization', bearer(sellerEmail))
    .field('kind', 'cover')
    .attach('file', pngPixel, {
      filename: 'cover.png',
      contentType: 'image/png',
    })
    .expect(201);

  return created.body.id as string;
}
