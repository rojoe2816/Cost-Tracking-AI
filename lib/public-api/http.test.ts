import { beforeEach, describe, expect, it } from "vitest";

import {
  checkPublicRateLimit,
  getPublicRequestId,
  readPublicJsonBody,
  resetPublicRateLimitsForTests,
} from "./http";

describe("public API HTTP safeguards", () => {
  beforeEach(() => resetPublicRateLimitsForTests());

  it("preserves a valid caller request ID", () => {
    const request = new Request("http://localhost", {
      headers: { "X-Request-Id": "customer-request-123" },
    });
    expect(getPublicRequestId(request)).toBe("customer-request-123");
  });

  it("rejects oversized JSON before parsing", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Length": String(70 * 1024) },
      body: "{}",
    });
    expect(await readPublicJsonBody(request)).toMatchObject({
      ok: false,
      code: "REQUEST_TOO_LARGE",
    });
  });

  it("rate limits repeated requests without retaining the raw key", () => {
    const request = new Request("http://localhost", {
      headers: { Authorization: "Bearer slate_app_sk_secret" },
    });
    expect(
      checkPublicRateLimit({ request, route: "test", maxRequests: 1 }),
    ).toEqual({ ok: true });
    expect(
      checkPublicRateLimit({ request, route: "test", maxRequests: 1 }),
    ).toMatchObject({ ok: false });
  });
});
