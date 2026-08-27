import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

// Unauthenticated liveness+readiness probe that actually touches Postgres.
//
// This exists because every other cheap check lies about the database:
// `GET /` returns a constant, `GET /me` 401s on a missing token before any
// query runs, and PrismaService's pg driver adapter connects lazily — so
// `$connect()` resolves and Nest logs "successfully started" even when
// DATABASE_URL points at nothing. Only a real query is an honest signal,
// so deploys can be verified instead of assumed.
//
// It queries a real table rather than `SELECT 1`, because connectivity
// alone isn't readiness: a freshly provisioned database answers SELECT 1
// happily while having no schema at all. Counting users proves the
// connection works, the migrations ran, and the generated Prisma client
// matches what's actually in the database.
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(@Res() res: Response) {
    try {
      const users = await this.prisma.user.count();
      return res
        .status(HttpStatus.OK)
        .json({ status: 'ok', database: 'up', schema: 'ready', users });
    } catch (error) {
      // Prisma buries the useful part: `message` is a near-empty "Invalid
      // `prisma.$queryRaw()` invocation", while `code` carries the actual
      // cause (ECONNREFUSED, ENOTFOUND, 28P01 for bad credentials...).
      // Surface the code — it's what tells you whether the URL is wrong,
      // the host is unreachable, or the password is bad.
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: unknown }).code)
          : undefined;

      // P2021 = "table does not exist": the connection is fine, the
      // migrations just haven't run. Worth distinguishing — it's a
      // completely different fix from an unreachable host.
      const schemaMissing = code === 'P2021';

      // Prisma's message embeds the failing call site — absolute source
      // paths and a numbered code excerpt. This endpoint is public, so
      // drop those lines and keep the human-readable summary
      // ("The table `public.User` does not exist in the current database.").
      // Connection errors carry no such summary at all; there `code`
      // (ECONNREFUSED/ENOTFOUND/...) is the whole signal, so message is
      // simply omitted rather than padded with a meaningless snippet.
      const raw = error instanceof Error ? error.message : String(error);
      const message = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 &&
            !/^(→\s*)?\d+\s/.test(line) && // numbered code excerpt
            !line.startsWith('Invalid `') && // "Invalid `prisma.x()` invocation in"
            !line.includes('health.controller'), // source path
        )
        .pop();

      // 503 (not 500) so uptime checks and Railway healthchecks read this
      // as "not ready to serve traffic" rather than a crashed process.
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'error',
        database: schemaMissing ? 'up' : 'down',
        schema: schemaMissing
          ? 'missing — run prisma migrate deploy'
          : 'unknown',
        code,
        message,
      });
    }
  }
}
