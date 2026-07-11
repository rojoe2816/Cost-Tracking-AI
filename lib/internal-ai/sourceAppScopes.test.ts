import { describe, expect, it } from "vitest";

import {
  SOURCE_APP_SCOPES,
  hasSourceAppScope,
  normalizeSourceAppScopes,
} from "./sourceAppScopes";

describe("source app scopes", () => {
  it("preserves full access for legacy null scopes", () => {
    expect(normalizeSourceAppScopes(null)).toEqual(SOURCE_APP_SCOPES);
  });

  it("rejects unknown values and deduplicates valid scopes", () => {
    expect(
      normalizeSourceAppScopes(["ai:run", "unknown", "ai:run", 123]),
    ).toEqual(["ai:run"]);
  });

  it("checks exact scope membership", () => {
    expect(hasSourceAppScope(["context:read"], "context:read")).toBe(true);
    expect(hasSourceAppScope(["context:read"], "context:write")).toBe(false);
  });
});
