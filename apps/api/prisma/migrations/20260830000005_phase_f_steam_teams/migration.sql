-- Phase F1 (docs/migration-plan.md): STEAM teams — up to 5 people working
-- on one shared lab project, published to the public catalog only after
-- admin moderation. No "active team subscription" badge (Phase E was
-- skipped) — see the migration plan's Phase F notes.
--
-- As with every prior migration, the FTS DropIndex/DROP DEFAULT statements
-- the diff tool proposed for Listing.searchVector are omitted — drift from
-- the hand-written full-text-search indexes, not a real schema change.

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('pending', 'published', 'rejected');

-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('owner', 'member');

-- CreateEnum
CREATE TYPE "TeamMemberStatus" AS ENUM ('invited', 'confirmed', 'declined');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'team_invited';
ALTER TYPE "NotificationType" ADD VALUE 'team_submitted';
ALTER TYPE "NotificationType" ADD VALUE 'team_published';
ALTER TYPE "NotificationType" ADD VALUE 'team_rejected';

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN "teamId" TEXT;

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT,
    "description" TEXT NOT NULL,
    "status" "TeamStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "ownerId" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamMemberRole" NOT NULL DEFAULT 'member',
    "status" "TeamMemberStatus" NOT NULL DEFAULT 'invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_status_createdAt_idx" ON "Team"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "MediaAsset_teamId_idx" ON "MediaAsset"("teamId");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
