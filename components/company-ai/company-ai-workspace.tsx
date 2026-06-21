"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ListTodo,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState, MetricPill } from "@/components/company-ai/company-ai-primitives";
import {
  CompanyAiFlowIndicator,
  CompanyAiLoadingSteps,
} from "@/components/company-ai/company-ai-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCompanyAiErrorMessage } from "@/lib/company-ai/errorMessages";
import {
  canSubmitCompanyAiTask,
  getDefaultProjectIdForClient,
  getProjectOptionsForClient,
  lookupContextLabel,
} from "@/lib/company-ai/workspaceHelpers";
import { formatEnumLabel } from "@/lib/demo-agency";
import {
  formatDateTime,
  formatNumber,
  formatTinyUsd,
  truncateMiddle,
} from "@/lib/format/display";
import type { InternalAiContextOptions } from "@/lib/internal-ai/context";
import {
  COMPANY_AI_EXAMPLE_PROMPTS,
  COMPANY_AI_TASK_TYPES,
  type CompanyAiRunSuccessResponse,
  type CompanyAiTaskType,
} from "@/lib/internal-ai/companyAiRunTypes";

type ReportsPreview = {
  recent: Array<{
    id: string;
    createdAt: string;
    employeeName: string | null;
    sourceAppName: string | null;
    taskType: string | null;
    model: string;
    provider: string;
    totalTokens: number;
    spendUsd: number;
    externalLiteLlmRequestId: string | null;
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
  helperText,
  value,
  onChange,
  options,
  disabled = false,
  required = true,
}: {
  id: string;
  label: string;
  helperText?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { id: string; label: string }[];
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm" htmlFor={id}>
      <span className="font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
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
      {helperText ? (
        <span className="text-xs text-muted-foreground">{helperText}</span>
      ) : null}
    </label>
  );
}

