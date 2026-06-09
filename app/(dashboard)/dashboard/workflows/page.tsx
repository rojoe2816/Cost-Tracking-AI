import { EntityTable } from "@/components/dashboard/entity-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/db";
import { shellWorkflows } from "@/lib/shell-data";

export default function WorkflowsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workflows"
        title="Workflow performance"
        description="Workflow records are scoped for provider, model, channel, and project-level cost attribution."
      />

      <Card className="surface-panel border-0">
        <CardContent className="pt-6">
          <EntityTable
            rows={shellWorkflows}
            getRowKey={(row) => row.id}
            columns={[
              {
                id: "name",
                header: "Workflow",
                cell: (row) => <span className="font-medium">{row.name}</span>,
              },
              {
                id: "project",
                header: "Project",
                cell: (row) => row.project,
              },
              {
                id: "provider",
                header: "Provider",
                cell: (row) => row.provider,
              },
              {
                id: "monthlySpend",
                header: "Monthly spend",
                className: "text-right",
                cell: (row) => formatUsd(row.monthlySpend),
              },
              {
                id: "status",
                header: "Status",
                className: "text-right",
                cell: (row) => (
                  <Badge variant="secondary" className="rounded-full">
                    {row.status}
                  </Badge>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
