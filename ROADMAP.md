# Fusion Lab Marketplace — roadmap

Узгоджено через `/grill-with-docs` сесію 2026-08-25. Мета — portfolio-ready
Marketplace/SaaS, що відповідає вакансії Strong Middle/Senior Full-Stack
(Node.js + Next.js + AI). Другий портфоліо-артефакт — Book_Creality
(окремий AI SaaS, `D:\Rama\Book_Creality`, дивись ADR 0001 для звʼязку).

Стек: Next.js (App Router) + NestJS + PostgreSQL + Redis + Firebase Auth,
npm workspaces + Turborepo monorepo. Деталі й обґрунтування — `docs/adr/`.

## Фаза 0 — Фундамент ✅ завершено 2026-08-28

Живі адреси:

| Що | Адреса |
|---|---|
| Маркетплейс (фронтенд) | https://app.fusionlab.in.ua |
| API | https://api.fusionlab.in.ua |
| Перевірка стану | https://api.fusionlab.in.ua/health |
| Старий грантовий сайт | https://fusionlab.in.ua *(Firebase, не чіпаємо)* |


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
- [x] Власні домени (DNS на HostIQ, cPanel → Редактор зон):
      **`app.fusionlab.in.ua`** → Vercel (CNAME),
      **`api.fusionlab.in.ua`** → Railway (CNAME + TXT `_railway-verify.api`).
      Корінь `fusionlab.in.ua` свідомо лишено на **старому Firebase-сайті** —
      перемкнемо його на маркетплейс, коли Фаза 1 буде наповнена контентом,
      щоб не замінити робочий грантовий сайт порожнім скафолдом.
      `WEB_ORIGIN` містить обидва фронтенд-походження через кому.
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

## Фаза 1 — MVP Marketplace 🚧 код і тести готові 2026-08-29, деплой ще ні

Усе нижче реалізоване на обох рівнях (API `apps/api`, UI `apps/web`),
покрите 48 e2e + 10 unit тестами (`npm test` / `npm run test:e2e` в
`apps/api`) і перевірене вручну в браузері наскрізь для всього, що не
залежить від живого Firebase-токена (див. «Витягнуті уроки» нижче — чому
саме це виключення). Ще не задеплоєно на Vercel/Railway — там лишається
Фаза 0.

- [x] Каталог: 10 курсів Fusion 360 + 3 вироби лабораторії, імпортовані
      одноразовим скриптом `scripts/import-courses-from-site.js` із
      `../site/assets/js/courses-data.js` у `apps/api/prisma/seed-data/
      courses.json` — репозиторій відтепер володіє власною копією, а не
      читає чужий каталог напряму. УКФ/грантове фреймування (`veteranRehab`
      та подібне) свідомо відкинуто при імпорті — див. коментар у скрипті
- [x] Пошук + фільтрація: Postgres full-text search (згенерована колонка
      `tsvector`, зважена title/subtitle/description) + trigram-фолбек для
      неповних слів і одруків; фільтри за типом/категорією/ціною,
      сортування, пагінація
- [x] Продавці: заявка → схвалення адміном → кабінет (лістинги, медіа,
      продажі з комісією)
- [x] Кошик (серверний, не localStorage) → checkout з резервуванням
      складу в транзакції → Order + OrderItem
- [x] LiqPay-інтеграція (порт з `Book_Creality/server/payments/liqpay.ts`):
      підписаний checkout-payload, перевірка підпису колбека, демо-шлях
      підтвердження оплати, що вимикається сам, щойно з'являються реальні
      ключі. **Не перевірено проти справжнього LiqPay sandbox** — підпис і
      колбек покриті тестами з власним ключем, реальні `LIQPAY_PUBLIC_KEY`/
      `LIQPAY_PRIVATE_KEY` ще ніхто не підставляв
- [x] Кабінет покупця: історія замовлень, оплата (LiqPay-форма або демо),
      «Мої матеріали» з авторизованим завантаженням файлів (публічна
      обкладинка — усім, платний файл — лише власнику entitlement)
- [x] Admin dashboard: модерація лістингів, схвалення продавців, ролі
      користувачів (самопониження адміна заборонено), огляд замовлень,
      категорії
- [x] WebSocket-сповіщення (`/notifications` namespace, Firebase-токен у
      handshake): нове замовлення → продавцю, оплата → покупцю й продавцю,
      заявка продавця / рішення модерації → відповідним сторонам
- [x] AI-асистент покупця: retrieval за каталогом завжди працює;
      Claude (`@anthropic-ai/sdk`) підключається зверху, якщо є
      `ANTHROPIC_API_KEY`, інакше — детермінована відповідь із тих самих
      результатів пошуку. Доступний анонімним відвідувачам
- [x] API-міст до Book_Creality: `POST/DELETE /bridge/books`, авторизація
      спільним секретом (`x-bridge-key`), ідемпотентна публікація за
      `externalId`

### Витягнуті уроки (Фаза 1)

- **Годинник цієї машини йде швидше за реальний десь на ~59 хв.** Перевірено
  напряму: `Date-заголовок` від google.com і локальний `Date.now()`
  розходяться майже на годину. Firebase ID-токен живе годину, тож щойно
  видалий токен майже одразу здається "expired" при локальній перевірці —
  будь-який багатокроковий сценарій через реальний Firebase (публікація
  лістингу, схвалення адміном) у живому браузері на цій машині ненадійний.
  Це проблема годинника хоста, не коду: `firebase-admin` не має опції
  вимкнути перевірку `exp`. Тому такі сценарії перевірені виключно
  автоматизованими e2e-тестами (`test/*.e2e-spec.ts`), де `TokenVerifier`
  підмінено на детерміновану заглушку — саме заради цього той seam і
  існує (`src/auth/token-verifier.ts`). Якщо колись знадобиться живе
  ручне тестування багатокрокових автентифікованих сценаріїв — спершу
  синхронізувати системний годинник (`w32tm /resync` на Windows)
- **`toListingDetail()` не годиться для кабінету продавця.** Той маппер
  свідомо ховає `downloadUrl`/`downloadCount` платних файлів від покупця,
  що ще не заплатив — правильно для публічної сторінки, але означало, що
  продавець не бачив власні файли повністю. Додано окремий
  `toOwnerListingDetail()` (`src/catalog/listing.mapper.ts`) — власник
  бачить усе, розбите за роллю файлу (обкладинка/вкладення), а не за
  рівнем доступу
- **`nest start --watch` компілює через `tsconfig.build.json`, не
  `tsconfig.json`.** Після додавання `prisma/seed.ts` ватчер відмовлявся
  стартувати ("not under rootDir"), бо build-конфіг ставить
  `rootDir: "./src"`, а seed-скрипт лежить поза ним. І окремо: `incremental`
  разом із `nest-cli.json`'s `deleteOutDir` — токсична комбінація: nest
  стирає `dist/` на кожному рестарті ватчера, кеш інкрементальної збірки
  про це не знає, вважає вивід актуальним і нічого не перезаписує в щойно
  спорожнену теку. Вимкнено `incremental` — проєкт замалий, щоб ця
  оптимізація щось реально економила

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
