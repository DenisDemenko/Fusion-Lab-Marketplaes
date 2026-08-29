import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { randomReferralCode } from '../src/common/referral-code';

// Fills an empty database with the catalogue the old Firebase site already
// had: ten Fusion 360 courses (imported by scripts/import-courses-from-site.js)
// plus a few lab-made products, under one approved seller.
//
// Idempotent — every write is an upsert keyed by something stable — so it
// can be re-run against a database that is already seeded, or against
// production, without creating a second copy of anything.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const COURSE_SOURCE = 'fusion_site';

interface SeedCourse {
  externalId: string;
  title: string;
  subtitle: string | null;
  summary: string;
  description: string;
  coverUrl: string | null;
  priceUah: number;
  categorySlug: string;
  highlights: string[];
  curriculum: unknown;
}

const CATEGORIES = [
  { slug: 'osvita', name: 'Освіта та STEAM' },
  { slug: 'mebli', name: 'Меблі та інтерʼєр' },
  { slug: 'bpla', name: 'БПЛА та дрони' },
  { slug: 'chpu', name: 'ЧПУ та верстати' },
  { slug: '3d-druk', name: '3D-друк' },
  { slug: 'art', name: 'Арт та терапія' },
  { slug: 'kursy', name: 'Інші курси' },
  { slug: 'vyroby', name: 'Вироби лабораторії' },
];

// Physical goods the lab actually prints. They exist in the seed because a
// marketplace with only digital items never exercises stock, and stock is
// the one path where two buyers can collide.
const PRODUCTS = [
  {
    externalId: 'product-steam-kit',
    title: 'STEAM-набір друкованих моделей для школи',
    subtitle: 'Комплект із 12 навчальних моделей: механізми, молекули, геометричні тіла',
    description:
      'Готовий комплект надрукованих моделей для кабінетів фізики, хімії та математики. ' +
      'Друк PLA, висота шару 0.2 мм, збірка та контроль розмірів у лабораторії. ' +
      'У комплекті — методичка з ідеями уроків та STL-файли для самостійного передруку.',
    priceUah: 3200,
    stock: 12,
    categorySlug: 'vyroby',
    highlights: ['12 моделей у наборі', 'PLA, шар 0.2 мм', 'STL-файли в комплекті'],
    coverUrl:
      'https://images.unsplash.com/photo-1615986201152-7686a4867f30?auto=format&fit=crop&q=80&w=800',
  },
  {
    externalId: 'product-drone-frame',
    title: 'Рама для навчального квадрокоптера 250 мм',
    subtitle: 'Друкована рама з посиленими променями під навчальні збірки',
    description:
      'Рама розроблена у Fusion 360 для навчальних зборок БПЛА: посилені промені, ' +
      'зміцнені вузли кріплення моторів, ремонтопридатність без спецінструменту. ' +
      'Друк PETG. До виробу додається файл проєкту Fusion 360 для власних змін.',
    priceUah: 2100,
    stock: 8,
    categorySlug: 'bpla',
    highlights: ['PETG', 'Проєкт Fusion 360 у комплекті', 'Під мотори 2205–2306'],
    coverUrl:
      'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&q=80&w=800',
  },
  {
    externalId: 'product-ceramic-vase',
    title: 'Керамічна ваза, друк на глиняному принтері',
    subtitle: 'Ручна робота лабораторії: параметрична форма, випал, глазур',
    description:
      'Ваза надрукована глиняною пастою на керамічному 3D-принтері лабораторії, ' +
      'висушена, випалена та вкрита глазурʼю. Форма параметрична — кожен виріб ' +
      'відрізняється кроком спіралі. Висота 240 мм, придатна для живих квітів.',
    priceUah: 1900,
    stock: 4,
    categorySlug: '3d-druk',
    highlights: ['Висота 240 мм', 'Випал + глазур', 'Кожен виріб унікальний'],
    coverUrl:
      'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&q=80&w=800',
  },
];

