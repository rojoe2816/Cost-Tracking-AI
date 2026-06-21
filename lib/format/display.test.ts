import { describe, expect, it } from "vitest";

import {
  formatDateTime,
  formatNumber,
  formatTinyUsd,
  truncateMiddle,
} from "./display";

describe("display formatters", () => {
  it("truncates long strings in the middle", () => {
    expect(truncateMiddle("chatcmpl-abcdefghijklmnop", 8, 4)).toBe(
      "chatcmpl…mnop",
    );
  });

  it("formats numbers and tiny USD values", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatTinyUsd(0.000011)).toContain("$");
  });

  it("formats datetimes", () => {
    expect(formatDateTime("2026-06-21T12:00:00.000Z")).toMatch(/2026/);
  });
});
