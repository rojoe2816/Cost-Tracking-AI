import { NextResponse } from "next/server";

import { authStatus } from "@/lib/auth";
import { env } from "@/lib/env";
import { getLiteLLMRuntimeConfig } from "@/lib/litellm";
import { getSlackRuntimeConfig } from "@/lib/slack";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    services: {
      auth: authStatus.enabled ? "enabled" : "deferred",
      database: env.DATABASE_URL ? "configured" : "missing",
      litellm: getLiteLLMRuntimeConfig().status,
      slack: getSlackRuntimeConfig().status,
    },
  });
}
