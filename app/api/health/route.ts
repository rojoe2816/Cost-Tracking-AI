import { NextResponse } from "next/server";

import { authStatus } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLiteLLMRuntimeConfig } from "@/lib/litellm/client";
import { getSlackRuntimeConfig } from "@/lib/slack/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ServiceStatus = "configured" | "placeholder" | "missing" | "unreachable";

async function checkDatabaseStatus(): Promise<ServiceStatus> {
  try {
    await db.$queryRaw`SELECT 1`;
    return "configured";
  } catch {
    return "unreachable";
  }
}

export async function GET() {
  const [database, litellm, slack] = await Promise.all([
    checkDatabaseStatus(),
    Promise.resolve(getLiteLLMRuntimeConfig().status),
    Promise.resolve(getSlackRuntimeConfig().status),
  ]);

  return NextResponse.json({
    ok: true,
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      auth: authStatus.enabled ? "enabled" : "deferred",
      database,
      litellm,
      slack,
    },
  });
}
