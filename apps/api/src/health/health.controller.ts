import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

// Unauthenticated liveness+readiness probe that actually touches Postgres.
//
// This exists because every other cheap check lies about the database:
// `GET /` returns a constant, `GET /me` 401s on a missing token before any
// query runs, and PrismaService's pg driver adapter connects lazily — so
// `$connect()` resolves and Nest logs "successfully started" even when
// DATABASE_URL points at nothing. A real `SELECT 1` is the only honest
// signal, so deploys can be verified instead of assumed.
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(@Res() res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return res.status(HttpStatus.OK).json({ status: 'ok', database: 'up' });
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

      // 503 (not 500) so uptime checks and Railway healthchecks read this
      // as "not ready to serve traffic" rather than a crashed process.
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'error',
        database: 'down',
        code,
        message: error instanceof Error ? error.message.trim() : String(error),
      });
    }
  }
}
