import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "./middleware";

describe("dashboard middleware", () => {
  it("preserves the requested protected URL when redirecting to login", () => {
    const response = middleware(
      new NextRequest(
        "http://127.0.0.1:3000/settings/attribution?range=30d",
        { headers: { host: "127.0.0.1:3000" } },
      ),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(`${location.pathname}${location.search}`).toBe(
      "/login?next=%2Fsettings%2Fattribution%3Frange%3D30d",
    );
  });

  it("allows a protected request with a session cookie to reach its guard", () => {
    const request = new NextRequest("http://127.0.0.1:3000/dashboard", {
      headers: {
        cookie: "slate_dashboard_session=signed-session-token",
      },
    });

    expect(middleware(request).headers.get("x-middleware-next")).toBe("1");
  });

  it("does not redirect public login requests", () => {
    const response = middleware(
      new NextRequest("http://127.0.0.1:3000/login"),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