export function CompanyAiWorkspace({
  organizationName,
  context,
  gatewayConfigured,
}: CompanyAiWorkspaceProps) {
  const defaultEmployeeId = context.employees[0]?.id ?? "";
  const defaultClientId = context.clients[0]?.id ?? "";
  const defaultProjectId = getDefaultProjectIdForClient(context, defaultClientId);
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
  const [completedAt, setCompletedAt] = useState<Date | null>(null);
  const [reportsPreview, setReportsPreview] = useState<ReportsPreview | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  const projectOptions = useMemo(
    () => getProjectOptionsForClient(context, clientId),
    [clientId, context],
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

  const submitEnabled = canSubmitCompanyAiTask({
    gatewayConfigured,
    loading,
    employeeId,
    clientId,
    projectId,
    workflowTypeId,
    input,
  });

  useEffect(() => {
    void refreshReportsPreview();
  }, []);

  async function refreshReportsPreview() {
    setReportsLoading(true);

    try {
      const response = await fetch("/api/internal-ai/reports");
      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as ReportsPreview;
      setReportsPreview(body);
    } finally {
      setReportsLoading(false);
    }
  }

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCompletedAt(null);

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
        setError(
          getCompanyAiErrorMessage(body.error?.code, body.error?.message),
        );
        return;
      }

      setResult(body as CompanyAiRunSuccessResponse);
      setCompletedAt(new Date());
      await refreshReportsPreview();
    } catch {
      setError("Could not reach the company AI run endpoint.");
    } finally {
      setLoading(false);
    }
  }

  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    setProjectId(getDefaultProjectIdForClient(context, nextClientId));
  }

  function applyExamplePrompt(example: (typeof COMPANY_AI_EXAMPLE_PROMPTS)[number]) {
    setTaskType(example.taskType);
    setInput(example.input);
  }

  function resetForAnotherTask() {
    setResult(null);
    setCompletedAt(null);
    setError(null);
    setInput("");
  }

  const sourceAppName =
    context.sourceApps.find((app) => app.type === "mock_company_portal")?.name ??
    "Mock Company AI Portal";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Company AI"
        title={`${organizationName} internal workspace`}
        description="This simulates an internal company AI tool routed through Slate for cost, token, employee, client, project, workflow, and task attribution."
      />

      <CompanyAiFlowIndicator />

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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <div className="space-y-6">
          <Card className="rounded-3xl border-border/70 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Run an AI task</CardTitle>
              <p className="text-sm text-muted-foreground">
                Required fields are marked with *. Projects filter automatically
                when you change the client.
              </p>
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
                  helperText={
                    projectOptions.length === 0
                      ? "No active projects exist for this client."
                      : "Only projects for the selected client are shown."
                  }
                  disabled={projectOptions.length === 0}
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
                  helperText="Use gpt-4o-mini for the lowest-cost demo runs."
                  value={model}
                  onChange={setModel}
                  options={modelOptions}
                />
              </div>

              <div className="space-y-3">
                <label className="grid gap-2 text-sm" htmlFor="prompt-input">
                  <span className="font-medium text-foreground">
                    Prompt <span className="text-destructive">*</span>
                  </span>
                  <textarea
                    id="prompt-input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    rows={5}
                    placeholder="Describe the task you want the AI to complete..."
                    className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                  <span className="text-xs text-muted-foreground">
                    Prompt text is sent to LiteLLM for this request only and is not
                    stored in Slate.
                  </span>
                </label>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Example prompts
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COMPANY_AI_EXAMPLE_PROMPTS.map((example) => (
                      <Button
                        key={example.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyExamplePrompt(example)}
                        title={example.hint}
                      >
                        {example.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <CompanyAiLoadingSteps active={loading} />

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={handleRun} disabled={!submitEnabled}>
                  {loading ? "Routing through Slate gateway…" : "Run task"}
                </Button>
                {result ? (
                  <Button type="button" variant="outline" onClick={resetForAnotherTask}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Run another task
                  </Button>
                ) : null}
                <Badge variant="secondary" className="rounded-full">
                  Server-side source app auth
                </Badge>
              </div>

              {error ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {result ? (
            <Card className="rounded-3xl border-emerald-200/80 bg-emerald-50/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl text-emerald-950">
                  What Slate tracked
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-emerald-950">
                <p>
                  Slate attributed this run to employee, client, project, workflow,
                  and task type, captured tokens and cost, and recorded an{" "}
                  <code className="rounded bg-white/70 px-1">AiUsageEvent</code>.
                  Prompt and response text were not stored.
                </p>
                <div className="flex flex-wrap gap-2">
                  <MetricPill
                    label="Employee"
                    value={lookupContextLabel(employeeOptions, employeeId)}
                  />
                  <MetricPill
                    label="Client"
                    value={lookupContextLabel(clientOptions, clientId)}
                  />
                  <MetricPill
                    label="Project"
                    value={lookupContextLabel(projectOptions, projectId)}
                  />
                  <MetricPill
                    label="Task"
                    value={formatEnumLabel(result.attribution.taskType)}
                  />
                  <MetricPill label="Source app" value={sourceAppName} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      View dashboard
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/clients">
                      <Building2 className="mr-2 h-4 w-4" />
                      View client profitability
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/jobs">
                      <ListTodo className="mr-2 h-4 w-4" />
                      View jobs
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshReportsPreview()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh tracked usage
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

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
                <EmptyState
                  title="No response yet"
                  description="Run a task to see the model response returned through Slate."
                />
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
                    <span className="text-muted-foreground">Completed</span>
                    <span>{completedAt ? formatDateTime(completedAt) : "—"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Audit ID</span>
                    <span className="font-mono text-xs">
                      {truncateMiddle(result.aiRequestAuditId, 10, 6)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Model</span>
                    <span>
                      {result.usage.model} · {result.usage.provider}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Tokens</span>
                    <span>
                      {formatNumber(result.usage.promptTokens)} in /{" "}
                      {formatNumber(result.usage.completionTokens)} out (
                      {formatNumber(result.usage.totalTokens)} total)
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Cost</span>
                    <span>{formatTinyUsd(result.usage.spendUsd)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">LiteLLM request</span>
                    <span className="font-mono text-xs">
                      {result.usage.externalLiteLlmRequestId ?? "pending"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Latency</span>
                    <span>{formatNumber(result.usage.latencyMs)} ms</span>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="Usage metadata pending"
                  description="Tokens, cost, provider, and request ID appear after a successful gateway run."
                />
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
                disabled={reportsLoading}
                onClick={() => void refreshReportsPreview()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
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
                      <span className="font-medium">
                        {row.employeeName ?? "Unknown employee"}
                      </span>
                      <Badge variant="secondary">
                        {row.taskType ? formatEnumLabel(row.taskType) : "task"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {row.sourceAppName ?? "Source app"} · {row.model} /{" "}
                      {row.provider}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {formatNumber(row.totalTokens)} tokens ·{" "}
                      {formatTinyUsd(row.spendUsd)}
                      {row.createdAt ? ` · ${formatDateTime(row.createdAt)}` : ""}
                    </p>
                    {row.externalLiteLlmRequestId ? (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {truncateMiddle(row.externalLiteLlmRequestId, 10, 4)}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No tracked usage yet"
                  description="Recent internal AI usage from /api/internal-ai/reports will appear here after your first successful run."
                  action={
                    <Button asChild variant="outline" size="sm">
                      <Link href="/dashboard">
                        Open dashboard
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Privacy defaults
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Slate stores attribution, tokens, cost, model, provider, and request
              metadata only. Prompt and response text stay in this browser session
              unless your organization opts into full logging later.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
