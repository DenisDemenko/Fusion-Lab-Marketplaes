-- Phase D (docs/migration-plan.md): per-lesson watch progress.
--
-- As with every prior migration, the DropIndex/DROP DEFAULT statements the
-- diff tool proposed for Listing.searchVector are omitted — drift from the
-- hand-written full-text-search indexes, not a real schema change.

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "moduleIndex" INTEGER NOT NULL,
    "lessonIndex" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_userId_listingId_moduleIndex_lessonIndex_key" ON "LessonProgress"("userId", "listingId", "moduleIndex", "lessonIndex");

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
