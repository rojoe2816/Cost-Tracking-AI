import { describe, expect, it } from "vitest";

import { getCompanyAiErrorMessage } from "./errorMessages";

describe("getCompanyAiErrorMessage", () => {
  it("maps known gateway errors to clean messages", () => {
    expect(getCompanyAiErrorMessage("DUPLICATE_SOURCE_APP_REQUEST")).toContain(
      "already processed",
    );
    expect(getCompanyAiErrorMessage("SOURCE_APP_KEY_NOT_CONFIGURED")).toContain(
      "MOCK_COMPANY_SOURCE_APP_KEY",
    );
  });

  it("falls back for unknown codes", () => {
    expect(getCompanyAiErrorMessage("UNKNOWN_CODE")).toBe(
      "Company AI request failed.",
    );
  });
});
