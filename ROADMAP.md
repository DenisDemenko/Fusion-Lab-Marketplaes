# Fusion Lab Marketplace — roadmap

Узгоджено через `/grill-with-docs` сесію 2026-08-25. Мета — portfolio-ready
Marketplace/SaaS, що відповідає вакансії Strong Middle/Senior Full-Stack
(Node.js + Next.js + AI). Другий портфоліо-артефакт — Book_Creality
(окремий AI SaaS, `D:\Rama\Book_Creality`, дивись ADR 0001 для звʼязку).

Стек: Next.js (App Router) + NestJS + PostgreSQL + Redis + Firebase Auth,
npm workspaces + Turborepo monorepo. Деталі й обґрунтування — `docs/adr/`.

## Фаза 0 — Фундамент (виконано 2026-08-25)

- [x] Monorepo: `apps/web` (Next.js), `apps/api` (NestJS), `packages/shared-types`
- [x] `docker-compose.yml` — Postgres + Redis для локальної розробки
- [x] `CONTEXT.md` + перші ADR (0001–0003)
- [x] Book_Creality — git-репозиторій ініціалізовано, перший комміт
- [x] CI (GitHub Actions, `.github/workflows/ci.yml`): lint + typecheck +
      build + test на обидва apps, з Postgres service-контейнером
- [x] Firebase Auth: `FirebaseAuthGuard` + `@CurrentUser()` у NestJS,
      Prisma-модель `User` (keyed за Firebase UID), `UsersService.syncFromFirebase`
      на кожен верифікований запит; тестовий роут `GET /me`. Prisma 7
      виявився стабільною версією — знадобився driver adapter
      (`@prisma/adapter-pg`) замість schema-level URL, див. ADR 0004
- [x] `apps/api/Dockerfile` (для Railway) + `.env.example` з усіма
      потрібними змінними
- [ ] Перша Prisma-міграція (`npx prisma migrate dev --name init`) — не
      виконано: на цій машині немає Docker, отже немає локального Postgres.
      Потрібно на машині користувача: `docker compose up -d`, тоді міграція
- [ ] Реальний деплой: Vercel-акаунт (`apps/web`) + Railway/Render-акаунт
      (`apps/api` + Postgres + Redis) + DNS для `fusionlab.in.ua` — вимагає
      дій користувача (створення акаунтів), див. розділ "Хендофф" нижче

## Фаза 1 — MVP Marketplace

- [ ] Каталог: курси + фізичні товари (перенести існуючі 10 курсів Fusion 360
      і вироби з `site/assets/js/courses-data.js` як seed-дані; прибрати
      УКФ/грантову специфіку з публічних сторінок — див. ADR при виконанні)
- [ ] Пошук + фільтрація (Postgres full-text search — Elasticsearch/
      OpenSearch залишено для фази 3 як showcase)
- [ ] Продавці: реєстрація, кабінет продавця (лістинги, замовлення)
- [ ] Кошик → checkout → замовлення (Order + OrderItem)
- [ ] LiqPay-інтеграція (портувати логіку з `Book_Creality/server/payments/liqpay.ts`)
- [ ] Кабінет покупця: історія замовлень, доступ до куплених курсів/відео
      (перенести логіку gate'ування з чинного `firestore.rules`/`kurs.html`)
- [ ] Admin dashboard — заміна `admin.html`/`admin-access.html` і
      FusionAcademia: користувачі, модерація каталогу, огляд замовлень
- [ ] WebSocket-сповіщення: нове замовлення → продавцю, статус → покупцю
- [ ] AI-асистент покупця (чат): підбір курсу/товару, відповіді на питання
- [ ] API-міст до Book_Creality: опублікована книга → лістинг у каталозі

## Фаза 2 — Глибина маркетплейсу

- [ ] Комісії + виплати продавцям (ledger)
- [ ] Промокоди
- [ ] Loyalty-бали + кешбек
- [ ] **Реферальна система** — флагманський кейс: повний цикл від схеми
      БД до тестів, оформлений як окремий ADR (саме приклад із самої
      вакансії — "реалізувати referral system для marketplace")
- [ ] Рейтинги й відгуки
- [ ] Чат покупець↔продавець (двосторонній, per-лістинг)
- [ ] i18n UA/EN через `next-intl`, `[locale]/`-роутинг

## Фаза 3 — Showcase масштабування (документується, не обов'язково в проді)

- [ ] ADR "міграція на AWS" (ECS/RDS/ElastiCache) + опційний реальний деплой
- [ ] Elasticsearch/OpenSearch для пошуку
- [ ] Event-driven нотатки: BullMQ (вже є через Redis) → Kafka/RabbitMQ
      як задокументований наступний крок
- [ ] Навантажувальне тестування, нотатки з horizontal scaling

## Хендофф — дії, які потребують вас особисто

Акаунти й секрети — я не можу і не повинен їх створювати сам:

1. **Docker Desktop** — встановити локально, тоді `docker compose up -d`
   і `cd apps/api && npx prisma migrate dev --name init` (перша міграція
   ще не застосована — на цій машині Docker не встановлено).
2. **Firebase service account** — у консолі `fusionlab-acc2d`
   (Project settings → Service accounts → Generate new private key),
   заповнити `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`
   у `apps/api/.env` (локально) і в майбутньому Railway-проєкті.
3. **GitHub-репозиторій** — створити (наприклад `fusion-lab-marketplace`),
   `git remote add origin ...` і `git push` — зараз репо лише локальний.
4. **Vercel-акаунт** — імпортувати репо, обрати `apps/web` як root
   directory, підключити `fusionlab.in.ua`.
5. **Railway/Render-акаунт** — задеплоїти `apps/api` (є `Dockerfile`),
   підняти керовані Postgres + Redis, прописати `DATABASE_URL`/`REDIS_URL`
   і Firebase-змінні з п. 2.
6. **DNS для `fusionlab.in.ua`** — A/CNAME записи на Vercel (і сабдомен
   на Railway для API, напр. `api.fusionlab.in.ua`).

## Супутнє

- [ ] Кейс-стаді "як я використовував Claude Code для оркестрації" —
      окремий документ на основі цієї ж `/grill-with-docs` сесії й
      подальшої роботи; закриває вимогу вакансії щодо AI Agents orchestration.
