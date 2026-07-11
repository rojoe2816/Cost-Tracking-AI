export const SOURCE_APP_SCOPES = [
  "ai:run",
  "context:read",
  "context:write",
  "reports:read",
] as const;

export type SourceAppScope = (typeof SOURCE_APP_SCOPES)[number];

const SOURCE_APP_SCOPE_SET = new Set<string>(SOURCE_APP_SCOPES);

/** Null scopes are treated as full access for credentials created before scopes. */
export function normalizeSourceAppScopes(value: unknown): SourceAppScope[] {
  if (value === null || value === undefined) return [...SOURCE_APP_SCOPES];
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value.filter(
        (scope): scope is SourceAppScope =>
          typeof scope === "string" && SOURCE_APP_SCOPE_SET.has(scope),
      ),
    ),
  ];
}

export function hasSourceAppScope(
  scopes: readonly SourceAppScope[],
  requiredScope: SourceAppScope,
): boolean {
  return scopes.includes(requiredScope);
}
