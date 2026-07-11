import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TASK_TYPES = [
  "client_update",
  "support_summary",
  "sales_followup",
  "research_note",
  "project_risk_summary",
] as const;

type ClassifyBody = {
  text?: unknown;
  allowedWorkflows?: unknown;
};

export async function POST(request: Request) {
  let body: ClassifyBody;
  try {
    body = (await request.json()) as ClassifyBody;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: { code: "EMPTY_INPUT", message: "Task text is required." } },
      { status: 400 },
    );
  }

  const baseUrl = process.env.ATTRIBUTION_SERVICE_URL?.replace(/\/$/, "");
  const token = process.env.ATTRIBUTION_SERVICE_TOKEN;
  if (!baseUrl || !token) {
    return NextResponse.json(
      {
        error: {
          code: "ATTRIBUTION_NOT_CONFIGURED",
          message: "Attribution suggestions are unavailable. Choose workflow and task type manually.",
        },
      },
      { status: 503 },
    );
  }

  const allowedWorkflows = Array.isArray(body.allowedWorkflows)
    ? body.allowedWorkflows.filter(
        (entry): entry is { externalId: string; name: string } =>
          Boolean(
            entry &&
              typeof entry === "object" &&
              typeof (entry as { externalId?: unknown }).externalId === "string" &&
              typeof (entry as { name?: unknown }).name === "string",
          ),
      )
    : [];

  try {
    const response = await fetch(`${baseUrl}/v1/classify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        allowedWorkflows,
        allowedTaskTypes: [...TASK_TYPES],
      }),
      signal: AbortSignal.timeout(8_000),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      return NextResponse.json(
        {
          error: {
            code: "ATTRIBUTION_UNAVAILABLE",
            message:
              "Attribution suggestions are unavailable. Choose workflow and task type manually.",
          },
        },
        { status: 503 },
      );
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "ATTRIBUTION_UNAVAILABLE",
          message:
            "Attribution suggestions are unavailable. Choose workflow and task type manually.",
        },
      },
      { status: 503 },
    );
  }
}
