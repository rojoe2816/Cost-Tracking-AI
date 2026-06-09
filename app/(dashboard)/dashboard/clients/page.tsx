import { EntityTable } from "@/components/dashboard/entity-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/db";
import { shellClients } from "@/lib/shell-data";

export default function ClientsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clients"
        title="Client rollups"
        description="Client-level reporting is modeled to connect delivery work with the underlying AI cost base."
      />

      <Card className="surface-panel border-0">
        <CardContent className="pt-6">
          <EntityTable
            rows={shellClients}
            getRowKey={(row) => row.id}
            columns={[
              {
                id: "name",
                header: "Client",
                cell: (row) => <span className="font-medium">{row.name}</span>,
              },
              {
                id: "projects",
                header: "Projects",
                cell: (row) => row.projectCount,
              },
              {
                id: "monthlySpend",
                header: "Monthly spend",
                className: "text-right",
                cell: (row) => formatUsd(row.monthlySpend),
              },
              {
                id: "owner",
                header: "Owner",
                cell: (row) => row.owner,
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
