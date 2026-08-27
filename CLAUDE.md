# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Fusion Lab Marketplace: a Next.js + NestJS + PostgreSQL marketplace (courses,
physical products, and books). Books are pulled in via an API bridge from a
separate sibling project, `Book_Creality` (not part of this repo/workspace).
This project is the intended successor to the static `site/` (Firebase-based
grant portal) — see `docs/adr/0001-two-systems-with-api-bridge.md` for why
it's a clean rebuild instead of a rewrite of `site/`.

Read `CONTEXT.md` for domain glossary (Buyer/Seller/Admin, Listing, Order,
Commission/Payout, Loyalty/Cashback/Referral, Notification/Chat/AI Assistant)
and `ROADMAP.md` for the phased build plan and current status. Both are
written in Ukrainian; code and code comments are in English.

The project is currently in Phase 0 (foundation) per `ROADMAP.md`: monorepo
scaffold, Docker Compose Postgres/Redis, Firebase Auth wired end-to-end with
a `GET /me` smoke-test route, and CI. No catalog/order/payment domain logic
exists yet.

## Commands

Run everything from the repo root — this is a single npm workspace with one
lockfile (`package-lock.json`); there must be no per-app lockfiles.

```bash
docker compose up -d        # Postgres (5432) + Redis (6379) for local dev
npm install                 # from repo root only
npm run dev                 # web (:3000) + api (:3001) via Turborepo
npm run build                # turbo run build (dependency-ordered)
npm run lint
npm run typecheck
npm run test
```

Each of `dev`/`build`/`lint`/`typecheck`/`test` is `turbo run <task>` at the
root, fanning out to `apps/*` (see `turbo.json`). `build`, `lint`, and
`typecheck` depend on `^build` (i.e. `packages/shared-types` must build
first) — Turborepo handles the ordering automatically.

### apps/api (NestJS)

```bash
cd apps/api
npx prisma generate                       # regenerate Prisma client after any schema.prisma change
npx prisma migrate dev --name <name>      # create + apply a migration (needs docker compose up -d first)
npx prisma migrate deploy                 # apply pending migrations without prompting (used in CI)
npm run start:dev                         # nest start --watch
npm run test                              # jest unit tests (*.spec.ts, colocated under src/)
npm run test -- <pattern>                 # run a single test file/suite
npm run test:e2e                          # jest e2e (test/*.e2e-spec.ts)
```

