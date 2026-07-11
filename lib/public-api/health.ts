import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

export type DependencyStatus = "healthy" | "unhealthy" | "unknown";

const WORKER_HEARTBEAT_PATH = path.join(
  process.cwd(),
  ".data",
  "worker-heartbeat.json",
);
const WORKER_STALE_MS = 30_000;
const LITELLM_PROBE_TIMEOUT_MS = 2_000;

type WorkerHeartbeatFile = {
  workerId: string;
  lastSeenAt: string;
};

export async function recordWorkerHeartbeat(workerId: string): Promise<void> {
  await mkdir(path.dirname(WORKER_HEARTBEAT_PATH), { recursive: true });
  const payload: WorkerHeartbeatFile = {
    workerId,
    lastSeenAt: new Date().toISOString(),
  };
  await writeFile(WORKER_HEARTBEAT_PATH, JSON.stringify(payload), "utf8");
}

export async function getWorkerHealthStatus(): Promise<DependencyStatus> {
  try {
    const raw = await readFile(WORKER_HEARTBEAT_PATH, "utf8");
    const parsed = JSON.parse(raw) as WorkerHeartbeatFile;
    const lastSeenAt = Date.parse(parsed.lastSeenAt);
    if (!Number.isFinite(lastSeenAt)) return "unknown";
    return Date.now() - lastSeenAt <= WORKER_STALE_MS ? "healthy" : "unhealthy";
  } catch {
    return "unknown";
  }
}

export async function getDatabaseHealthStatus(): Promise<DependencyStatus> {
  try {
    await db.$queryRaw`SELECT 1`;
    return "healthy";
  } catch {
    return "unhealthy";
  }
}

export async function getModelGatewayHealthStatus(): Promise<DependencyStatus> {
  const baseUrl = env.LITELLM_PROXY_URL?.replace(/\/$/, "");
  if (!baseUrl) return "unhealthy";

  try {
    const response = await fetch(`${baseUrl}/health/liveliness`, {
      method: "GET",
      signal: AbortSignal.timeout(LITELLM_PROBE_TIMEOUT_MS),
    });
    return response.ok ? "healthy" : "unhealthy";
  } catch {
    return "unhealthy";
  }
}

export async function getPublicHealthSnapshot() {
  const [database, modelGateway, worker] = await Promise.all([
    getDatabaseHealthStatus(),
    getModelGatewayHealthStatus(),
    getWorkerHealthStatus(),
  ]);

  const requiredOk = database === "healthy" && modelGateway === "healthy";
  const status = requiredOk
    ? worker === "unhealthy"
      ? "degraded"
      : "ok"
    : "degraded";

  return {
    status: status as "ok" | "degraded",
    database,
    modelGateway,
    worker,
    ok: requiredOk,
  };
}
