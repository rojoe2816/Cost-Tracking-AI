import { EntityTable } from "@/components/dashboard/entity-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { shellUsers } from "@/lib/shell-data";

export default function PeoplePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="People"
        title="User attribution"
        description="Usage records can be tied back to people and agency memberships once authentication is introduced."
      />

      <Card className="surface-panel border-0">
        <CardContent className="pt-6">
          <EntityTable
            rows={shellUsers}
            getRowKey={(row) => row.id}
            columns={[
              {
                id: "name",
                header: "User",
                cell: (row) => <span className="font-medium">{row.name}</span>,
              },
              {
                id: "role",
                header: "Agency role",
                cell: (row) => row.role,
              },
              {
                id: "primaryClient",
                header: "Primary client",
                cell: (row) => row.primaryClient,
              },
              {
                id: "channel",
                header: "Primary channel",
                cell: (row) => row.primaryChannel,
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