async function main() {
  const sellerEmail = process.env.SEED_SELLER_EMAIL ?? 'lab@fusionlab.in.ua';
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@fusionlab.in.ua';

  // Seeded accounts carry a `seed:` firebaseUid instead of a real one. A
  // person who later signs in with the same email claims the row — see
  // UsersService.syncFromFirebase — so the demo data has an owner before
  // anyone has ever logged in. roleChosenAt is set here, not left null:
  // their role is intentionally pre-assigned by this script, not something
  // they still need to pick — leaving it null would trap the admin account
  // itself behind RoleGate's onboarding screen on first real login.
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'admin' },
    create: {
      email: adminEmail,
      firebaseUid: `seed:${adminEmail}`,
      role: 'admin',
      roleChosenAt: new Date(),
      displayName: 'Адміністратор Fusion Lab',
      referralCode: randomReferralCode(),
    },
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: sellerEmail },
    update: { role: 'seller' },
    create: {
      email: sellerEmail,
      firebaseUid: `seed:${sellerEmail}`,
      role: 'seller',
      roleChosenAt: new Date(),
      displayName: 'Fusion Lab',
      referralCode: randomReferralCode(),
    },
  });

  const seller = await prisma.sellerProfile.upsert({
    where: { userId: sellerUser.id },
    update: { status: 'approved' },
    create: {
      userId: sellerUser.id,
      displayName: 'Fusion Lab',
      slug: 'fusion-lab',
      status: 'approved',
      bio: 'Лабораторія креативної технічної творчості: курси Fusion 360, 3D-друк, ЧПУ, БПЛА.',
    },
  });

  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
  }

  const categories = new Map(
    (await prisma.category.findMany()).map((row) => [row.slug, row.id]),
  );

  const courses: SeedCourse[] = JSON.parse(
    readFileSync(join(__dirname, 'seed-data', 'courses.json'), 'utf8'),
  ) as SeedCourse[];

  for (const course of courses) {
    const data = {
      title: course.title,
      subtitle: course.subtitle,
      summary: course.summary,
      description: course.description,
      priceMinor: course.priceUah * 100,
      coverUrl: course.coverUrl,
      highlights: course.highlights,
      curriculum: course.curriculum as object,
      categoryId: categories.get(course.categorySlug) ?? null,
      status: 'published' as const,
    };

    await prisma.listing.upsert({
      where: {
        externalSource_externalId: {
          externalSource: COURSE_SOURCE,
          externalId: course.externalId,
        },
      },
      update: data,
      create: {
        ...data,
        slug: course.externalId,
        kind: 'course',
        sellerId: seller.id,
        externalSource: COURSE_SOURCE,
        externalId: course.externalId,
        publishedAt: new Date(),
      },
    });
  }

  for (const product of PRODUCTS) {
    const data = {
      title: product.title,
      subtitle: product.subtitle,
      summary: product.subtitle,
      description: product.description,
      priceMinor: product.priceUah * 100,
      coverUrl: product.coverUrl,
      highlights: product.highlights,
      stock: product.stock,
      categoryId: categories.get(product.categorySlug) ?? null,
      status: 'published' as const,
    };

    await prisma.listing.upsert({
      where: {
        externalSource_externalId: {
          externalSource: COURSE_SOURCE,
          externalId: product.externalId,
        },
      },
      update: data,
      create: {
        ...data,
        slug: product.externalId.replace(/^product-/, ''),
        kind: 'product',
        sellerId: seller.id,
        externalSource: COURSE_SOURCE,
        externalId: product.externalId,
        publishedAt: new Date(),
      },
    });
  }

  const galleryCount = await seedUavGallery(sellerUser.id);

  const published = await prisma.listing.count({ where: { status: 'published' } });

  console.log(
    [
      `Seeded ${courses.length} courses + ${PRODUCTS.length} products`,
      `(${published} published listings total)`,
      galleryCount > 0 ? `uav-mastery gallery: ${galleryCount} images` : null,
      `seller: ${sellerEmail}`,
      `admin: ${admin.email}`,
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

// docs/migration-plan.md Phase D5: of the ~130 files dumped in the design
// assets folder, this filename pattern is the only one that maps
// unambiguously to a single course — everything else in that folder has a
// generic photo/screenshot name with no course association, and gets
// uploaded manually through the seller cabinet's gallery uploader (Phase
// D4) once someone actually sorts through it.
//
// Guarded by existsSync, not a hard dependency: that folder is
// local-machine demo material (D:\Rama\furnivision-architecture\Рисунки,
// a sibling of this repo, not inside it), never something a production
// seed run on Railway should require or fail without. Idempotent like the
// rest of this script — skips entirely if uav-mastery already has gallery
// images, so re-running seed does not duplicate them.
async function seedUavGallery(uploaderId: string): Promise<number> {
  // __dirname is apps/api/prisma; four levels up is the monorepo's parent
  // directory (furnivision-architecture), where Рисунки sits as a sibling
  // of this repo, not inside it.
  const slidesDir = join(__dirname, '..', '..', '..', '..', 'Рисунки');
  if (!existsSync(slidesDir)) return 0;

  const course = await prisma.listing.findUnique({
    where: {
      externalSource_externalId: {
        externalSource: COURSE_SOURCE,
        externalId: 'uav-mastery',
      },
    },
  });
  if (!course) return 0;

  const alreadySeeded = await prisma.mediaAsset.count({
    where: { listingId: course.id, kind: 'gallery' },
  });
  if (alreadySeeded > 0) return 0;

  const slideFiles = readdirSync(slidesDir)
    .filter((name) => /^30_Day_UAV_Engineering_Mastery_-_Slide_\d+\.png$/.test(name))
    .sort(
      (a, b) =>
        Number(/Slide_(\d+)\.png$/.exec(a)?.[1] ?? 0) -
        Number(/Slide_(\d+)\.png$/.exec(b)?.[1] ?? 0),
    );

  const storageRoot = process.env.STORAGE_DIR ?? join(process.cwd(), 'storage');

  for (const filename of slideFiles) {
    const contents = readFileSync(join(slidesDir, filename));
    const storageKey = `listings/${course.id}/${randomUUID()}-${filename}`;
    const target = join(storageRoot, storageKey);

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);

    await prisma.mediaAsset.create({
      data: {
        listingId: course.id,
        uploaderId,
        kind: 'gallery',
        access: 'public',
        filename,
        mimeType: 'image/png',
        sizeBytes: contents.byteLength,
        storageKey,
      },
    });
  }

  return slideFiles.length;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
