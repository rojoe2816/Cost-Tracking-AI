import { Layers3, MessagesSquare, ReceiptText, Users } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { UsageTable } from "@/components/dashboard/usage-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdCompact, sumUsd } from "@/lib/db";
import { shellChannels, shellUsageRecords, shellUsers, shellWorkflows } from "@/lib/shell-data";

export default function DashboardOverviewPage() {
  const totalSpend = sumUsd(shellUsageRecords.map((record) => record.totalCost));
  const totalRequests = shellUsageRecords.length;
  const totalUsers = shellUsers.length;
  const totalWorkflows = shellWorkflows.length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="Agency-wide AI cost operations"
        description="The dashboard shell is laid out for multi-dimensional usage attribution once live ingestion is connected."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tracked spend"
          value={formatUsdCompact(totalSpend)}
          description="Across the latest shell events"
          icon={ReceiptText}
        />
        <StatCard
          title="Usage events"
          value={Intl.NumberFormat("en-US").format(totalRequests)}
          description="Ready to roll up by agency, client, project, or channel"
          icon={MessagesSquare}
        />
        <StatCard
          title="Active workflows"
          value={Intl.NumberFormat("en-US").format(totalWorkflows)}
          description="Mapped to project and provider metadata"
          icon={Layers3}
        />
        <StatCard
          title="Tracked people"
          value={Intl.NumberFormat("en-US").format(totalUsers)}
          description="Prepared for membership-aware access control"
          icon={Users}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="surface-panel border-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-heading text-2xl">Recent usage</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Example events showing how attribution flows across the schema.
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full">
              Shell data
            </Badge>
          </CardHeader>
          <CardContent>
            <UsageTable rows={shellUsageRecords} />
          </CardContent>
        </Card>

        <Card className="surface-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              Capture readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">Slack-linked channels</p>
              <p className="mt-2 text-muted-foreground">
                {shellChannels.length} channels are modeled for origin-level cost
                attribution and client communication analysis.
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">Provider abstraction</p>
              <p className="mt-2 text-muted-foreground">
                LiteLLM credentials and model metadata are isolated in dedicated
                integration modules for future ingestion jobs.
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">Security baseline</p>
              <p className="mt-2 text-muted-foreground">
                Middleware applies secure defaults now, before auth and external
                webhooks are added.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
