import { CheckCircle2, LockKeyhole, PlugZap, Power } from "lucide-react";

import {
  saveModelConnectionAction,
  setModelConnectionActiveAction,
  validateModelConnectionAction,
} from "@/app/(dashboard)/settings/model-providers/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireAdminSession } from "@/lib/auth/session";
import { listModelConnections } from "@/lib/model-providers/admin";

export const dynamic = "force-dynamic";

function dateLabel(value: Date | null): string {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "Not validated";
}

export default async function ModelProvidersPage(props: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const session = await requireAdminSession();

  const [connections, searchParams] = await Promise.all([
    listModelConnections(session.organizationId),
    props.searchParams,
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings / Models"
        title="Model access"
        description="Constrain each organization to approved model aliases and keep optional provider credentials encrypted at rest. Slate routes requests through the configured LiteLLM boundary."
      />

      {searchParams.notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {searchParams.notice}
        </div>
      ) : null}

      <Card className="surface-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Add connection</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveModelConnectionAction} className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm"><span className="font-medium">Name</span><Input name="name" placeholder="Production LiteLLM" required /></label>
            <label className="grid gap-2 text-sm"><span className="font-medium">Provider type</span><Input name="providerType" defaultValue="litellm" required /></label>
            <label className="grid gap-2 text-sm"><span className="font-medium">Endpoint URL</span><Input name="endpointUrl" type="url" placeholder="https://litellm.company.example" /></label>
            <label className="grid gap-2 text-sm"><span className="font-medium">Provider credential (optional)</span><Input name="credential" type="password" autoComplete="new-password" placeholder="Encrypted on save" /></label>
            <label className="grid gap-2 text-sm md:col-span-2"><span className="font-medium">Allowed models</span><Input name="allowedModels" defaultValue="gpt-4o-mini" placeholder="gpt-4o-mini, company-model-v2" required /></label>
            <div className="md:col-span-2"><Button type="submit" className="gap-2"><PlugZap className="h-4 w-4" />Save connection</Button></div>
          </form>
        </CardContent>
      </Card>

      {connections.map((connection) => (
        <Card key={connection.id} className="surface-panel border-0">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="font-heading text-2xl">{connection.name}</CardTitle>
                <Badge variant={connection.isActive ? "secondary" : "outline"}>{connection.isActive ? "Active" : "Disabled"}</Badge>
                {connection.hasCredential ? <Badge variant="outline" className="gap-1"><LockKeyhole className="h-3 w-3" />Encrypted credential</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{connection.providerType} · {connection.endpointUrl ?? "No endpoint"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={validateModelConnectionAction}>
                <input type="hidden" name="connectionId" value={connection.id} />
                <Button type="submit" variant="outline" className="gap-2"><CheckCircle2 className="h-4 w-4" />Test endpoint</Button>
              </form>
              <form action={setModelConnectionActiveAction}>
                <input type="hidden" name="connectionId" value={connection.id} />
                <input type="hidden" name="isActive" value={String(!connection.isActive)} />
                <Button type="submit" variant="secondary" className="gap-2"><Power className="h-4 w-4" />{connection.isActive ? "Disable" : "Enable"}</Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {connection.allowedModels.map((model) => <Badge key={model} variant="secondary">{model}</Badge>)}
            </div>
            <p className="text-xs text-muted-foreground">Last endpoint validation: {dateLabel(connection.lastValidatedAt)}</p>
            <form action={saveModelConnectionAction} className="grid gap-3 rounded-2xl bg-secondary/60 p-4 md:grid-cols-2">
              <input type="hidden" name="connectionId" value={connection.id} />
              <Input name="name" defaultValue={connection.name} required />
              <Input name="providerType" defaultValue={connection.providerType} required />
              <Input name="endpointUrl" type="url" defaultValue={connection.endpointUrl ?? ""} placeholder="Endpoint URL" />
              <Input name="credential" type="password" autoComplete="new-password" placeholder={connection.hasCredential ? "Leave blank to retain encrypted credential" : "Optional credential"} />
              <Input name="allowedModels" defaultValue={connection.allowedModels.join(", ")} className="md:col-span-2" required />
              <div className="md:col-span-2"><Button type="submit" size="sm">Update policy</Button></div>
            </form>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
