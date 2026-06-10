import { expect } from "vitest";

export function objectContainsString(value: unknown, needle: string): boolean {
  if (typeof value === "string") {
    return value.includes(needle);
  }

  if (Array.isArray(value)) {
    return value.some((item) => objectContainsString(item, needle));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) =>
      objectContainsString(item, needle),
    );
  }

  return false;
}

export function collectMockCalls(...mockFns: Array<{ mock: { calls: unknown[][] } }>) {
  return mockFns.flatMap((mockFn) => mockFn.mock.calls);
}

export function assertMockCallsExcludeStrings(
  calls: unknown[][],
  needles: readonly string[],
) {
  for (const call of calls) {
    for (const needle of needles) {
      expect(objectContainsString(call, needle)).toBe(false);
    }
  }
}
