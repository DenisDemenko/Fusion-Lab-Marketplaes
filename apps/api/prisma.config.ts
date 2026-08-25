import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moved the connection URL out of schema.prisma for CLI commands
// (migrate/generate/studio). Runtime connection (PrismaService) is
// separate — see src/prisma/prisma.service.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
