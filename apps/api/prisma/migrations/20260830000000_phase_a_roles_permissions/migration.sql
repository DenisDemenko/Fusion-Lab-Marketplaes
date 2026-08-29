-- Phase A (docs/migration-plan.md): 8-role model + permission overrides.
--
-- The three statements the diff tool proposed and that are NOT here —
-- dropping Listing_searchVector_idx, dropping Listing_title_trgm_idx, and
-- "ALTER COLUMN searchVector DROP DEFAULT" — are drift artifacts from the
-- hand-written full-text-search indexes (raw SQL, not expressible as
-- Prisma @@index; see the Phase 1 migration's own header comment). Kept
-- out for the same reason as every migration since.

-- AlterEnum
-- Postgres can't add multiple enum values in one transaction on older
-- versions; each ADD VALUE below is its own statement for that reason,
-- not a stylistic choice.
ALTER TYPE "UserRole" ADD VALUE 'writer';
ALTER TYPE "UserRole" ADD VALUE 'expert';
ALTER TYPE "UserRole" ADD VALUE 'sales_manager';
ALTER TYPE "UserRole" ADD VALUE 'instruction_engineer';
ALTER TYPE "UserRole" ADD VALUE 'student';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roleChosenAt" TIMESTAMP(3),
ADD COLUMN     "salesApproved" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_permission_key" ON "UserPermissionOverride"("userId", "permission");

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
