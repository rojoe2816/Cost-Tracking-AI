import {
  AlertTriangle,
  Building2,
  Hash,
  Layers3,
  MessagesSquare,
  ReceiptText,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { demoAgency, demoAgencyCounts } from "@/lib/demo-agency";

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title="Demo Agency AI operations"
        description="This shell gives the team a clean starting point for agency-level AI job costing. The high-level KPI cards stay as placeholders until spend sync, request attribution, and Slack channel mapping are wired to live integrations."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total AI spend this month"
          value="$ --"
          description="Placeholder until LiteLLM spend sync is connected."
          icon={ReceiptText}
        />
        <StatCard
          title="Attributed AI requests"
          value="--"
          description="Placeholder until app-level request attribution is live."
          icon={MessagesSquare}
        />
        <StatCard
          title="Unmapped Slack channels"
          value="--"
          description="Placeholder until Slack workspace installation is enabled."
          icon={Hash}
        />
        <StatCard
          title="Clients at pricing risk"
          value="--"
          description="Placeholder until revenue and margin monitoring are connected."
          icon={AlertTriangle}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="surface-panel border-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-heading text-2xl">
                Demo Agency footprint
              </CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Seeded foundation data available in the local shell right now.
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full">
              Seeded data
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-secondary/70 p-5">
              <div className="flex items-center gap-3 text-foreground">
                <Building2 className="h-5 w-5 text-primary" />
                <p className="font-medium">Clients</p>
              </div>
              <p className="mt-4 font-heading text-4xl font-semibold">
                {demoAgencyCounts.clients}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Demo client accounts seeded for local walkthroughs.
              </p>
            </div>

            <div className="rounded-3xl bg-secondary/70 p-5">
              <div className="flex items-center gap-3 text-foreground">
                <Layers3 className="h-5 w-5 text-primary" />
                <p className="font-medium">Projects</p>
              </div>
              <p className="mt-4 font-heading text-4xl font-semibold">
                {demoAgencyCounts.projects}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Projects are already grouped under clients for attribution.
              </p>
            </div>

            <div className="rounded-3xl bg-secondary/70 p-5">
              <div className="flex items-center gap-3 text-foreground">
                <MessagesSquare className="h-5 w-5 text-primary" />
                <p className="font-medium">Workflow types</p>
              </div>
              <p className="mt-4 font-heading text-4xl font-semibold">
                {demoAgencyCounts.workflowTypes}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Workflow labels are ready to map onto real AI requests later.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              Current milestone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">Organization context</p>
              <p className="mt-2 text-muted-foreground">
                The app assumes <span className="font-medium text-foreground">{demoAgency.name}</span> for
                this local shell and keeps auth out of the path for now.
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">Prompt privacy baseline</p>
              <p className="mt-2 text-muted-foreground">
                Prompt storage defaults to <span className="font-medium text-foreground">metadata-only</span>,
                so raw prompt and response text are not stored by default.
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">Next integrations</p>
              <p className="mt-2 text-muted-foreground">
                Live spend rollups, Slack installs, and provider-backed request
                traces will plug into this shell after the current foundation
                milestone.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
