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
- [x] Перша Prisma-міграція `20260826184547_init` — застосована локально
      і в production (Railway Postgres, БД `railway`)
- [x] `GET /health` — реальний запит до БД (`user.count()`), а не `SELECT 1`:
      розрізняє «база недоступна» (`ECONNREFUSED`/`P1000`) і «база є, схеми
      немає» (`P2021`). Причина появи — див. «Витягнуті уроки» нижче
- [x] Деплой живий: `apps/web` на Vercel, `apps/api` на Railway
      (`fusion-labweb-production.up.railway.app`), Postgres — Railway-плагін.
      Перевірено: `/health` → `{"database":"up","schema":"ready"}`
- [x] Фронт↔бек з'єднані й перевірені наскрізь: `NEXT_PUBLIC_API_URL`
      (Vercel) → API, `WEB_ORIGIN` (Railway) → Vercel-домен. CORS
      віддає правильний origin, preflight з `authorization` проходить
- [ ] DNS для `fusionlab.in.ua` → Vercel, `api.fusionlab.in.ua` → Railway.
      Після підключення домену **додати його до `WEB_ORIGIN`** через кому,
      інакше CORS заблокує фронтенд на новому домені
- [ ] Redis — **свідомо не створений**: жоден рядок коду його поки не
      використовує (черги/кеш — Фаза 1–2). Створити разом із першим
      реальним споживачем, щоб не палити пробний баланс

### Витягнуті уроки (Фаза 0)

- **Railway-проєкт: `adventurous-tranquility`.** Сервіс, який хостить
  **API**, історично називається `@fusion-lab/web` — назва оманлива,
  але робоча. Є ще покинутий проєкт `comfortable-caring` з першими
  невдалими спробами — його варто видалити.
- **`preDeployCommand` з `prisma migrate deploy` не працює** — падає
  навіть тоді, коли той самий контейнер із тими самими змінними успішно
  ходить у базу (доведено через `/health`). Railway не показує вивід цієї
  фази взагалі, тож діагностувати нічим. Прибрано; міграції поки вручну
  через Console. Повернутись, коли стане зрозуміло, чим pre-deploy
  оточення відрізняється мережево.
- **Змінні оточення вказують навхрест, і їх легко переплутати.**
  `NEXT_PUBLIC_*` читає **тільки** Next.js на Vercel (вони вшиваються в
  браузерний бандл, тому в Vercel їх тип — `Config`, не `Secret`).
  `WEB_ORIGIN`/`DATABASE_URL`/`FIREBASE_*` читає **тільки** NestJS на
  Railway. Покладені не на той хост, вони мовчки нічого не роблять.
- **Три «зелені» перевірки брехали одночасно.** З мертвим `DATABASE_URL`
  Nest пише `successfully started` (pg-адаптер підключається ліниво),
  `GET /` віддає 200 (не торкається БД), `GET /me` віддає 401 (гард
  відсіює запит без токена ще до запиту). Звідси правило: **перевірка,
  яка не робить реального запиту до залежності, нічого не доводить.**

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

Виконано (2026-08-27): Docker Desktop, Firebase service account,
GitHub-репозиторій (`DenisDemenko/Fusion-Lab-Marketplaes`, гілка
`master`), Vercel, Railway + Postgres, перша міграція в production.

Лишилось:

1. **Vercel → Settings → Environment Variables** — замінити
   `NEXT_PUBLIC_API_URL` (зараз заглушка) на
   `https://fusion-labweb-production.up.railway.app`, потім
   Deployments → Redeploy (Vercel не перебудовує сам після зміни змінної).
2. **DNS для `fusionlab.in.ua`** — A/CNAME на Vercel; сабдомен
   `api.fusionlab.in.ua` → CNAME на Railway-сервіс. Після підключення
   домену оновити `NEXT_PUBLIC_API_URL` ще раз, уже на `api.fusionlab.in.ua`.
3. **Видалити покинутий Railway-проєкт `comfortable-caring`** — там
   лишились невдалі перші спроби, які їдять пробний баланс.

## Супутнє

- [ ] Кейс-стаді "як я використовував Claude Code для оркестрації" —
      окремий документ на основі цієї ж `/grill-with-docs` сесії й
      подальшої роботи; закриває вимогу вакансії щодо AI Agents orchestration.
