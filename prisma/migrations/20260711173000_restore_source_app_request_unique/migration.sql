-- Deduplicate concurrent race rows before restoring the unique index.
DELETE FROM "AiRequestAudit" a
USING "AiRequestAudit" b
WHERE a."sourceAppId" IS NOT NULL
  AND a."sourceAppRequestId" IS NOT NULL
  AND a."sourceAppId" = b."sourceAppId"
  AND a."sourceAppRequestId" = b."sourceAppRequestId"
  AND a."createdAt" > b."createdAt";

CREATE UNIQUE INDEX IF NOT EXISTS "AiRequestAudit_sourceAppId_sourceAppRequestId_key"
ON "AiRequestAudit"("sourceAppId", "sourceAppRequestId");
