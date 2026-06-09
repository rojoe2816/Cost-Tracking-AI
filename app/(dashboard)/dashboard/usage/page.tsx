import { PageHeader } from "@/components/dashboard/page-header";
import { UsageTable } from "@/components/dashboard/usage-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd, sumUsd } from "@/lib/db";
import { shellUsageRecords } from "@/lib/shell-data";

export default function UsagePage() {
  const totalSpend = sumUsd(shellUsageRecords.map((record) => record.totalCost));
  const totalTokens = shellUsageRecords.reduce(
    (sum, record) => sum + record.promptTokens + record.completionTokens,
    0,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Usage"
        title="Event-level AI usage ledger"
        description="This page is ready for a real query layer against Prisma usage events once ingestion is connected."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="surface-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Spend snapshot</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {formatUsd(totalSpend)}
          </CardContent>
        </Card>
        <Card className="surface-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Token snapshot</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {Intl.NumberFormat("en-US").format(totalTokens)}
          </CardContent>
        </Card>
      </div>

      <Card className="surface-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Usage records</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageTable rows={shellUsageRecords} />
        </CardContent>
      </Card>
    </div>
  );
}
