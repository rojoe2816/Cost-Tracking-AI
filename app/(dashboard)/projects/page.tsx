import { EntityTable } from "@/components/dashboard/entity-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  demoAgency,
  demoAgencyProjects,
  formatEnumLabel,
} from "@/lib/demo-agency";

export default function ProjectsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Projects"
        title="Project shell"
        description="Projects are seeded under Demo Agency clients so future request attribution can attach to real delivery work, not just raw provider usage."
      />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="surface-panel border-0">
          <CardContent className="pt-6">
            <EntityTable
              rows={demoAgencyProjects}
              getRowKey={(row) => row.id}
              columns={[
                {
                  id: "project",
                  header: "Project",
                  cell: (row) => <span className="font-medium">{row.name}</span>,
                },
                {
                  id: "client",
                  header: "Client",
                  cell: (row) => row.clientName,
                },
                {
                  id: "readiness",
                  header: "Attribution readiness",
                  cell: () => "Ready for workflow mapping",
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

        <Card className="surface-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              Shared workflow library
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {demoAgency.workflowTypes.map((workflowType) => (
              <div
                key={workflowType}
                className="rounded-2xl bg-secondary/70 px-4 py-3 text-sm"
              >
                <p className="font-medium text-foreground">{workflowType}</p>
                <p className="mt-1 text-muted-foreground">
                  Available to map onto projects once live request attribution is
                  implemented.
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
