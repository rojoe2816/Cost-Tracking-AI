import { EntityTable } from "@/components/dashboard/entity-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardSession } from "@/lib/auth/session";
import { formatEnumLabel } from "@/lib/demo-agency";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await requireDashboardSession();
  const [projects, workflowTypes] = await Promise.all([
    db.project.findMany({
      where: { organizationId: session.organizationId },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        client: { select: { name: true } },
      },
    }),
    db.workflowType.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows = projects.map((project) => ({
    id: project.id,
    name: project.name,
    clientName: project.client.name,
    status: project.status,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Projects"
        title="Project attribution"
        description="Organization-scoped delivery projects and workflows available for AI cost attribution."
      />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="surface-panel border-0">
          <CardContent className="pt-6">
            <EntityTable
              rows={rows}
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
                  cell: () => "Ready for request mapping",
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
            {workflowTypes.map((workflowType) => (
              <div
                key={workflowType.id}
                className="rounded-2xl bg-secondary/70 px-4 py-3 text-sm"
              >
                <p className="font-medium text-foreground">{workflowType.name}</p>
                <p className="mt-1 text-muted-foreground">
                  Available to source applications through the context API.
                </p>
              </div>
            ))}
            {workflowTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workflows configured.</p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
