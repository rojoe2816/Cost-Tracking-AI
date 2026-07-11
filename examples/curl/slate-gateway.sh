#!/usr/bin/env sh
set -eu

: "${SLATE_BASE_URL:?Set SLATE_BASE_URL}"
: "${SLATE_API_KEY:?Set SLATE_API_KEY}"

curl --fail-with-body \
  -X POST "${SLATE_BASE_URL%/}/api/v1/ai/gateway" \
  -H "Authorization: Bearer ${SLATE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeExternalId": "employee-427",
    "clientExternalId": "client-acme",
    "projectExternalId": "project-seo-001",
    "workflowExternalId": "client-update",
    "taskType": "client_update",
    "sourceAppRequestId": "curl-request-001",
    "model": "gpt-4o-mini",
    "input": "Draft a brief client update."
  }'
