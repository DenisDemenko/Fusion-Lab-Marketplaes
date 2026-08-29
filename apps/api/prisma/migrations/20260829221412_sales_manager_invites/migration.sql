-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'sales_manager_invited';

-- CreateTable
CREATE TABLE "SalesManagerInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesManagerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesManagerInvite_token_key" ON "SalesManagerInvite"("token");

-- CreateIndex
CREATE INDEX "SalesManagerInvite_email_idx" ON "SalesManagerInvite"("email");

-- CreateIndex
CREATE INDEX "SalesManagerInvite_inviterId_idx" ON "SalesManagerInvite"("inviterId");

-- AddForeignKey
ALTER TABLE "SalesManagerInvite" ADD CONSTRAINT "SalesManagerInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesManagerInvite" ADD CONSTRAINT "SalesManagerInvite_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
