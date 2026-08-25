# ADR 0003: NestJS для бекенду, npm workspaces + Turborepo для монорепо

## Статус

Прийнято — 2026-08-25

## Контекст

Book_Creality вже демонструє впевнений Express. Цільова вакансія називає
NestJS першим у переліку бажаних бекенд-фреймворків і окремо наголошує на
"scalable architecture" / "modular monolith" розумінні. Frontend (Next.js)
і backend (NestJS) обидва на TypeScript — є сенс ділити типи DTO між ними.

## Рішення

- Бекенд Marketplace — **NestJS**, не Express: модульна DI-архітектура
  природно мапиться на bounded contexts (catalog/orders/payments/sellers/
  loyalty), і диверсифікує портфоліо відносно Book_Creality.
- Репозиторій — **монорепо** (`apps/web`, `apps/api`, `packages/shared-types`)
  з npm workspaces + Turborepo для оркестрації задач (`dev`/`build`/
  `lint`/`typecheck`/`test` через `turbo run`).
- Пакетний менеджер — **npm**, не pnpm: pnpm через corepack не вдалось
  активувати в поточному середовищі через відсутність прав запису в
  `C:\Program Files\nodejs` (EPERM); npm workspaces покриває ту саму
  потребу (єдиний lockfile, hoisting, `packages/shared-types` як
  workspace-залежність) без додаткової інфраструктурної роботи.

## Альтернативи

1. **Fastify замість NestJS** — відхилено: швидший, але без вбудованої
   модульної структури; NestJS краще демонструє "system thinking" саме
   тому, що змушує явно окреслювати межі модулів.
2. **Два окремі репозиторії (frontend/backend)** — відхилено: монорепо
   дає типобезпечний контракт `packages/shared-types` без дублювання DTO,
   і один CI-пайплайн замість двох.
3. **pnpm** — технічно кращий вибір для workspaces (жорсткіший
   node_modules, швидший install), але заблокований середовищем; варто
   переоцінити при переносі в CI/на інший компʼютер, де corepack працює
   без обмежень прав.

## Наслідки

- `apps/web/package.json` і `apps/api/package.json` залежать від
  `@fusion-lab/shared-types` через `"*"` (workspace-протокол npm).
- Один корневий `package-lock.json`; окремі per-app lockfiles видалено.
- CI повинен запускати `npm install` з кореня, не з `apps/*`.
