import { Save } from "lucide-react";

import { upsertClientRevenueAction } from "@/app/(dashboard)/clients/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getClientProfitabilityRows,
  getRevenueMonthForDateRange,
  type ClientProfitabilityRow,
  type ProfitabilityStatus,
} from "@/lib/analytics/profitability";
import { getDefaultUsageDateRange } from "@/lib/analytics/usage";
import { formatSmallUsd, formatUsd } from "@/lib/db/costs";
import { getDemoOrganization } from "@/lib/slack/mappings";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const noticeMessages: Record<string, string> = {
  "revenue-updated": "Monthly revenue saved.",
};

const statusStyles: Record<ProfitabilityStatus, string> = {
  Healthy: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  Watch: "bg-amber-50 text-amber-800 hover:bg-amber-50",
  "Pricing Risk": "bg-rose-50 text-rose-700 hover:bg-rose-50",
  "No Revenue Data": "bg-slate-100 text-slate-700 hover:bg-slate-100",
};

function formatNumber(value: number): string {
  return Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number | null): string {
  if (value == null) {
    return "—";
  }

  return Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNullableUsd(value: number | null): string {
  return value == null ? "—" : formatUsd(value);
}

function StatusBadge({ status }: { status: ProfitabilityStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn("rounded-full px-3 py-1", statusStyles[status])}
    >
      {status}
    </Badge>
  );
}

function ClientRevenueForm({
  rows,
  defaultMonth,
}: {
  rows: ClientProfitabilityRow[];
  defaultMonth: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add clients before entering monthly revenue.
      </p>
    );
  }

  return (
    <form
      action={upsertClientRevenueAction}
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_auto]"
    >
      <label className="grid gap-2 text-sm" htmlFor="clientId">
        <span className="font-medium text-foreground">Client</span>
        <select
          id="clientId"
          name="clientId"
          defaultValue={rows[0]?.clientId}
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {rows.map((row) => (
            <option key={row.clientId} value={row.clientId}>
              {row.clientName}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm" htmlFor="month">
        <span className="font-medium text-foreground">Month</span>
        <Input
          id="month"
          name="month"
          type="month"
          defaultValue={defaultMonth}
          required
        />
      </label>

      <label className="grid gap-2 text-sm" htmlFor="revenueUsd">
        <span className="font-medium text-foreground">Revenue</span>
        <Input
          id="revenueUsd"
          name="revenueUsd"
          type="number"
          min="0"
          step="0.01"
          placeholder="4000.00"
          required
        />
      </label>

      <label className="grid gap-2 text-sm" htmlFor="estimatedLaborCostUsd">
        <span className="font-medium text-foreground">Estimated labor</span>
        <Input
          id="estimatedLaborCostUsd"
          name="estimatedLaborCostUsd"
          type="number"
          min="0"
          step="0.01"
          placeholder="1200.00"
        />
      </label>

      <div className="flex items-end">
        <Button type="submit" className="w-full gap-2">
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>
    </form>
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const organization = await getDemoOrganization();
  const params = await searchParams;

  if (!organization) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Clients"
          title="Clients"
          description="Track client revenue, AI spend, and AI-adjusted margin in Slate."
        />
        <div className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
          Demo Agency organization not found. Run `npm run db:seed` to create local
          development data.
        </div>
      </div>
    );
  }

  const dateRange = getDefaultUsageDateRange();
  const revenueMonth = getRevenueMonthForDateRange(dateRange);
  const rows = await getClientProfitabilityRows(organization.id, dateRange);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clients"
        title="Clients"
        description="Track client revenue, AI spend, and AI-adjusted margin in Slate."
      />

      {params.notice && noticeMessages[params.notice] ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {noticeMessages[params.notice]}
        </div>
      ) : null}

      {params.error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {params.error}
        </div>
      ) : null}

      <Card className="surface-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            Monthly revenue input
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter client-level revenue for {revenueMonth}. Labor is optional and
            treated as zero when omitted.
          </p>
        </CardHeader>
        <CardContent>
          <ClientRevenueForm rows={rows} defaultMonth={revenueMonth} />
        </CardContent>
      </Card>

      <Card className="surface-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            Client profitability
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            AI spend comes from app-owned AiUsageEvent records for the current
            month. Prompt and response text are not stored or displayed.
          </p>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No clients yet. Add clients to track AI profitability.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">AI Spend</TableHead>
                  <TableHead className="text-right">AI Cost Ratio</TableHead>
                  <TableHead className="text-right">
                    Estimated Labor Cost
                  </TableHead>
                  <TableHead className="text-right">AI-Adjusted Margin</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.clientId}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{row.clientName}</p>
                        <p className="max-w-[260px] text-xs text-muted-foreground">
                          {row.projectNames.length > 0
                            ? row.projectNames.join(", ")
                            : "No active projects linked"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNullableUsd(row.revenueUsd)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatSmallUsd(row.aiSpendUsd)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(row.aiCostRatio)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUsd(row.estimatedLaborCostUsd)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(row.aiAdjustedMargin)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(row.requestCount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(row.totalTokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
