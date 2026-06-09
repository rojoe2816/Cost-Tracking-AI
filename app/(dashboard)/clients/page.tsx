import { EntityTable } from "@/components/dashboard/entity-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { demoAgency, formatEnumLabel } from "@/lib/demo-agency";

export default function ClientsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clients"
        title="Client accounts"
        description="The seeded Demo Agency data keeps client and project relationships visible while live cost ingestion is still pending."
      />

      <Card className="surface-panel border-0">
        <CardContent className="pt-6">
          <EntityTable
            rows={demoAgency.clients}
            getRowKey={(row) => row.id}
            columns={[
              {
                id: "client",
                header: "Client",
                cell: (row) => (
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.externalAccountingId ?? "Accounting system not linked yet"}
                    </p>
                  </div>
                ),
              },
              {
                id: "projects",
                header: "Projects",
                cell: (row) => (
                  <div className="flex flex-wrap gap-2">
                    {row.projects.map((project) => (
                      <Badge key={project.id} variant="secondary" className="rounded-full">
                        {project.name}
                      </Badge>
                    ))}
                  </div>
                ),
              },
              {
                id: "projectCount",
                header: "Project count",
                className: "text-right",
                cell: (row) => row.projects.length,
              },
              {
                id: "status",
                header: "Status",
                className: "text-right",
                cell: (row) => (
                  <Badge variant="secondary" className="rounded-full">
                    {formatEnumLabel(row.status)}
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
