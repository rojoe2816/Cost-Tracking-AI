import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Building2,
  Gauge,
  Hash,
  Layers3,
  ShieldCheck,
  Users,
} from "lucide-react";

import { AppLogo } from "@/components/app-logo";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authStatus } from "@/lib/auth";
import { jobCatalog } from "@/lib/jobs";
import { getLiteLLMRuntimeConfig } from "@/lib/litellm";
import { getSlackRuntimeConfig } from "@/lib/slack";

const featureCards = [
  {
    title: "Agency-first cost controls",
    description:
      "Roll AI spend up from individual prompts to agency, client, and project profitability.",
    icon: Building2,
  },
  {
    title: "Workflow-level observability",
    description:
      "Track every automation path by workflow, model, prompt volume, and blended cost.",
    icon: Layers3,
  },
  {
    title: "Slack channel attribution",
    description:
      "Capture where requests originate so finance and delivery teams can compare channel behavior.",
    icon: Hash,
  },
  {
    title: "Production safety rails",
    description:
      "Typed env validation, Prisma schema ownership, structured logging, and secure defaults out of the box.",
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  const slackConfig = getSlackRuntimeConfig();
  const liteLlmConfig = getLiteLLMRuntimeConfig();

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-grid bg-[size:40px_40px] opacity-30"
      />
      <SiteHeader />
      <main className="container relative space-y-16 pb-20 pt-10 md:space-y-20 md:pb-24 md:pt-14">
        <section className="surface-panel overflow-hidden">
          <div className="grid gap-10 px-6 py-8 md:px-10 md:py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="space-y-6">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                MVP foundation
              </Badge>
              <div className="space-y-4">
                <AppLogo />
                <h1 className="max-w-3xl font-heading text-4xl font-semibold tracking-tight text-balance md:text-6xl">
                  Job-costing infrastructure for agencies building with AI.
                </h1>
                <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
                  This scaffold gives you a Next.js 15 control plane with Prisma,
                  shadcn/ui, validated environment config, and a schema centered on
                  agencies, clients, projects, workflows, people, and Slack channels.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="gap-2 rounded-full px-6">
                  <Link href="/dashboard">
                    Open dashboard shell
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="rounded-full px-6"
                >
                  <Link href="/sign-in">Review auth route</Link>
                </Button>
              </div>
            </div>

            <Card className="border-0 bg-slate-950 text-slate-50 shadow-none">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">
                  Integration readiness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Auth milestone</span>
                  <Badge variant="secondary" className="bg-white/10 text-white">
                    {authStatus.enabled ? "Enabled" : "Deferred"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Slack configuration</span>
                  <Badge variant="secondary" className="bg-white/10 text-white">
                    {slackConfig.enabled ? "Ready" : "Awaiting secrets"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>LiteLLM configuration</span>
                  <Badge variant="secondary" className="bg-white/10 text-white">
                    {liteLlmConfig.enabled ? "Ready" : "Awaiting credentials"}
                  </Badge>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Planned background jobs
                  </p>
                  <ul className="mt-3 space-y-2 text-slate-200">
                    {jobCatalog.map((job) => (
                      <li key={job.key} className="flex items-center justify-between">
                        <span>{job.label}</span>
                        <span className="text-slate-400">{job.scheduleHint}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((card) => (
            <Card key={card.title} className="surface-panel border-0 bg-white/75">
              <CardHeader className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <card.icon className="h-6 w-6" />
                </div>
                <CardTitle className="font-heading text-2xl">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="surface-panel border-0 lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-heading text-3xl">
                What is implemented in this milestone
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
              <div className="rounded-2xl bg-secondary/70 p-5">
                <div className="mb-3 flex items-center gap-3 text-foreground">
                  <Gauge className="h-5 w-5 text-primary" />
                  <span className="font-medium">Operational shell</span>
                </div>
                Route groups, dashboard navigation, typed UI primitives, and
                overview pages ready for real data wiring.
              </div>
              <div className="rounded-2xl bg-secondary/70 p-5">
                <div className="mb-3 flex items-center gap-3 text-foreground">
                  <Bot className="h-5 w-5 text-primary" />
                  <span className="font-medium">Integration seams</span>
                </div>
                Dedicated modules for LiteLLM ingestion, Slack sync, background
                jobs, and security policy management.
              </div>
              <div className="rounded-2xl bg-secondary/70 p-5">
                <div className="mb-3 flex items-center gap-3 text-foreground">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="font-medium">Agency data model</span>
                </div>
                Prisma models for memberships, clients, projects, workflows,
                users, Slack workspaces, channels, and AI usage events.
              </div>
              <div className="rounded-2xl bg-secondary/70 p-5">
                <div className="mb-3 flex items-center gap-3 text-foreground">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span className="font-medium">Infrastructure guardrails</span>
                </div>
                Zod environment validation, security headers middleware, and
                pino-based structured logging.
              </div>
            </CardContent>
          </Card>

          <Card className="surface-panel border-0 bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="font-heading text-3xl">
                Next implementation step
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Authentication is intentionally not implemented yet. The next
                logical milestone is wiring NextAuth or Clerk into the existing
                membership-aware Prisma schema.
              </p>
              <p>
                After that, connect LiteLLM usage ingestion and Slack workspace
                sync so this shell starts serving real operational data.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
