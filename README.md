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
docs/case-study-ai-orchestration.md   як велася AI-орієнтована розробка
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

**Фази 0–3 у проді, каталог наповнений (2026-08-29).** Живі адреси:

| Що | Адреса |
|---|---|
| Маркетплейс (UA, без префікса) | https://app.fusionlab.in.ua |
| Маркетплейс (EN) | https://app.fusionlab.in.ua/en |
| Кастомний домен | https://www.fusionlab.in.ua *(корінь `fusionlab.in.ua` — у процесі DNS-поширення)* |
| API | https://api.fusionlab.in.ua |
| Стан системи | https://api.fusionlab.in.ua/health |

Повний маркетплейс — каталог, пошук, кошик, checkout, LiqPay, кабінети
покупця/продавця, admin-панель, сповіщення, AI-асистент, міст до
Book_Creality, комісії/виплати, промокоди, loyalty, реферали, відгуки,
чат, i18n UA/EN — покрито 82 тестами (72 e2e + 10 unit,
`npm test` / `npm run test:e2e` в `apps/api`) і задеплоєно. Каталог
наповнений (`npm run db:seed`) — 13 лістингів.
Повний перелік зробленого — `ROADMAP.md`, архітектурні рішення —
`docs/adr/`, шлях подальшого масштабування (AWS/пошук/event-driven/
навантаження, задокументовано, не виконано) —
`docs/adr/0006-showcase-scaling-path.md`.
