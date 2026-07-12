-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PromptStorageMode" AS ENUM ('METADATA_ONLY', 'REDACTED', 'FULL_LOGGING');

-- CreateEnum
CREATE TYPE "AiRequestSource" AS ENUM ('SLACK', 'WEB');

-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "externalAccountingId" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackWorkspace" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slackTeamId" TEXT NOT NULL,
    "slackTeamName" TEXT,
    "botUserId" TEXT,
    "encryptedBotToken" TEXT,
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackChannelMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slackWorkspaceId" TEXT NOT NULL,
    "slackChannelId" TEXT NOT NULL,
    "slackChannelName" TEXT,
    "clientId" TEXT,
    "projectId" TEXT,
    "defaultWorkflowTypeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackChannelMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRevenue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "month" TEXT NOT NULL,
    "revenueUsd" DECIMAL(18,2) NOT NULL,
    "estimatedLaborCostUsd" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "department" TEXT,
    "role" TEXT,
    "externalId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelProviderConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "endpointUrl" TEXT,
    "encryptedCredential" TEXT,
    "allowedModels" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSourceApp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSourceApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSourceAppCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceAppId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyLast4" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scopes" JSONB,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSourceAppCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationPrivacySettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "promptStorageMode" "PromptStorageMode" NOT NULL DEFAULT 'METADATA_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPrivacySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRequestAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "source" "AiRequestSource" NOT NULL,
    "status" "AiRequestStatus" NOT NULL,
    "externalLiteLlmRequestId" TEXT,
    "slackTeamId" TEXT,
    "slackChannelId" TEXT,
    "slackUserId" TEXT,
    "slackThreadTs" TEXT,
    "slackMessageTs" TEXT,
    "clientId" TEXT,
    "projectId" TEXT,
    "workflowTypeId" TEXT,
    "employeeId" TEXT,
    "sourceAppId" TEXT,
    "taskType" TEXT,
    "sourceAppRequestId" TEXT,
    "promptStored" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRequestAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aiRequestAuditId" TEXT,
    "source" "AiRequestSource" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "inputCostMicros" BIGINT NOT NULL DEFAULT 0,
    "outputCostMicros" BIGINT NOT NULL DEFAULT 0,
    "totalCostMicros" BIGINT NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "externalLiteLlmRequestId" TEXT,
    "slackTeamId" TEXT,
    "slackChannelId" TEXT,
    "slackThreadTs" TEXT,
    "slackMessageTs" TEXT,
    "clientId" TEXT,
    "projectId" TEXT,
    "workflowTypeId" TEXT,
    "employeeId" TEXT,
    "sourceAppId" TEXT,
    "taskType" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'QUEUED',
    "payloadJson" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE INDEX "AppUser_createdAt_idx" ON "AppUser"("createdAt");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_createdAt_idx" ON "Membership"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_userId_key" ON "Membership"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Client_organizationId_name_key" ON "Client"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Client_organizationId_externalId_key" ON "Client"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_organizationId_clientId_name_key" ON "Project"("organizationId", "clientId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_organizationId_externalId_key" ON "Project"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "WorkflowType_organizationId_idx" ON "WorkflowType"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowType_createdAt_idx" ON "WorkflowType"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowType_organizationId_slug_key" ON "WorkflowType"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowType_organizationId_externalId_key" ON "WorkflowType"("organizationId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SlackWorkspace_slackTeamId_key" ON "SlackWorkspace"("slackTeamId");

-- CreateIndex
CREATE INDEX "SlackWorkspace_organizationId_idx" ON "SlackWorkspace"("organizationId");

-- CreateIndex
CREATE INDEX "SlackWorkspace_createdAt_idx" ON "SlackWorkspace"("createdAt");

-- CreateIndex
CREATE INDEX "SlackChannelMapping_organizationId_idx" ON "SlackChannelMapping"("organizationId");

-- CreateIndex
CREATE INDEX "SlackChannelMapping_clientId_idx" ON "SlackChannelMapping"("clientId");

-- CreateIndex
CREATE INDEX "SlackChannelMapping_projectId_idx" ON "SlackChannelMapping"("projectId");

-- CreateIndex
CREATE INDEX "SlackChannelMapping_createdAt_idx" ON "SlackChannelMapping"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlackChannelMapping_slackWorkspaceId_slackChannelId_key" ON "SlackChannelMapping"("slackWorkspaceId", "slackChannelId");

-- CreateIndex
CREATE INDEX "ClientRevenue_organizationId_idx" ON "ClientRevenue"("organizationId");

-- CreateIndex
CREATE INDEX "ClientRevenue_clientId_idx" ON "ClientRevenue"("clientId");

-- CreateIndex
CREATE INDEX "ClientRevenue_projectId_idx" ON "ClientRevenue"("projectId");

-- CreateIndex
CREATE INDEX "ClientRevenue_month_idx" ON "ClientRevenue"("month");

-- CreateIndex
CREATE INDEX "ClientRevenue_createdAt_idx" ON "ClientRevenue"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRevenue_clientId_projectId_month_key" ON "ClientRevenue"("clientId", "projectId", "month");

-- CreateIndex
CREATE INDEX "Employee_organizationId_idx" ON "Employee"("organizationId");

-- CreateIndex
CREATE INDEX "Employee_organizationId_email_idx" ON "Employee"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Employee_createdAt_idx" ON "Employee"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_name_key" ON "Employee"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_externalId_key" ON "Employee"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "ModelProviderConnection_organizationId_idx" ON "ModelProviderConnection"("organizationId");

-- CreateIndex
CREATE INDEX "ModelProviderConnection_organizationId_isActive_idx" ON "ModelProviderConnection"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "ModelProviderConnection_createdAt_idx" ON "ModelProviderConnection"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModelProviderConnection_organizationId_name_key" ON "ModelProviderConnection"("organizationId", "name");

-- CreateIndex
CREATE INDEX "AiSourceApp_organizationId_idx" ON "AiSourceApp"("organizationId");

-- CreateIndex
CREATE INDEX "AiSourceApp_organizationId_type_idx" ON "AiSourceApp"("organizationId", "type");

-- CreateIndex
CREATE INDEX "AiSourceApp_createdAt_idx" ON "AiSourceApp"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiSourceApp_organizationId_name_key" ON "AiSourceApp"("organizationId", "name");

-- CreateIndex
CREATE INDEX "AiSourceAppCredential_organizationId_idx" ON "AiSourceAppCredential"("organizationId");

-- CreateIndex
CREATE INDEX "AiSourceAppCredential_sourceAppId_idx" ON "AiSourceAppCredential"("sourceAppId");

-- CreateIndex
CREATE INDEX "AiSourceAppCredential_keyPrefix_idx" ON "AiSourceAppCredential"("keyPrefix");

-- CreateIndex
CREATE INDEX "AiSourceAppCredential_organizationId_sourceAppId_idx" ON "AiSourceAppCredential"("organizationId", "sourceAppId");

-- CreateIndex
CREATE INDEX "AiSourceAppCredential_createdAt_idx" ON "AiSourceAppCredential"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPrivacySettings_organizationId_key" ON "OrganizationPrivacySettings"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationPrivacySettings_createdAt_idx" ON "OrganizationPrivacySettings"("createdAt");

-- CreateIndex
CREATE INDEX "AiRequestAudit_organizationId_idx" ON "AiRequestAudit"("organizationId");

-- CreateIndex
CREATE INDEX "AiRequestAudit_userId_idx" ON "AiRequestAudit"("userId");

-- CreateIndex
CREATE INDEX "AiRequestAudit_clientId_idx" ON "AiRequestAudit"("clientId");

-- CreateIndex
CREATE INDEX "AiRequestAudit_projectId_idx" ON "AiRequestAudit"("projectId");

-- CreateIndex
CREATE INDEX "AiRequestAudit_workflowTypeId_idx" ON "AiRequestAudit"("workflowTypeId");

-- CreateIndex
CREATE INDEX "AiRequestAudit_organizationId_employeeId_idx" ON "AiRequestAudit"("organizationId", "employeeId");

-- CreateIndex
CREATE INDEX "AiRequestAudit_organizationId_sourceAppId_idx" ON "AiRequestAudit"("organizationId", "sourceAppId");

-- CreateIndex
CREATE INDEX "AiRequestAudit_organizationId_taskType_idx" ON "AiRequestAudit"("organizationId", "taskType");

-- CreateIndex
CREATE INDEX "AiRequestAudit_sourceAppRequestId_idx" ON "AiRequestAudit"("sourceAppRequestId");

-- CreateIndex
CREATE INDEX "AiRequestAudit_status_idx" ON "AiRequestAudit"("status");

-- CreateIndex
CREATE INDEX "AiRequestAudit_createdAt_idx" ON "AiRequestAudit"("createdAt");

-- CreateIndex
CREATE INDEX "AiRequestAudit_externalLiteLlmRequestId_idx" ON "AiRequestAudit"("externalLiteLlmRequestId");

-- CreateIndex
CREATE INDEX "AiRequestAudit_slackTeamId_slackChannelId_idx" ON "AiRequestAudit"("slackTeamId", "slackChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "AiRequestAudit_sourceAppId_sourceAppRequestId_key" ON "AiRequestAudit"("sourceAppId", "sourceAppRequestId");

-- CreateIndex
CREATE INDEX "AiUsageEvent_organizationId_idx" ON "AiUsageEvent"("organizationId");

-- CreateIndex
CREATE INDEX "AiUsageEvent_aiRequestAuditId_idx" ON "AiUsageEvent"("aiRequestAuditId");

-- CreateIndex
CREATE INDEX "AiUsageEvent_source_idx" ON "AiUsageEvent"("source");

-- CreateIndex
CREATE INDEX "AiUsageEvent_provider_model_idx" ON "AiUsageEvent"("provider", "model");

-- CreateIndex
CREATE INDEX "AiUsageEvent_clientId_idx" ON "AiUsageEvent"("clientId");

-- CreateIndex
CREATE INDEX "AiUsageEvent_projectId_idx" ON "AiUsageEvent"("projectId");

-- CreateIndex
CREATE INDEX "AiUsageEvent_workflowTypeId_idx" ON "AiUsageEvent"("workflowTypeId");

-- CreateIndex
CREATE INDEX "AiUsageEvent_organizationId_employeeId_idx" ON "AiUsageEvent"("organizationId", "employeeId");

-- CreateIndex
CREATE INDEX "AiUsageEvent_organizationId_sourceAppId_idx" ON "AiUsageEvent"("organizationId", "sourceAppId");

-- CreateIndex
CREATE INDEX "AiUsageEvent_organizationId_taskType_idx" ON "AiUsageEvent"("organizationId", "taskType");

-- CreateIndex
CREATE INDEX "AiUsageEvent_occurredAt_idx" ON "AiUsageEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_externalLiteLlmRequestId_idx" ON "AiUsageEvent"("externalLiteLlmRequestId");

-- CreateIndex
CREATE INDEX "AiUsageEvent_slackTeamId_slackChannelId_idx" ON "AiUsageEvent"("slackTeamId", "slackChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJob_idempotencyKey_key" ON "BackgroundJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_runAfter_idx" ON "BackgroundJob"("status", "runAfter");

-- CreateIndex
CREATE INDEX "BackgroundJob_type_idx" ON "BackgroundJob"("type");

-- CreateIndex
CREATE INDEX "BackgroundJob_createdAt_idx" ON "BackgroundJob"("createdAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowType" ADD CONSTRAINT "WorkflowType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackWorkspace" ADD CONSTRAINT "SlackWorkspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackChannelMapping" ADD CONSTRAINT "SlackChannelMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackChannelMapping" ADD CONSTRAINT "SlackChannelMapping_slackWorkspaceId_fkey" FOREIGN KEY ("slackWorkspaceId") REFERENCES "SlackWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackChannelMapping" ADD CONSTRAINT "SlackChannelMapping_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackChannelMapping" ADD CONSTRAINT "SlackChannelMapping_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackChannelMapping" ADD CONSTRAINT "SlackChannelMapping_defaultWorkflowTypeId_fkey" FOREIGN KEY ("defaultWorkflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRevenue" ADD CONSTRAINT "ClientRevenue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRevenue" ADD CONSTRAINT "ClientRevenue_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRevenue" ADD CONSTRAINT "ClientRevenue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelProviderConnection" ADD CONSTRAINT "ModelProviderConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSourceApp" ADD CONSTRAINT "AiSourceApp_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSourceAppCredential" ADD CONSTRAINT "AiSourceAppCredential_sourceAppId_fkey" FOREIGN KEY ("sourceAppId") REFERENCES "AiSourceApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPrivacySettings" ADD CONSTRAINT "OrganizationPrivacySettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRequestAudit" ADD CONSTRAINT "AiRequestAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRequestAudit" ADD CONSTRAINT "AiRequestAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRequestAudit" ADD CONSTRAINT "AiRequestAudit_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRequestAudit" ADD CONSTRAINT "AiRequestAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRequestAudit" ADD CONSTRAINT "AiRequestAudit_workflowTypeId_fkey" FOREIGN KEY ("workflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRequestAudit" ADD CONSTRAINT "AiRequestAudit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRequestAudit" ADD CONSTRAINT "AiRequestAudit_sourceAppId_fkey" FOREIGN KEY ("sourceAppId") REFERENCES "AiSourceApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_aiRequestAuditId_fkey" FOREIGN KEY ("aiRequestAuditId") REFERENCES "AiRequestAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_workflowTypeId_fkey" FOREIGN KEY ("workflowTypeId") REFERENCES "WorkflowType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_sourceAppId_fkey" FOREIGN KEY ("sourceAppId") REFERENCES "AiSourceApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
