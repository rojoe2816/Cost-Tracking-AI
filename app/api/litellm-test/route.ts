import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createLiteLLMHeaders, getLiteLLMRuntimeConfig } from "@/lib/litellm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (env.NODE_ENV !== "development") {
    return NextResponse.json(
      { ok: false, error: "Not available outside development" },
      { status: 404 },
    );
  }

  const config = getLiteLLMRuntimeConfig();

  if (!config.baseUrl) {
    return NextResponse.json(
      { ok: false, error: "Missing LITELLM_PROXY_URL" },
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

    const data = await response.json().catch(() => null);

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown LiteLLM test error",
      },
      { status: 500 },
    );
  }
}
