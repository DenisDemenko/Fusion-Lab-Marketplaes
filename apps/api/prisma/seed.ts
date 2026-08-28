import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  // anyone has ever logged in.
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'admin' },
    create: {
      email: adminEmail,
      firebaseUid: `seed:${adminEmail}`,
      role: 'admin',
      displayName: 'Адміністратор Fusion Lab',
    },
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: sellerEmail },
    update: { role: 'seller' },
    create: {
      email: sellerEmail,
      firebaseUid: `seed:${sellerEmail}`,
      role: 'seller',
      displayName: 'Fusion Lab',
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

  const published = await prisma.listing.count({ where: { status: 'published' } });

  console.log(
    [
      `Seeded ${courses.length} courses + ${PRODUCTS.length} products`,
      `(${published} published listings total)`,
      `seller: ${sellerEmail}`,
      `admin: ${admin.email}`,
    ].join('\n'),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
