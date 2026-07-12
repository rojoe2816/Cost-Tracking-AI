-- AlterTable
ALTER TABLE "OrganizationPrivacySettings" ADD COLUMN "allowAttributionTrainingTextStorage" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PasswordCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "failedAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAttributionDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aiRequestAuditId" TEXT,
    "sourceAppId" TEXT NOT NULL,
    "employeeId" TEXT,
    "predictedWorkflowTypeId" TEXT,
    "predictedTaskType" TEXT,
    "predictedConfidence" DOUBLE PRECISION,
    "modelVersion" TEXT,
    "finalWorkflowTypeId" TEXT NOT NULL,
    "finalTaskType" TEXT NOT NULL,
    "wasOverridden" BOOLEAN NOT NULL DEFAULT false,
    "requiredReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAttributionDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributionTrainingExample" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encryptedText" TEXT NOT NULL,
    "finalWorkflowTypeId" TEXT NOT NULL,
    "finalTaskType" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'user_consent',
    "consentCapturedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributionTrainingExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributionModelVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "macroF1" DOUBLE PRECISION,
    "top2Accuracy" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "evaluationJson" JSONB,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordCredential_userId_key" ON "PasswordCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordCredential_username_key" ON "PasswordCredential"("username");

-- CreateIndex
CREATE INDEX "PasswordCredential_username_idx" ON "PasswordCredential"("username");

-- CreateIndex
CREATE INDEX "PasswordCredential_createdAt_idx" ON "PasswordCredential"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiAttributionDecision_aiRequestAuditId_key" ON "AiAttributionDecision"("aiRequestAuditId");

-- CreateIndex
CREATE INDEX "AiAttributionDecision_organizationId_createdAt_idx" ON "AiAttributionDecision"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAttributionDecision_organizationId_wasOverridden_idx" ON "AiAttributionDecision"("organizationId", "wasOverridden");

-- CreateIndex
CREATE INDEX "AiAttributionDecision_organizationId_modelVersion_idx" ON "AiAttributionDecision"("organizationId", "modelVersion");

-- CreateIndex
CREATE INDEX "AiAttributionDecision_sourceAppId_idx" ON "AiAttributionDecision"("sourceAppId");

-- CreateIndex
CREATE INDEX "AttributionTrainingExample_organizationId_approved_deletedAt_idx" ON "AttributionTrainingExample"("organizationId", "approved", "deletedAt");

-- CreateIndex
CREATE INDEX "AttributionTrainingExample_organizationId_createdAt_idx" ON "AttributionTrainingExample"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AttributionModelVersion_organizationId_isActive_idx" ON "AttributionModelVersion"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "AttributionModelVersion_createdAt_idx" ON "AttributionModelVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttributionModelVersion_organizationId_version_key" ON "AttributionModelVersion"("organizationId", "version");

-- AddForeignKey
ALTER TABLE "PasswordCredential" ADD CONSTRAINT "PasswordCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAttributionDecision" ADD CONSTRAINT "AiAttributionDecision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAttributionDecision" ADD CONSTRAINT "AiAttributionDecision_aiRequestAuditId_fkey" FOREIGN KEY ("aiRequestAuditId") REFERENCES "AiRequestAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAttributionDecision" ADD CONSTRAINT "AiAttributionDecision_sourceAppId_fkey" FOREIGN KEY ("sourceAppId") REFERENCES "AiSourceApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAttributionDecision" ADD CONSTRAINT "AiAttributionDecision_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAttributionDecision" ADD CONSTRAINT "AiAttributionDecision_predictedWorkflowTypeId_fkey" FOREIGN KEY ("predictedWorkflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAttributionDecision" ADD CONSTRAINT "AiAttributionDecision_finalWorkflowTypeId_fkey" FOREIGN KEY ("finalWorkflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionTrainingExample" ADD CONSTRAINT "AttributionTrainingExample_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionTrainingExample" ADD CONSTRAINT "AttributionTrainingExample_finalWorkflowTypeId_fkey" FOREIGN KEY ("finalWorkflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionModelVersion" ADD CONSTRAINT "AttributionModelVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
