# ADR 0004: Prisma 7 driver adapter (`@prisma/adapter-pg`) замість schema-level URL

## Статус

Прийнято — 2026-08-25

## Контекст

При першому `prisma generate` виявилось, що встановлена стабільна версія —
**Prisma 7.10.0** (не 6.x, як типово очікується з навчальних матеріалів чи
туторіалів у мережі). Prisma 7 прибрав `datasource { url = env(...) }` зі
`schema.prisma` — CLI-команди (`generate`/`migrate`) тепер читають URL з
окремого `prisma.config.ts`, а сам `PrismaClient` у рантаймі приймає лише
`adapter` (driver adapter) або `accelerateUrl`, без прямого рядка
підключення. Це підтверджено типами генерованого клієнта
(`PrismaClientOptions` у `node_modules/@prisma/client/runtime/client.d.ts`
має лише `adapter?: SqlDriverAdapterFactory` і `accelerateUrl?: string`,
без `datasourceUrl`).

## Рішення

- `apps/api/prisma.config.ts` — джерело URL для CLI (`migrate`/`generate`),
  через `defineConfig({ datasource: { url: env("DATABASE_URL") } })`.
- `apps/api/src/prisma/prisma.service.ts` — рантайм-клієнт створюється з
  `@prisma/adapter-pg`: `new PrismaPg({ connectionString: process.env.DATABASE_URL })`.
- Обидва читають один і той самий `DATABASE_URL`, але кожен свій шлях
  завантаження: CLI — через `prisma.config.ts` (з явним `import "dotenv/config"`
  там, бо Prisma CLI сам `.env` не підвантажує для конфіг-файлу), рантайм —
  через `import "dotenv/config"` на вершині `main.ts`.

## Наслідки

- `pg` і `@types/pg` — прямі залежності `apps/api`, не лише транзитивні
  через Prisma.
- Якщо пізніше знадобиться Prisma Accelerate/edge-рантайм — заміна
  `adapter` на `accelerateUrl` ізольована в одному місці (`prisma.service.ts`),
  не зачіпає жоден інший код.
- Будь-який майбутній туторіал/приклад коду, що посилається на
  `datasource { url = ... }` у `schema.prisma` або на `new PrismaClient()`
  без аргументів, застарілий для цього проєкту — орієнтуватись на цей ADR.
