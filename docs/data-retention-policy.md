# Slate Data Retention Policy

This is the default pilot policy and must be reviewed with each customer before
production onboarding.

## Data Slate stores

- Request lifecycle, status, timestamps, source application, employee, client,
  project, workflow, task type, model request identifier, and bounded errors.
- Usage facts: provider, model, tokens, cost micros, latency, and attribution.
- Context records synchronized by the customer.
- Source-app credential hashes and safe fingerprints. Raw keys are never stored.
- Provider credentials only when configured, encrypted with AES-256-GCM.

## Data Slate does not store by default

- Raw prompts.
- Raw model responses.
- Authorization headers or source-app raw keys.
- Provider credentials in logs or browser responses.

## Default retention

- Failed and completed request audits: 90 days.
- Aggregated usage and cost events: 24 months.
- Credential fingerprints and revocation records: life of the customer account
  plus 90 days.
- Application logs: 30 days, with prompt/response and secret fields prohibited.
- Deleted context records are disabled first so historical attribution remains
  intact; hard deletion follows the customer contract.

## Customer controls

Customers may request shorter retention, export of their usage records, or
account deletion. Legal holds override deletion only when documented. Backup
expiration must follow the same maximum retention window.
