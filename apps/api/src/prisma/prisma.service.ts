import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 dropped the schema-level datasource `url` — the client now
// takes a driver adapter instead. See docs/adr/0002-postgres-over-firestore.md
// and apps/api/prisma.config.ts (which covers the CLI/migrate side).
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg(
        {
          connectionString: process.env.DATABASE_URL,
          // The adapter builds a pg.Pool from this config. Bounds are
          // explicit because the defaults are not: Railway's Postgres has a
          // finite connection cap, and an unbounded wait on `connect()` turns
          // an exhausted pool into requests that hang instead of failing.
          max: Number(process.env.DATABASE_POOL_MAX ?? 10),
          connectionTimeoutMillis: 10_000,
          idleTimeoutMillis: 30_000,
        },
        {
          // Without this, an error on an idle pooled client only reaches the
          // adapter's debug channel, which is off in production — the
          // connection dies silently and the next request pays for it.
          onPoolError: (error) =>
            console.error('[prisma] pool error on an idle client:', error),
        },
      ),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
