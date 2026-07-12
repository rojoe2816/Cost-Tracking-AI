"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Plus, RefreshCw, ShieldOff } from "lucide-react";

import {
  createSourceAppAction,
  revokeCredentialAction,
  rotateCredentialAction,
  setSourceAppActiveAction,
  type SourceAppActionResult,
} from "@/app/(dashboard)/settings/source-apps/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  SOURCE_APP_SCOPES,
  type SourceAppScope,
} from "@/lib/internal-ai/sourceAppScopes";

export type SourceAppManagerRow = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  credentials: Array<{
    id: string;
    name: string;
    keyPrefix: string;
    keyLast4: string;
    isActive: boolean;
    lastUsedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    scopes: SourceAppScope[];
  }>;
  usage: {
    requests: number;
    totalTokens: number;
    spendUsd: number;
    latestUsageAt: string | null;
  };
};

function dateLabel(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function KeyReveal(props: { rawKey: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(props.rawKey);
    setCopied(true);
  }

  return (
    <div className="rounded-3xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-medium">Copy this key now</p>
          <p className="mt-1 text-sm text-amber-800">
            Slate stores only a hash. This raw credential will not be shown again.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={props.onDismiss}>
          Dismiss
        </Button>
      </div>
      <code className="mt-4 block overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm text-white">
        {props.rawKey}
      </code>
      <Button type="button" className="mt-3 gap-2" onClick={copy}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy key"}
      </Button>
    </div>
  );
}

export function SourceAppManager({ apps }: { apps: SourceAppManagerRow[] }) {
  const [pending, startTransition] = useTransition();
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleResult(result: SourceAppActionResult) {
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage(null);
    if (result.rawKey) setRawKey(result.rawKey);
  }

  function createApp(formData: FormData) {
    startTransition(async () => {
      handleResult(
        await createSourceAppAction({
          name: String(formData.get("name") ?? ""),
          type: String(formData.get("type") ?? ""),
          description: String(formData.get("description") ?? ""),
          credentialName: String(formData.get("credentialName") ?? ""),
          scopes: formData.getAll("scopes").map(String),
        }),
      );
    });
  }

  return (
    <div className="space-y-6">
      {rawKey ? <KeyReveal rawKey={rawKey} onDismiss={() => setRawKey(null)} /> : null}
      {message ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {message}
        </div>
      ) : null}

      <Card className="surface-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Create source application</CardTitle>
          <p className="text-sm text-muted-foreground">
            The first API key is generated with the app and shown exactly once.
          </p>
        </CardHeader>
        <CardContent>
          <form action={createApp} className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Application name</span>
              <Input name="name" placeholder="Customer success copilot" required />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Application type</span>
              <Input name="type" placeholder="internal_ai_workspace" required />
            </label>
            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="font-medium">Description</span>
              <Input name="description" placeholder="Employee-facing AI workspace" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Credential name</span>
              <Input name="credentialName" defaultValue="Production server" required />
            </label>
            <fieldset className="grid gap-2 text-sm md:col-span-2">
              <legend className="font-medium">API scopes</legend>
              <div className="flex flex-wrap gap-3">
                {SOURCE_APP_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 rounded-full border border-border/70 bg-white/70 px-3 py-2 font-mono text-xs">
                    <input type="checkbox" name="scopes" value={scope} defaultChecked />
                    {scope}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex items-end">
              <Button type="submit" disabled={pending} className="gap-2">
                <Plus className="h-4 w-4" />
                {pending ? "Creating…" : "Create app and key"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {apps.map((app) => (
        <Card key={app.id} className="surface-panel border-0">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="font-heading text-2xl">{app.name}</CardTitle>
                <Badge variant={app.isActive ? "secondary" : "outline"}>
                  {app.isActive ? "Active" : "Disabled"}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {app.description ?? "No description"} · {app.type}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending || !app.isActive}
                className="gap-2"
                onClick={() =>
                  startTransition(async () =>
                    handleResult(
                      await rotateCredentialAction({
                        sourceAppId: app.id,
                        name: `Rotated ${new Date().toLocaleDateString()}`,
                        scopes:
                          app.credentials.find(
                            (credential) =>
                              credential.isActive && !credential.revokedAt,
                          )?.scopes ?? [...SOURCE_APP_SCOPES],
                      }),
                    ),
                  )
                }
              >
                <RefreshCw className="h-4 w-4" />
                Rotate key
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  startTransition(async () =>
                    handleResult(
                      await setSourceAppActiveAction({
                        sourceAppId: app.id,
                        isActive: !app.isActive,
                      }),
                    ),
                  )
                }
              >
                {app.isActive ? "Disable app" : "Enable app"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-secondary/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Requests</p>
                <p className="mt-2 font-heading text-3xl">{app.usage.requests.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl bg-secondary/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tokens</p>
                <p className="mt-2 font-heading text-3xl">{app.usage.totalTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl bg-secondary/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">AI spend</p>
                <p className="mt-2 font-heading text-3xl">${app.usage.spendUsd.toFixed(4)}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/70">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-secondary/60 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <tr><th className="p-3">Credential</th><th className="p-3">Fingerprint</th><th className="p-3">Scopes</th><th className="p-3">Last used</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr>
                </thead>
                <tbody>
                  {app.credentials.map((credential) => (
                    <tr key={credential.id} className="border-t border-border/70">
                      <td className="p-3"><span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" />{credential.name}</span></td>
                      <td className="p-3 font-mono text-xs">{credential.keyPrefix}…{credential.keyLast4}</td>
                      <td className="p-3"><div className="flex max-w-[260px] flex-wrap gap-1">{credential.scopes.map((scope) => <Badge key={scope} variant="outline" className="font-mono text-[10px]">{scope}</Badge>)}</div></td>
                      <td className="p-3 text-muted-foreground">{dateLabel(credential.lastUsedAt)}</td>
                      <td className="p-3">{credential.revokedAt ? "Revoked" : credential.isActive ? "Active" : "Inactive"}</td>
                      <td className="p-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending || Boolean(credential.revokedAt)}
                          className="gap-2"
                          onClick={() =>
                            startTransition(async () =>
                              handleResult(await revokeCredentialAction(credential.id)),
                            )
                          }
                        >
                          <ShieldOff className="h-4 w-4" /> Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {app.credentials.length === 0 ? (
                    <tr><td className="p-5 text-muted-foreground" colSpan={6}>No credentials yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
