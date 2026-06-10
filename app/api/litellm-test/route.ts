import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createLiteLLMHeaders, getLiteLLMRuntimeConfig } from "@/lib/litellm";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 300;

interface LiteLLMTestResult {
  ok: boolean;
  status?: number;
  message: string;
  model?: string;
  providerErrorCode?: string | null;
}

function truncate(value: string) {
  return value.length > MAX_MESSAGE_LENGTH
    ? `${value.slice(0, MAX_MESSAGE_LENGTH)}…`
    : value;
}

/** Extracts only safe fields from the upstream response; never the raw body. */
function extractUpstreamDetails(data: unknown): {
  model?: string;
  errorMessage?: string;
  errorCode?: string;
} {
  if (typeof data !== "object" || data === null) {
    return {};
  }

  const record = data as Record<string, unknown>;
  const details: { model?: string; errorMessage?: string; errorCode?: string } =
    {};

  if (typeof record.model === "string") {
    details.model = record.model;
  }

  if (typeof record.error === "object" && record.error !== null) {
    const error = record.error as Record<string, unknown>;

    if (typeof error.message === "string") {
      details.errorMessage = error.message;
    }

    if (typeof error.code === "string" || typeof error.code === "number") {
      details.errorCode = String(error.code);
    }
  }

  return details;
}

export async function GET() {
  // Development-only: this route exists to verify local proxy connectivity.
  if (env.NODE_ENV !== "development") {
    return NextResponse.json(
      { ok: false, message: "Not available outside development" },
      { status: 404 },
    );
  }

  const config = getLiteLLMRuntimeConfig();

  if (!config.baseUrl || config.status === "missing") {
    return NextResponse.json<LiteLLMTestResult>(
      {
        ok: false,
        message:
          "LiteLLM is not configured. Set LITELLM_PROXY_URL and LITELLM_MASTER_KEY in .env.",
      },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: createLiteLLMHeaders(),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: "Reply with exactly: LiteLLM connected",
          },
        ],
        max_tokens: 20,
      }),
    });

    const data: unknown = await response.json().catch(() => null);
    const details = extractUpstreamDetails(data);

    if (response.ok) {
      return NextResponse.json<LiteLLMTestResult>({
        ok: true,
        status: response.status,
        message: "LiteLLM proxy call succeeded.",
        ...(details.model ? { model: details.model } : {}),
      });
    }

    // Upstream auth/config errors are expected locally with fake provider
    // keys; surface a bounded message, never the raw provider response.
    return NextResponse.json<LiteLLMTestResult>({
      ok: false,
      status: response.status,
      message: truncate(
        details.errorMessage ??
          "LiteLLM proxy responded with an error (no details provided).",
      ),
      providerErrorCode: details.errorCode ?? null,
    });
  } catch (error) {
    return NextResponse.json<LiteLLMTestResult>(
      {
        ok: false,
        message: `LiteLLM proxy is unreachable at ${config.baseUrl}. ${
          error instanceof Error ? truncate(error.message) : "Unknown error"
        }`,
        providerErrorCode: null,
      },
      { status: 500 },
    );
  }
}
