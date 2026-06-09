# Cost Tracking AI

Production-quality MVP scaffold for an AI job-costing SaaS built for agencies.
The app is designed to track AI usage by agency, client, project, user,
workflow, and Slack channel.

## Stack

- Next.js 15 with App Router
- TypeScript in strict mode
- Tailwind CSS
- shadcn/ui-style component setup
- Prisma + PostgreSQL
- Zod environment validation
- Pino structured logging

## Project structure

```text
app/
  (auth)/
  (dashboard)/
  api/
components/
lib/
  auth/
  db/
  jobs/
  litellm/
  security/
  slack/
prisma/
scripts/
```

## Local setup

1. Install Node.js 20+ and a local PostgreSQL instance.
2. Copy the environment template:

```bash
cp .env.example .env
```

3. Install dependencies:

```bash
npm install
```

4. Validate the environment:

```bash
npm run check:env
```

5. Generate the Prisma client and push the schema to your local database:

```bash
npm run db:generate
npm run db:push
```

6. Optionally seed local demo data:

```bash
npm run db:seed
```

7. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page or
[http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the app shell.

## Environment variables

The server validates these variables through [`lib/env.ts`](/Users/rohanshah/Desktop/Cost-Tracking-AI/lib/env.ts):

- `DATABASE_URL`
- `LITELLM_PROXY_URL`
- `LITELLM_MASTER_KEY`
- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`
- `APP_BASE_URL`
- `ENCRYPTION_KEY`

These variables are intentionally server-only and are not exposed through
`NEXT_PUBLIC_*` names.

## Included infrastructure

- `lib/env.ts` validates runtime configuration with Zod.
- `lib/db/prisma.ts` exposes a Prisma singleton for server-side usage.
- `middleware.ts` applies baseline security headers.
- `prisma/schema.prisma` models agencies, memberships, clients, projects,
  workflows, Slack workspaces, Slack channels, and usage events.
- `app/api/health/route.ts` exposes a simple health endpoint for local checks.

## Not implemented yet

- Authentication and session management
- Live LiteLLM ingestion
- Live Slack installation and sync flows
- Background job execution

The shell and schema are ready for those next milestones without hiding business
logic inside UI components.
