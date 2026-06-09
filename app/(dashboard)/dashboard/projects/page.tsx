import { EntityTable } from "@/components/dashboard/entity-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/db";
import { shellProjects } from "@/lib/shell-data";

export default function ProjectsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Projects"
        title="Project costing"
        description="Projects inherit both client and agency context so cost can be analyzed against scoped delivery work."
      />

      <Card className="surface-panel border-0">
        <CardContent className="pt-6">
          <EntityTable
            rows={shellProjects}
            getRowKey={(row) => row.id}
            columns={[
              {
                id: "name",
                header: "Project",
                cell: (row) => <span className="font-medium">{row.name}</span>,
              },
              {
                id: "client",
                header: "Client",
                cell: (row) => row.client,
              },
              {
                id: "workflows",
                header: "Workflows",
                cell: (row) => row.workflowCount,
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
