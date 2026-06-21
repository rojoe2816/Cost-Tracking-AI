import { format } from "date-fns";
import {
  Coins,
  Hash,
  MessagesSquare,
  ReceiptText,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDashboardUsageSummary,
  getDefaultUsageDateRange,
  getRecentAiRequests,
  getSpendByClient,
  getSpendBySource,
  getSpendByWorkflow,
  truncateLiteLlmRequestId,
} from "@/lib/analytics/usage";
import { formatEnumLabel } from "@/lib/demo-agency";
import { formatSmallUsd } from "@/lib/db/costs";
import { getDemoOrganization } from "@/lib/slack/mappings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function formatTokenCount(value: number) {
  return Intl.NumberFormat("en-US").format(value);
}

export default async function DashboardOverviewPage() {
  const organization = await getDemoOrganization();

  if (!organization) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Dashboard"
          title="AI usage overview"
          description="Track attributed AI spend from completed usage events."
        />
        <div className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
          Demo Agency organization not found. Run `npm run db:seed` to create local
          development data.
        </div>
      </div>
    );
  }

  const dateRange = getDefaultUsageDateRange();
  const [summary, spendByClient, spendByWorkflow, spendBySource, recentRequests] =
    await Promise.all([
      getDashboardUsageSummary(organization.id, dateRange),
      getSpendByClient(organization.id, dateRange),
      getSpendByWorkflow(organization.id, dateRange),
      getSpendBySource(organization.id, dateRange),
      getRecentAiRequests(organization.id, 10),
    ]);

  if (summary.requests === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Dashboard"
          title={`${organization.name} AI usage`}
          description="Spend and request rollups from attributed AI usage events for the current month."
        />
        <div className="rounded-2xl bg-secondary/70 p-6 text-sm text-muted-foreground">
          No AI usage tracked yet. Send a request through the internal AI gateway
          or a configured legacy connector to populate this dashboard.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title={`${organization.name} AI usage`}
        description={`Attributed AI spend and request rollups for ${format(dateRange.from, "MMMM yyyy")}, sourced from AiUsageEvent.`}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total AI spend this month"
          value={formatSmallUsd(summary.totalSpendUsd)}
          description="Sum of completed usage event costs."
          icon={ReceiptText}
        />
        <StatCard
          title="Requests this month"
          value={formatTokenCount(summary.requests)}
          description="Completed AI usage events in range."
          icon={MessagesSquare}
        />
        <StatCard
          title="Average cost per request"
          value={formatSmallUsd(summary.avgCostPerRequest)}
          description="Total spend divided by request count."
          icon={Coins}
        />
        <StatCard
          title="Unattributed spend"
          value={formatSmallUsd(summary.unattributedSpendUsd)}
          description="Usage missing client, project, or workflow attribution."
          icon={TriangleAlert}
        />
        <StatCard
          title="Total tokens"
          value={formatTokenCount(summary.totalTokens)}
          description={`${formatTokenCount(summary.promptTokens)} prompt / ${formatTokenCount(summary.completionTokens)} completion`}
          icon={Sparkles}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="surface-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Spend by client</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[420px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spendByClient.map((row) => (
                  <TableRow key={row.clientId ?? "unattributed"}>
                    <TableCell className="max-w-[220px] truncate">
                      {row.clientName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {row.requests}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                      {formatSmallUsd(row.spendUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="surface-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Spend by workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[420px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spendByWorkflow.map((row) => (
                  <TableRow key={row.workflowTypeId ?? "unattributed"}>
                    <TableCell className="max-w-[220px] truncate">
                      {row.workflowName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {row.requests}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                      {formatSmallUsd(row.spendUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="surface-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Spend by source</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[420px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spendBySource.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell className="max-w-[220px] truncate">
                      {formatEnumLabel(row.source)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {row.requests}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                      {formatSmallUsd(row.spendUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <Card className="surface-panel border-0">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="font-heading text-2xl">Recent AI requests</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Latest completed usage events with attribution metadata only.
            </p>
          </div>
          <Hash className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <Table className="min-w-[1120px]">
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Request ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRequests.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(row.createdAt, "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatEnumLabel(row.source)}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {row.clientName ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {row.projectName ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {row.workflowName ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {row.model}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{row.provider}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {formatTokenCount(row.totalTokens)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                    {formatSmallUsd(row.spendUsd)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {truncateLiteLlmRequestId(row.externalLiteLlmRequestId)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
