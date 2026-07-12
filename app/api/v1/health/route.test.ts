import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetPublicHealthSnapshot = vi.hoisted(() => vi.fn());

vi.mock("@/lib/public-api/health", () => ({
  getPublicHealthSnapshot: mockGetPublicHealthSnapshot,
}));

import { GET } from "./route";

describe("GET /api/v1/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok when required dependencies are healthy", async () => {
    mockGetPublicHealthSnapshot.mockResolvedValue({
      status: "ok",
      ok: true,
      database: "healthy",
      modelGateway: "healthy",
      worker: "healthy",
    });

    const response = await GET(new Request("http://127.0.0.1:3000/api/v1/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.modelGateway).toBe("healthy");
    expect(JSON.stringify(body)).not.toContain("placeholder");
    expect(JSON.stringify(body)).not.toMatch(/sk-|master/i);
  });

  it("returns 503 when the model gateway is unhealthy", async () => {
    mockGetPublicHealthSnapshot.mockResolvedValue({
      status: "degraded",
      ok: false,
      database: "healthy",
      modelGateway: "unhealthy",
      worker: "unknown",
    });

    const response = await GET(new Request("http://127.0.0.1:3000/api/v1/health"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.modelGateway).toBe("unhealthy");
  });
});
