import { EntityTable } from "@/components/dashboard/entity-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { shellChannels } from "@/lib/shell-data";

export default function ChannelsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Slack channels"
        title="Channel attribution"
        description="Slack channels can be mapped to workflows or projects to make internal AI support activity cost-visible."
      />

      <Card className="surface-panel border-0">
        <CardContent className="pt-6">
          <EntityTable
            rows={shellChannels}
            getRowKey={(row) => row.id}
            columns={[
              {
                id: "name",
                header: "Channel",
                cell: (row) => <span className="font-medium">{row.name}</span>,
              },
              {
                id: "workspace",
                header: "Workspace",
                cell: (row) => row.workspace,
              },
              {
                id: "project",
                header: "Project",
                cell: (row) => row.project,
              },
              {
                id: "workflow",
                header: "Workflow",
                cell: (row) => row.workflow,
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
