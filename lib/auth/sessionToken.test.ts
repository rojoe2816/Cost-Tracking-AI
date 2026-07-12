import { describe, expect, it } from "vitest";

import {
  DASHBOARD_SESSION_VERSION,
  isDashboardAdminRole,
  signDashboardSessionToken,
  verifyDashboardSessionToken,
} from "./sessionToken";

const SECRET = "test-session-secret-that-is-at-least-32-characters";
const PAYLOAD = {
  version: DASHBOARD_SESSION_VERSION,
  userId: "user_a",
  organizationId: "org_a",
  role: "OWNER" as const,
  expiresAt: 2_000,
};

describe("dashboard session tokens", () => {
  it("round-trips a valid signed token", () => {
    const token = signDashboardSessionToken(PAYLOAD, SECRET);
    expect(verifyDashboardSessionToken(token, SECRET, 1_000)).toEqual(PAYLOAD);
  });

  it("rejects tampering", () => {
    const token = signDashboardSessionToken(PAYLOAD, SECRET);
    const [payload, tokenSignature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...PAYLOAD, organizationId: "org_b" }),
    ).toString("base64url");

    expect(
      verifyDashboardSessionToken(
        `${tamperedPayload}.${tokenSignature}`,
        SECRET,
        1_000,
      ),
    ).toBeNull();
    expect(payload).not.toBe(tamperedPayload);
  });

  it("rejects expired tokens", () => {
    const token = signDashboardSessionToken(PAYLOAD, SECRET);
    expect(verifyDashboardSessionToken(token, SECRET, 2_000)).toBeNull();
  });

  it("rejects tokens signed with another secret", () => {
    const token = signDashboardSessionToken(PAYLOAD, SECRET);
    expect(
      verifyDashboardSessionToken(
        token,
        "another-session-secret-that-is-at-least-32-characters",
        1_000,
      ),
    ).toBeNull();
  });

  it("keeps credential administration owner/admin only", () => {
    expect(isDashboardAdminRole("OWNER")).toBe(true);
    expect(isDashboardAdminRole("ADMIN")).toBe(true);
    expect(isDashboardAdminRole("MEMBER")).toBe(false);
  });
});
