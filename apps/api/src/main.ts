import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// The browser enforces CORS, so a wrong origin list here shows up as
// opaque "failed to fetch" errors in the frontend rather than anything
// visible on the server. WEB_ORIGIN takes a comma-separated list because
// the frontend legitimately lives at several origins at once: local dev,
// the Vercel production URL, per-branch Vercel preview URLs, and later
// the custom domain.
function allowedOrigins(): string[] {
  const configured = process.env.WEB_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured?.length ? configured : ['http://localhost:3000'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origins = allowedOrigins();

  app.enableCors({ origin: origins, credentials: true });

  // Applied globally so no controller can forget it. Transformation is
  // what turns query strings and multipart fields into the numbers and
  // enums the DTOs declare; whitelisting drops properties no DTO asked
  // for, so a client cannot smuggle its own status into a create call.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Logged at boot so a CORS misconfiguration is visible in the deploy
  // logs, instead of only surfacing later as a broken frontend.
  console.log(`CORS allowed origins: ${origins.join(', ')}`);

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
