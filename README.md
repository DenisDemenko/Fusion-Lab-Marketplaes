# Fusion Lab Marketplace

Next.js + NestJS + PostgreSQL marketplace: курси, книги (через API з
[Book_Creality](../../Book_Creality)) і товари. Наступник статичного
`../site` (Firebase-based грантовий портал) — див.
[`docs/adr/0001-two-systems-with-api-bridge.md`](docs/adr/0001-two-systems-with-api-bridge.md)
чому це окремий проєкт, а не переписаний `site/`.

## Структура

```
apps/web              Next.js (App Router, TS, Tailwind)
apps/api              NestJS (TS)
packages/shared-types  DTO/типи спільні для web і api
docs/adr/              архітектурні рішення
CONTEXT.md             глосарій домену
ROADMAP.md             фазований план побудови
```

## Розробка

```bash
docker compose up -d      # Postgres + Redis
npm install                # з кореня — єдиний workspace lockfile
npm run dev                 # web (:3000) + api (:3001) через Turborepo
npm run typecheck
```

Пакетний менеджер — npm workspaces (не pnpm — див.
[ADR 0003](docs/adr/0003-nestjs-and-monorepo.md) чому).

## Перший запуск / деплой

Кроки, що вимагають акаунтів чи зовнішніх дашбордів (Docker Desktop,
Firebase service account, GitHub, Vercel, Railway, DNS для
`fusionlab.in.ua`), проведе інтерактивний скрипт:

```bash
./scripts/setup-handoff.sh
```

Ідемпотентний — можна зупинити (Ctrl-C) і перезапустити пізніше, він
пам'ятає вже збережені значення. Деталі й контекст кожного кроку — в
`ROADMAP.md` → "Хендофф".

## Стан

Скелет проєкту (фаза 0 з `ROADMAP.md`). Дивись `ROADMAP.md` для повного
плану фаз і `CONTEXT.md` для термінології домену.
