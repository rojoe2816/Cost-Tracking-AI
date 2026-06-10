import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/litellm/client", () => ({
  getLiteLLMRuntimeConfig: vi.fn(() => ({ status: "placeholder", baseUrl: "http://localhost:4000" })),
}));

vi.mock("@/lib/slack/client", () => ({
  getSlackRuntimeConfig: vi.fn(() => ({
    status: "placeholder",
    hasBotToken: true,
    hasSigningSecret: true,
  })),
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  });

  it("returns 200 with JSON", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("includes database, litellm, and slack service states", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({
      ok: true,
      status: "ok",
      services: {
        database: "configured",
        litellm: "placeholder",
        slack: "placeholder",
      },
    });
  });

  it("reports database as unreachable when the ping fails", async () => {
    mockDb.$queryRaw.mockRejectedValue(new Error("connection refused"));

    const response = await GET();
    const body = await response.json();

    expect(body.services.database).toBe("unreachable");
    expect(body.ok).toBe(true);
  });
});
