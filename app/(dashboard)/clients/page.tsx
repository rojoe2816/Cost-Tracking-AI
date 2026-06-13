import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, Save, Trash2 } from "lucide-react";

import {
  clearClientRevenueAction,
  upsertClientRevenueAction,
} from "@/app/(dashboard)/clients/actions";
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
  getClientRevenueHistoryRows,
  getClientProfitabilityRows,
  getRevenueMonthForDateRange,
  getUsageDateRangeForRevenueMonth,
  type ClientProfitabilityRow,
  type ClientRevenueHistoryRow,
  type ProfitabilityStatus,
} from "@/lib/analytics/profitability";
import { getDefaultUsageDateRange } from "@/lib/analytics/usage";
import {
  type ClientRevenueErrorCode,
  isRevenueMonth,
} from "@/lib/clients/revenue";
import { formatSmallUsd, formatUsd } from "@/lib/db/costs";
import { getDemoOrganization } from "@/lib/slack/mappings";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const noticeMessages = {
  "revenue-created": "Revenue created.",
  "revenue-updated": "Revenue updated.",
  "revenue-cleared": "Revenue cleared for this month.",
} as const;

const errorMessages: Record<ClientRevenueErrorCode, string> = {
  "organization-not-found": "Demo Agency organization was not found.",
  "client-not-found": "Client was not found in this organization.",
  "invalid-month": "Choose a valid month in YYYY-MM format.",
  "invalid-revenue": "Revenue must be a valid dollar amount.",
  "invalid-labor": "Estimated labor cost must be a valid dollar amount.",
  "negative-revenue": "Revenue cannot be negative.",
  "negative-labor": "Estimated labor cost cannot be negative.",
  "revenue-required": "Revenue is required.",
  "revenue-not-found": "No revenue row exists for that client and month.",
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

function formatInputUsd(value: number | null): string {
  return value == null ? "" : value.toFixed(2);
}

function formatMonthLabel(monthDateRange: { from: Date }): string {
  return format(monthDateRange.from, "MMMM yyyy");
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

function MonthSelector({
  selectedMonth,
  selectedMonthLabel,
}: {
  selectedMonth: string;
  selectedMonthLabel: string;
}) {
  return (
    <Card className="surface-panel border-0">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="font-heading text-2xl">Viewing month</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Revenue, labor, and AI usage are shown for {selectedMonthLabel}.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          <CalendarDays className="h-4 w-4" />
          {selectedMonth}
        </div>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
          <label className="grid gap-2 text-sm" htmlFor="month">
            <span className="font-medium text-foreground">Switch month</span>
            <Input
              id="month"
              name="month"
              type="month"
              defaultValue={selectedMonth}
              required
            />
          </label>
          <Button type="submit" variant="secondary">
            View month
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RevenueEditor({
  rows,
  selectedMonth,
}: {
  rows: ClientProfitabilityRow[];
  selectedMonth: string;
}) {
  if (rows.length === 0) {
    return (
      <Card className="surface-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            Monthly revenue editor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add clients before entering monthly revenue.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-panel border-0">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">
          Monthly revenue editor
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Existing revenue and labor values are prefilled for {selectedMonth}.
          Saving updates the current row or creates one for a new month.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Estimated Labor Cost</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const formId = `revenue-form-${row.clientId}`;
              const clearFormId = `clear-revenue-form-${row.clientId}`;
              const hasRevenueRow = row.revenueUsd != null;

              return (
                <TableRow key={row.clientId} id={`client-${row.clientId}`}>
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
                  <TableCell>
                    <Input
                      form={formId}
                      id={`revenue-${row.clientId}`}
                      name="revenueUsd"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={formatInputUsd(row.revenueUsd)}
                      placeholder="4000.00"
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      form={formId}
                      id={`labor-${row.clientId}`}
                      name="estimatedLaborCostUsd"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={
                        hasRevenueRow ? formatInputUsd(row.estimatedLaborCostUsd) : ""
                      }
                      placeholder="1200.00"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <form id={formId} action={upsertClientRevenueAction}>
                        <input type="hidden" name="clientId" value={row.clientId} />
                        <input type="hidden" name="month" value={selectedMonth} />
                        <Button type="submit" size="sm" className="gap-2">
                          <Save className="h-4 w-4" />
                          Save
                        </Button>
                      </form>

                      {hasRevenueRow ? (
                        <form id={clearFormId} action={clearClientRevenueAction}>
                          <input type="hidden" name="clientId" value={row.clientId} />
                          <input type="hidden" name="month" value={selectedMonth} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Clear revenue for this month
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ProfitabilityTable({
  rows,
  selectedMonthLabel,
}: {
  rows: ClientProfitabilityRow[];
  selectedMonthLabel: string;
}) {
  return (
    <Card className="surface-panel border-0">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">
          Client profitability
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          AI spend comes from app-owned AiUsageEvent records for {selectedMonthLabel}.
          Prompt and response text are not stored or displayed.
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
  );
}

function RevenueHistory({
  rows,
}: {
  rows: ClientRevenueHistoryRow[];
}) {
  return (
    <Card className="surface-panel border-0">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">
          Recent revenue history
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Latest 6 client-level revenue rows. Use View month to edit that
          month/client in the editor above.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No revenue history yet. Save monthly revenue to start the ledger.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Estimated Labor Cost</TableHead>
                <TableHead>Updated At</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.clientName}</TableCell>
                  <TableCell>{row.month}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatUsd(row.revenueUsd)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNullableUsd(row.estimatedLaborCostUsd)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(row.updatedAt, "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/clients?month=${row.month}#client-${row.clientId}`}>
                        View month
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function getSelectedMonth(params: { month?: string }, defaultMonth: string) {
  return isRevenueMonth(params.month) ? params.month : defaultMonth;
}

function isClientRevenueErrorCode(value: unknown): value is ClientRevenueErrorCode {
  return typeof value === "string" && value in errorMessages;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    notice?: keyof typeof noticeMessages;
    error?: ClientRevenueErrorCode;
  }>;
}) {
  const organization = await getDemoOrganization();
  const params = await searchParams;
  const defaultMonth = getRevenueMonthForDateRange(getDefaultUsageDateRange());
  const selectedMonth = getSelectedMonth(params, defaultMonth);
  const selectedDateRange = getUsageDateRangeForRevenueMonth(selectedMonth);
  const selectedMonthLabel = formatMonthLabel(selectedDateRange);
  const monthQueryError =
    params.month && !isRevenueMonth(params.month) ? "invalid-month" : null;
  const errorCode = isClientRevenueErrorCode(params.error)
    ? params.error
    : monthQueryError;

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

  const [rows, revenueHistoryRows] = await Promise.all([
    getClientProfitabilityRows(organization.id, selectedDateRange),
    getClientRevenueHistoryRows(organization.id, 6),
  ]);

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

      {errorCode ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessages[errorCode]}
        </div>
      ) : null}

      <MonthSelector
        selectedMonth={selectedMonth}
        selectedMonthLabel={selectedMonthLabel}
      />
      <RevenueEditor rows={rows} selectedMonth={selectedMonth} />
      <ProfitabilityTable rows={rows} selectedMonthLabel={selectedMonthLabel} />
      <RevenueHistory rows={revenueHistoryRows} />
    </div>
  );
}