Prisma CLI commands (`generate`/`migrate`) must be run with cwd `apps/api` —
`apps/api/prisma.config.ts` (the CLI's source of `DATABASE_URL`) is only
auto-discovered from its own directory, not via `--schema` from the repo
root.

### apps/web (Next.js)

```bash
cd apps/web
npm run dev          # next dev, :3000
npm run typecheck    # next typegen && tsc --noEmit — typegen must run first (route types)
```

### CI order matters

`.github/workflows/ci.yml` runs, in order: `npm ci` → `npx prisma generate`
(from `apps/api`) → `npm run lint` → `npm run typecheck` → `npx prisma
migrate deploy` (from `apps/api`, against a Postgres service container) →
`npm run build` → `npm run test`. `prisma generate` must happen before
lint/typecheck: type-aware ESLint rules and `tsc` see `PrismaClient` methods
as unresolved `any` without a generated client. Reproduce this order locally
when debugging a CI-only failure.

## Package manager and workspace layout

npm workspaces, not pnpm (see `docs/adr/0003-nestjs-and-monorepo.md` — pnpm
was blocked by an environment permissions issue, npm workspaces covers the
same need). Workspaces: `apps/*`, `packages/*`.

```
apps/web              Next.js 16 (App Router, TS, Tailwind 4)
apps/api              NestJS 11 (TS)
packages/shared-types  DTOs/types shared between web and api
docs/adr/              Architecture Decision Records
CONTEXT.md             domain glossary
ROADMAP.md             phased build plan + handoff checklist
```

`apps/web` and `apps/api` depend on `@fusion-lab/shared-types` via the `"*"`
workspace protocol. `packages/shared-types` must stay free of
framework-specific imports (no Next.js, no Nest) since it's imported from
both a browser bundle and a Node server — see the comment at the top of
`packages/shared-types/src/index.ts`.

## Architecture

### Identity: Firebase Auth + Postgres split

User identity lives in Firebase Auth; domain data (role, seller profile)
lives in Postgres, keyed by Firebase UID. This split (and why Firestore
wasn't used for the whole domain) is explained in
`docs/adr/0002-postgres-over-firestore.md`.

The request flow for any protected route:

1. Client attaches `Authorization: Bearer <Firebase ID token>`
   (`apps/web/src/lib/api-client.ts`'s `apiFetch` does this on every call
   using `apps/web/src/lib/firebase.ts`'s `auth`).
2. `FirebaseAuthGuard` (`apps/api/src/auth/firebase-auth.guard.ts`) verifies
   the token via Firebase Admin SDK, then calls
   `UsersService.syncFromFirebase` to upsert a matching Postgres `User` row
   lazily on first sight of that UID.
3. `@CurrentUser()` (`apps/api/src/auth/current-user.decorator.ts`) pulls
   `{ firebaseUid, email }` off the request for the handler.

`AuthModule` exports `FIREBASE_ADMIN_APP` in addition to `FirebaseAuthGuard`
— when a guard is applied via `@UseGuards()` on a controller in a *different*
module, Nest resolves the guard's constructor deps in that other module's
injector scope, so a provider private to `AuthModule` would otherwise be
invisible. Keep this in mind when adding new providers that guards or
interceptors depend on.

`GET /me` (`apps/api/src/app.controller.ts`) is a throwaway smoke-test route
for the guard — expect it to be removed once real seller/buyer endpoints
exist.

Firebase Admin credentials: prefer `FIREBASE_PRIVATE_KEY_B64` (base64-encoded
service account private key) over the plain-PEM `FIREBASE_PRIVATE_KEY` on
hosting dashboards (Railway/Render/...) — dashboard UIs regularly mangle
literal `\n`/quoting in PEM strings, producing a `DECODER routines` error at
runtime; base64 is opaque ASCII and immune to that. Locally, plain PEM in
`.env` works fine. See `apps/api/src/auth/firebase-admin.provider.ts`.

### Prisma 7 driver adapter

The installed Prisma version is 7.x, which removed
`datasource { url = env(...) }` from `schema.prisma` — this is easy to
mix up with 6.x tutorials/training data. Two separate paths read
`DATABASE_URL`:

- **CLI** (`generate`/`migrate`): reads it from `apps/api/prisma.config.ts`
  via `defineConfig({ datasource: { url: env("DATABASE_URL") } })`.
- **Runtime** (`PrismaService`, `apps/api/src/prisma/prisma.service.ts`):
  constructs `PrismaClient` with a driver adapter,
  `new PrismaPg({ connectionString: process.env.DATABASE_URL })`, not a bare
  connection string.

Both need their own `dotenv/config` import (the CLI's `prisma.config.ts`
does not auto-load `.env`; runtime loads it at the top of `main.ts`). Full
rationale in `docs/adr/0004-prisma7-driver-adapter.md` — if you see example
code using `datasource { url = ... }` or a bare `new PrismaClient()`, treat
it as stale for this project.

### Deployment shape

- `apps/web` → Vercel, root directory `apps/web`.
- `apps/api` → Railway, built from `apps/api/Dockerfile` with the monorepo
  root as build context (`railway.json` pins `builder: DOCKERFILE`,
  `dockerfilePath: apps/api/Dockerfile`) — the Dockerfile does
  `npm ci`/`prisma generate`/`build` from `/repo`, then copies only
  `dist`/`node_modules`/`package.json`/`prisma` into the runtime stage.
- Postgres + Redis: managed instances on Railway/Render in this phase; local
  dev uses `docker-compose.yml` (`postgres:16-alpine`, `redis:7-alpine`).
- `./scripts/setup-handoff.sh` is an interactive wizard for the manual,
  account-gated parts of first-time setup/deploy (Docker install, Firebase
  service account, GitHub repo creation, Vercel/Railway import, DNS) — see
  `ROADMAP.md` → "Хендофф" for what each step does and why it can't be
  automated.

### Conventions to match per-package

- `apps/api` uses single quotes + trailing commas (`.prettierrc`,
  `eslint-plugin-prettier` enforced via `npm run lint`). `apps/web` uses
  double quotes (Next.js/ESLint defaults) — match whichever package you're
  editing, don't unify them.
- `apps/api` ESLint config has `@typescript-eslint/no-explicit-any` off and
  `no-floating-promises`/`no-unsafe-argument` at `warn`, not `error`.
- `apps/web/CLAUDE.md`/`apps/web/AGENTS.md` are regenerated by `next dev`
  itself (not hand-authored) and warn that this Next.js version (16.3.3) has
  breaking changes vs. older training data — check
  `node_modules/next/dist/docs/` before writing Next.js code there if
  something behaves unexpectedly.
