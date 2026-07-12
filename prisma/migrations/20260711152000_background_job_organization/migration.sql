-- AlterTable
ALTER TABLE "BackgroundJob" ADD COLUMN "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "BackgroundJob_organizationId_createdAt_idx" ON "BackgroundJob"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
