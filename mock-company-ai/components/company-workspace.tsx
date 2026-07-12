"use client";

import type { SlateContext, SlateRunResult } from "@slate-ai/contracts";
import { useEffect, useMemo, useRef, useState } from "react";

const TASK_TYPES = [
  ["client_update", "Client update"],
  ["support_summary", "Support summary"],
  ["sales_followup", "Sales follow-up"],
  ["research_note", "Research note"],
  ["project_risk_summary", "Project risk summary"],
] as const;

const EXAMPLES = [
  {
    label: "Weekly client update",
    prompt:
      "Draft a concise weekly client update with progress, next actions, and one risk to monitor.",
  },
  {
    label: "Project risk note",
    prompt:
      "Write a short internal risk note covering timeline pressure, owner, impact, and mitigation.",
  },
  {
    label: "Research brief",
    prompt:
      "Summarize three practical research questions we should answer before the next client meeting.",
  },
] as const;

type AppError = {
  code: string;
  message: string;
  requestId?: string | null;
};

type Suggestion = {
  workflowExternalId: string;
  workflowLabel: string;
  taskType: string;
  confidence: number;
  modelVersion: string;
  requiresReview: boolean;
  alternatives?: Array<{
    workflowExternalId: string;
    taskType: string;
    confidence: number;
  }>;
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
  const [consentToTraining, setConsentToTraining] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [classifierUnavailable, setClassifierUnavailable] = useState(false);
  const [result, setResult] = useState<SlateRunResult | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const sourceAppRequestIdRef = useRef(`northwind-${crypto.randomUUID()}`);

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

  async function analyzeTask() {
    if (!prompt.trim() || analyzing) return;
    setAnalyzing(true);
    setError(null);
    setClassifierUnavailable(false);

    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: prompt,
          allowedWorkflows: context?.workflows ?? [],
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setSuggestion(null);
        setManualOverride(true);
        setClassifierUnavailable(true);
        setError({
          code: body.error?.code ?? "ATTRIBUTION_UNAVAILABLE",
          message:
            body.error?.message ??
            "Attribution suggestions are unavailable. Choose workflow and task type manually.",
        });
        return;
      }

      const next = body as Suggestion;
      setSuggestion(next);
      setWorkflow(next.workflowExternalId);
      setTaskType(next.taskType);
      setManualOverride(false);
      setError(null);
    } catch {
      setSuggestion(null);
      setManualOverride(true);
      setClassifierUnavailable(true);
      setError({
        code: "ATTRIBUTION_UNAVAILABLE",
        message:
          "Attribution suggestions are unavailable. Choose workflow and task type manually.",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function submit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setResult(null);

    const wasOverridden = Boolean(
      suggestion &&
        (suggestion.workflowExternalId !== workflow ||
          suggestion.taskType !== taskType ||
          manualOverride),
    );

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
          sourceAppRequestId: sourceAppRequestIdRef.current,
          model,
          input: prompt,
          consentToAttributionTraining: consentToTraining,
          attributionPrediction: suggestion
            ? {
                predictedWorkflowExternalId: suggestion.workflowExternalId,
                predictedTaskType: suggestion.taskType,
                confidence: suggestion.confidence,
                modelVersion: suggestion.modelVersion,
                wasOverridden,
                requiredReview: suggestion.requiresReview,
              }
            : null,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? { code: "REQUEST_FAILED", message: "The request failed." });
        return;
      }

      setResult(body as SlateRunResult);
      setConsentToTraining(false);
      sourceAppRequestIdRef.current = `northwind-${crypto.randomUUID()}`;
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

  const showManualSelectors = manualOverride || classifierUnavailable || !suggestion;
  const canSubmit =
    !contextLoading &&
    !submitting &&
    !analyzing &&
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
            Enter the task, let the attribution service suggest workflow and task type,
            then generate through Slate.
          </p>
        </div>
        <div className="flow-card" aria-label="Integration flow">
          <span>Northwind</span>
          <b>classify</b>
          <span>Attribution</span>
          <b>HTTPS</b>
          <span>Slate</span>
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
              onChange={(event) => {
                setPrompt(event.target.value);
                setSuggestion(null);
              }}
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
                  setPrompt(example.prompt);
                  setSuggestion(null);
                }}
              >
                {example.label}
              </button>
            ))}
          </div>

          <div className="examples">
            <button
              type="button"
              onClick={() => void analyzeTask()}
              disabled={!prompt.trim() || analyzing || contextLoading}
            >
              {analyzing ? "Analyzing…" : "Analyze task"}
            </button>
          </div>

          {suggestion ? (
            <div className="result-card" style={{ marginTop: "1rem" }}>
              <p className="eyebrow">Suggested by AI</p>
              <h3>
                {suggestion.workflowLabel} ·{" "}
                {TASK_TYPES.find(([value]) => value === suggestion.taskType)?.[1] ??
                  suggestion.taskType}
              </h3>
              <p>
                Confidence {(suggestion.confidence * 100).toFixed(0)}% · model{" "}
                {suggestion.modelVersion}
              </p>
              {suggestion.requiresReview ? (
                <p role="status">AI is not confident. Please review the suggested assignment.</p>
              ) : null}
              <div className="examples">
                <button
                  type="button"
                  onClick={() => {
                    setWorkflow(suggestion.workflowExternalId);
                    setTaskType(suggestion.taskType);
                    setManualOverride(false);
                  }}
                >
                  Use suggestion
                </button>
                <button type="button" onClick={() => setManualOverride(true)}>
                  Change
                </button>
              </div>
            </div>
          ) : null}

          {showManualSelectors ? (
            <div className="fields-grid" style={{ marginTop: "1rem" }}>
              <SelectField
                label="Workflow"
                value={workflow}
                onChange={(value) => {
                  setWorkflow(value);
                  setManualOverride(true);
                }}
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
                onChange={(value) => {
                  setTaskType(value);
                  setManualOverride(true);
                }}
                options={TASK_TYPES.map(([value, label]) => ({ value, label }))}
              />
            </div>
          ) : null}

          <label className="field" style={{ marginTop: "1rem" }}>
            <span>
              <input
                type="checkbox"
                checked={consentToTraining}
                onChange={(event) => setConsentToTraining(event.target.checked)}
              />{" "}
              Use this task to improve attribution
            </span>
            <small>
              Optional. Slate encrypts the task text and stores it only when the
              workspace privacy setting also allows training.
            </small>
          </label>

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
              <button type="button" onClick={loadContext}>
                Retry connection
              </button>
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
                <div>
                  <span>Model</span>
                  <strong>{result.usage.model}</strong>
                </div>
                <div>
                  <span>Tokens</span>
                  <strong>{result.usage.totalTokens.toLocaleString()}</strong>
                </div>
                <div>
                  <span>AI cost</span>
                  <strong>{formatCost(result.usage.costMicros)}</strong>
                </div>
                <div>
                  <span>Latency</span>
                  <strong>{result.usage.latencyMs} ms</strong>
                </div>
              </div>
              <div className="request-id">
                <span>Slate request</span>
                <code title={result.requestId}>{result.requestId}</code>
              </div>
            </div>
          ) : (
            <div className="empty-result">
              <div className="orb">
                <span />
              </div>
              <p className="eyebrow">Response preview</p>
              <h3>Your finished work will appear here.</h3>
              <p>
                Analyze the task, accept or override the suggestion, then generate through
                Slate.
              </p>
            </div>
          )}

          <div className="boundary-note">
            <strong>Clean application boundary</strong>
            <p>
              This app has no database or LiteLLM access and imports no Slate internals.
              Classifier and Slate credentials stay on the server.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
