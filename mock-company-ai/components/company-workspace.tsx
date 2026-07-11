"use client";

import type { SlateContext, SlateRunResult } from "@slate-ai/contracts";
import { useEffect, useMemo, useRef, useState } from "react";

const TASK_TYPES = [
  ["client_update", "Client update"],
  ["support_summary", "Support summary"],
  ["project_risk_note", "Project risk note"],
  ["research_note", "Research note"],
] as const;

const EXAMPLES = [
  {
    label: "Weekly client update",
    taskType: "client_update",
    prompt:
      "Draft a concise weekly client update with progress, next actions, and one risk to monitor.",
  },
  {
    label: "Project risk note",
    taskType: "project_risk_note",
    prompt:
      "Write a short internal risk note covering timeline pressure, owner, impact, and mitigation.",
  },
  {
    label: "Research brief",
    taskType: "research_note",
    prompt:
      "Summarize three practical research questions we should answer before the next client meeting.",
  },
] as const;

type AppError = {
  code: string;
  message: string;
  requestId?: string | null;
};

function formatCost(costMicros: number): string {
  if (costMicros === 0) return "$0.000000";
  return `$${(costMicros / 1_000_000).toFixed(6)}`;
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CompanyWorkspace() {
  const [context, setContext] = useState<SlateContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [employee, setEmployee] = useState("");
  const [client, setClient] = useState("");
  const [project, setProject] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [model, setModel] = useState("");
  const [taskType, setTaskType] = useState("client_update");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<SlateRunResult | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const projects = useMemo(
    () => context?.projects.filter((entry) => entry.clientExternalId === client) ?? [],
    [client, context],
  );

  useEffect(() => {
    void loadContext();
  }, []);

  async function loadContext() {
    setContextLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/context", { cache: "no-store" });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? { code: "CONTEXT_FAILED", message: "Context failed to load." });
        return;
      }

      const next = body as SlateContext;
      setContext(next);
      setEmployee(next.employees[0]?.externalId ?? "");
      setClient(next.clients[0]?.externalId ?? "");
      setWorkflow(next.workflows[0]?.externalId ?? "");
      setModel(next.models[0]?.id ?? "");
      const firstClient = next.clients[0]?.externalId;
      setProject(
        next.projects.find((entry) => entry.clientExternalId === firstClient)?.externalId ?? "",
      );
    } catch {
      setError({
        code: "MOCK_APP_UNAVAILABLE",
        message: "The mock application could not load its Slate context.",
      });
    } finally {
      setContextLoading(false);
    }
  }

  function changeClient(value: string) {
    setClient(value);
    setProject(
      context?.projects.find((entry) => entry.clientExternalId === value)?.externalId ?? "",
    );
  }

  async function submit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeExternalId: employee,
          clientExternalId: client || null,
          projectExternalId: project || null,
          workflowExternalId: workflow || null,
          taskType,
          sourceAppRequestId: `northwind-${crypto.randomUUID()}`,
          model,
          input: prompt,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? { code: "REQUEST_FAILED", message: "The request failed." });
        return;
      }

      setResult(body as SlateRunResult);
    } catch {
      setError({
        code: "MOCK_APP_UNAVAILABLE",
        message: "The company application could not reach its server.",
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const canSubmit =
    !contextLoading &&
    !submitting &&
    Boolean(employee && client && project && workflow && model && prompt.trim());

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Northwind home">
          <span className="brand-mark">N</span>
          <span>
            <strong>Northwind</strong>
            <small>AI workspace</small>
          </span>
        </a>
        <div className={`connection ${error ? "connection-warn" : ""}`}>
          <i />
          {error ? "Integration needs attention" : "Connected through Slate"}
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">Customer application / separate runtime</p>
          <h1>Turn a rough thought into client-ready work.</h1>
          <p className="hero-copy">
            This is Northwind&apos;s employee tool. It sends business context and the task
            to Slate over HTTP; Slate handles model routing, attribution, and cost.
          </p>
        </div>
        <div className="flow-card" aria-label="Integration flow">
          <span>Northwind</span>
          <b>HTTPS</b>
          <span>Slate gateway</span>
          <b>metered</b>
          <span>Model</span>
        </div>
      </section>

      <section className="workspace-grid">
        <article className="composer-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">New task</p>
              <h2>What are we working on?</h2>
            </div>
            <span className="privacy-chip">Prompt not stored</span>
          </div>

          {contextLoading ? <div className="loading-bar">Loading company context…</div> : null}

          <div className="fields-grid">
            <SelectField
              label="Employee"
              value={employee}
              onChange={setEmployee}
              options={
                context?.employees.map((entry) => ({
                  value: entry.externalId,
                  label: `${entry.name}${entry.department ? ` · ${entry.department}` : ""}`,
                })) ?? []
              }
            />
            <SelectField
              label="Client"
              value={client}
              onChange={changeClient}
              options={
                context?.clients.map((entry) => ({
                  value: entry.externalId,
                  label: entry.name,
                })) ?? []
              }
            />
            <SelectField
              label="Project"
              value={project}
              onChange={setProject}
              disabled={projects.length === 0}
              options={projects.map((entry) => ({
                value: entry.externalId,
                label: entry.name,
              }))}
            />
            <SelectField
              label="Workflow"
              value={workflow}
              onChange={setWorkflow}
              options={
                context?.workflows.map((entry) => ({
                  value: entry.externalId,
                  label: entry.name,
                })) ?? []
              }
            />
            <SelectField
              label="Task type"
              value={taskType}
              onChange={setTaskType}
              options={TASK_TYPES.map(([value, label]) => ({ value, label }))}
            />
            <SelectField
              label="Model"
              value={model}
              onChange={setModel}
              options={
                context?.models.map((entry) => ({
                  value: entry.id,
                  label: `${entry.label} · ${entry.provider}`,
                })) ?? []
              }
            />
          </div>

          <label className="prompt-field">
            <span>Instructions</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={7}
              placeholder="Describe the result you need, the audience, and any important constraints…"
              maxLength={16000}
            />
            <small>{prompt.length.toLocaleString()} / 16,000 characters</small>
          </label>

          <div className="examples">
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => {
                  setTaskType(example.taskType);
                  setPrompt(example.prompt);
                }}
              >
                {example.label}
              </button>
            ))}
          </div>

          <button className="submit-button" type="button" disabled={!canSubmit} onClick={submit}>
            {submitting ? "Routing securely through Slate…" : "Generate with AI"}
            <span>→</span>
          </button>
        </article>

        <aside className="result-column">
          {error ? (
            <div className="error-card" role="alert">
              <p className="eyebrow">Integration error</p>
              <h3>{error.code.replaceAll("_", " ")}</h3>
              <p>{error.message}</p>
              {error.requestId ? <code>{error.requestId}</code> : null}
              <button type="button" onClick={loadContext}>Retry connection</button>
            </div>
          ) : result ? (
            <div className="result-card">
              <div className="result-header">
                <div>
                  <p className="eyebrow">Completed response</p>
                  <h3>Ready to use</h3>
                </div>
                <span>✓</span>
              </div>
              <div className="response-copy">{result.response}</div>
              <div className="metrics">
                <div><span>Model</span><strong>{result.usage.model}</strong></div>
                <div><span>Tokens</span><strong>{result.usage.totalTokens.toLocaleString()}</strong></div>
                <div><span>AI cost</span><strong>{formatCost(result.usage.costMicros)}</strong></div>
                <div><span>Latency</span><strong>{result.usage.latencyMs} ms</strong></div>
              </div>
              <div className="request-id">
                <span>Slate request</span>
                <code title={result.requestId}>{result.requestId}</code>
              </div>
            </div>
          ) : (
            <div className="empty-result">
              <div className="orb"><span /></div>
              <p className="eyebrow">Response preview</p>
              <h3>Your finished work will appear here.</h3>
              <p>
                Submit one small task to verify the complete Northwind → Slate → model
                workflow.
              </p>
            </div>
          )}

          <div className="boundary-note">
            <strong>Clean application boundary</strong>
            <p>
              This app has no database or LiteLLM access and imports no Slate internals.
              Its credential is used only by the server.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
