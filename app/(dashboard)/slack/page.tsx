import { Cable, Hash, Link2Off } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SlackPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Slack"
        title="Slack channel attribution"
        description="Slack routing is modeled in the schema, but workspace installation and channel sync are intentionally deferred until the next integration milestone."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Connected workspaces"
          value="--"
          description="Placeholder until Slack OAuth and workspace install are enabled."
          icon={Cable}
        />
        <StatCard
          title="Mapped channels"
          value="--"
          description="Placeholder until channel mappings are synced into the app."
          icon={Hash}
        />
        <StatCard
          title="Unmapped channels"
          value="--"
          description="Placeholder until live Slack metadata reaches the mapping layer."
          icon={Link2Off}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="surface-panel border-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-heading text-2xl">
                What the Slack layer will do
              </CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                The schema is already ready for workspace and channel attribution.
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full">
              Deferred integration
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">Workspace identity</p>
              <p className="mt-2 text-muted-foreground">
                Store Slack team metadata once an agency installs the app.
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">Channel mapping</p>
              <p className="mt-2 text-muted-foreground">
                Map channels to a client, project, or default workflow type for
                downstream attribution.
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">Audit stitching</p>
              <p className="mt-2 text-muted-foreground">
                Attach Slack team, channel, message, and thread identifiers to app
                audit records without storing prompt text by default.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              Current state
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">No workspaces installed yet</p>
              <p className="mt-2 text-muted-foreground">
                This shell does not implement Slack OAuth or workspace linking yet.
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">No spend queries yet</p>
              <p className="mt-2 text-muted-foreground">
                Channel risk and unmapped counts stay as placeholders until request
                flow and spend data are live.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
