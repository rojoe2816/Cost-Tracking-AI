import { ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardSession } from "@/lib/auth/session";
import { formatEnumLabel } from "@/lib/demo-agency";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PrivacySettingsPage() {
  const session = await requireDashboardSession();
  const settings = await db.organizationPrivacySettings.findUnique({
    where: { organizationId: session.organizationId },
    select: { promptStorageMode: true },
  });
  const promptStorageMode = settings?.promptStorageMode ?? "METADATA_ONLY";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Prompt privacy"
        description="Review the prompt-storage policy enforced for this authenticated organization."
      />

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="surface-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              Current prompt storage mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="inline-flex items-center gap-3 rounded-3xl bg-primary/10 px-4 py-3 text-primary">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-medium">{promptStorageMode}</span>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              <span className="font-medium text-foreground">Metadata-only is the default.</span>{" "}
              {session.organizationName} stores request metadata and audit state without storing
              raw prompt or response text by default.
            </p>
          </CardContent>
        </Card>

        <Card className="surface-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              What metadata-only means
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">Stored now</p>
              <p className="mt-2 text-muted-foreground">
                Organization, user, client, project, workflow, Slack context, request
                status, and external LiteLLM identifiers can still be tracked.
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">Not stored by default</p>
              <p className="mt-2 text-muted-foreground">
                Raw prompt text and raw response text remain out of the default
                storage path for this milestone.
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/70 p-4">
              <p className="font-medium text-foreground">Configured mode</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
                <span>The current seeded setting is</span>
                <Badge variant="secondary" className="rounded-full">
                  {formatEnumLabel(promptStorageMode)}
                </Badge>{" "}
                <span>
                  and any policy change remains organization-scoped.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
