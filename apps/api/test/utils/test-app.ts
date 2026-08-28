import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  TOKEN_VERIFIER,
  type TokenVerifier,
  type VerifiedToken,
} from '../../src/auth/token-verifier';

// Firebase ID tokens are signed by Google and cannot be minted offline, so
// the suite substitutes the one seam built for it: TokenVerifier. A test
// "token" is just an email — `Authorization: Bearer buyer@test.dev` — and
// the UID is derived from it, which makes the identity in a failing test
// readable at a glance.
//
// Everything else in the application runs for real: the real guards, the
// real Postgres, the real file writes.
class StubTokenVerifier implements TokenVerifier {
  verify(idToken: string): Promise<VerifiedToken> {
    if (!idToken.includes('@')) {
      return Promise.reject(new Error('Invalid test token'));
    }

    return Promise.resolve({
      uid: `test-uid-${idToken}`,
      email: idToken,
      name: idToken.split('@')[0],
    });
  }
}

export interface TestContext {
  app: INestApplication<App>;
  prisma: PrismaService;
  http: () => request.Agent;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TOKEN_VERIFIER)
    .useClass(StubTokenVerifier)
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();

  // Same pipe configuration as main.ts: a suite that skipped it would pass
  // while production rejected the very same request.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    http: () => request(app.getHttpServer()),
    close: async () => {
      await app.close();
    },
  };
}

// Order does not matter: one TRUNCATE with CASCADE clears the graph in a
// single statement, and RESTART IDENTITY keeps sequences from drifting
// across runs.
export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AssistantMessage", "AssistantThread", "Notification", "Entitlement",
      "Payment", "OrderItem", "Order", "CartItem", "Cart", "MediaAsset",
      "Listing", "Category", "SellerProfile", "User"
    RESTART IDENTITY CASCADE
  `);
}

export function bearer(email: string): string {
  return `Bearer ${email}`;
}

// Promotes an account to admin the way the real system does — by role on
// the user row. The first admin has to come from somewhere; in production
// it is the seed, here it is this helper.
export async function makeAdmin(prisma: PrismaService, email: string) {
  return prisma.user.update({ where: { email }, data: { role: 'admin' } });
}
