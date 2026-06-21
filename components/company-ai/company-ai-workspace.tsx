"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InternalAiContextOptions } from "@/lib/internal-ai/context";
import {
  COMPANY_AI_EXAMPLE_PROMPTS,
  COMPANY_AI_TASK_TYPES,
  type CompanyAiRunSuccessResponse,
  type CompanyAiTaskType,
} from "@/lib/internal-ai/companyAiRunTypes";
import { formatEnumLabel } from "@/lib/demo-agency";

type ReportsPreview = {
  recent: Array<{
    id: string;
    employeeName: string | null;
    sourceAppName: string | null;
    taskType: string | null;
    model: string;
    provider: string;
    totalTokens: number;
    spendUsd: number;
  }>;
};

interface CompanyAiWorkspaceProps {
  organizationName: string;
  context: InternalAiContextOptions;
  gatewayConfigured: boolean;
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { id: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm" htmlFor={id}>
      <span className="font-medium text-foreground">{label}</span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="" disabled>
          Select {label.toLowerCase()}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
}

export function CompanyAiWorkspace({
  organizationName,
  context,
  gatewayConfigured,
}: CompanyAiWorkspaceProps) {
  const defaultEmployeeId = context.employees[0]?.id ?? "";
  const defaultClientId = context.clients[0]?.id ?? "";
  const defaultProjectId =
    context.projects.find((project) => project.clientId === defaultClientId)?.id ??
    context.projects[0]?.id ??
    "";
  const defaultWorkflowId = context.workflowTypes[0]?.id ?? "";
  const defaultModel = context.models[0]?.id ?? "gpt-4o-mini";

  const [employeeId, setEmployeeId] = useState(defaultEmployeeId);
  const [clientId, setClientId] = useState(defaultClientId);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [workflowTypeId, setWorkflowTypeId] = useState(defaultWorkflowId);
  const [taskType, setTaskType] = useState<CompanyAiTaskType>("client_update");
  const [model, setModel] = useState(defaultModel);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompanyAiRunSuccessResponse | null>(null);
  const [reportsPreview, setReportsPreview] = useState<ReportsPreview | null>(null);

  const projectOptions = useMemo(
    () =>
      context.projects
        .filter((project) => project.clientId === clientId)
        .map((project) => ({
          id: project.id,
          label: project.name,
        })),
    [clientId, context.projects],
  );

  const employeeOptions = context.employees.map((employee) => ({
    id: employee.id,
    label: employee.name,
  }));
  const clientOptions = context.clients.map((client) => ({
    id: client.id,
    label: client.name,
  }));
  const workflowOptions = context.workflowTypes.map((workflow) => ({
    id: workflow.id,
    label: workflow.name,
  }));
  const modelOptions = context.models.map((entry) => ({
    id: entry.id,
    label: entry.label,
  }));
  const taskTypeOptions = COMPANY_AI_TASK_TYPES.map((value) => ({
    id: value,
    label: formatEnumLabel(value),
  }));

  async function refreshReportsPreview() {
    const response = await fetch("/api/internal-ai/reports");
    if (!response.ok) {
      return;
    }

    const body = (await response.json()) as ReportsPreview;
    setReportsPreview(body);
  }

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/company-ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          clientId,
          projectId,
          workflowTypeId,
          taskType,
          model,
          input,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? "Company AI request failed.");
        return;
      }

      setResult(body as CompanyAiRunSuccessResponse);
      await refreshReportsPreview();
    } catch {
      setError("Could not reach the company AI run endpoint.");
    } finally {
      setLoading(false);
    }
  }

  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    const nextProject =
      context.projects.find((project) => project.clientId === nextClientId)?.id ??
      "";
    setProjectId(nextProject);
  }

  function applyExamplePrompt(example: (typeof COMPANY_AI_EXAMPLE_PROMPTS)[number]) {
    setTaskType(example.taskType);
    setInput(example.input);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Company AI"
        title={`${organizationName} internal workspace`}
        description="Run attributed AI tasks through the Slate gateway. Prompts and responses are returned to this page only and are not stored in Slate."
      />

      {!gatewayConfigured ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Gateway setup required</p>
          <p className="mt-2">
            Add `MOCK_COMPANY_SOURCE_APP_KEY` to your local `.env` using a dev key
            from `npm run source-app:key:create -- --source-app-name &quot;Mock Company
            AI Portal&quot;`.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="rounded-3xl border-border/70 bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Run an AI task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                id="employee"
                label="Employee"
                value={employeeId}
                onChange={setEmployeeId}
                options={employeeOptions}
              />
              <SelectField
                id="client"
                label="Client"
                value={clientId}
                onChange={handleClientChange}
                options={clientOptions}
              />
              <SelectField
                id="project"
                label="Project"
                value={projectId}
                onChange={setProjectId}
                options={projectOptions}
              />
              <SelectField
                id="workflow"
                label="Workflow"
                value={workflowTypeId}
                onChange={setWorkflowTypeId}
                options={workflowOptions}
              />
              <SelectField
                id="task-type"
                label="Task type"
                value={taskType}
                onChange={(value) => setTaskType(value as CompanyAiTaskType)}
                options={taskTypeOptions}
              />
              <SelectField
                id="model"
                label="Model"
                value={model}
                onChange={setModel}
                options={modelOptions}
              />
            </div>

            <div className="space-y-3">
              <label className="grid gap-2 text-sm" htmlFor="prompt-input">
                <span className="font-medium text-foreground">Prompt</span>
                <textarea
                  id="prompt-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={5}
                  placeholder="Describe the task you want the AI to complete..."
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {COMPANY_AI_EXAMPLE_PROMPTS.map((example) => (
                  <Button
                    key={example.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyExamplePrompt(example)}
                  >
                    {example.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={handleRun}
                disabled={loading || !gatewayConfigured || !input.trim()}
              >
                {loading ? "Running..." : "Run task"}
              </Button>
              <Badge variant="secondary" className="rounded-full">
                Routed through Slate gateway
              </Badge>
            </div>

            {error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl border-border/70 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">AI response</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {result.output}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Run a task to see the model response here.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Usage and cost</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {result ? (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Audit ID</span>
                    <span className="font-mono text-xs">{result.aiRequestAuditId}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Model</span>
                    <span>{result.usage.model}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Provider</span>
                    <span>{result.usage.provider}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Tokens</span>
                    <span>
                      {result.usage.promptTokens} in / {result.usage.completionTokens}{" "}
                      out ({result.usage.totalTokens} total)
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Cost</span>
                    <span>{formatUsd(result.usage.spendUsd)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">LiteLLM request</span>
                    <span className="font-mono text-xs">
                      {result.usage.externalLiteLlmRequestId ?? "pending"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Latency</span>
                    <span>{result.usage.latencyMs} ms</span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Usage metadata appears after a successful gateway run.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 bg-white/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-xl">Latest tracked usage</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refreshReportsPreview()}
              >
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportsPreview?.recent?.length ? (
                reportsPreview.recent.slice(0, 5).map((row) => (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-border/70 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.employeeName ?? "Unknown"}</span>
                      <Badge variant="secondary">{row.taskType ?? "task"}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {row.sourceAppName ?? "Source app"} · {row.model} ·{" "}
                      {row.totalTokens} tokens · {formatUsd(row.spendUsd)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Recent internal AI usage from `/api/internal-ai/reports` will appear
                  here after your first tracked run.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
