export type IntegrationStatus = "missing" | "placeholder" | "configured";

/**
 * Markers that identify obvious local/dev placeholder credentials (the values
 * shipped in .env.example). Real credentials should never contain these.
 */
const PLACEHOLDER_MARKERS = [
  "placeholder",
  "change-me",
  "sk-dev-",
  "xoxb-dev-",
  "dev-slack-",
  "dev-only-",
  "example",
];

export function classifySecret(value: string | undefined): IntegrationStatus {
  if (!value || value.trim().length === 0) {
    return "missing";
  }

  const normalized = value.toLowerCase();

  if (PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))) {
    return "placeholder";
  }

  return "configured";
}

/** The weakest status wins: missing > placeholder > configured. */
export function combineStatuses(
  ...statuses: IntegrationStatus[]
): IntegrationStatus {
  if (statuses.includes("missing")) {
    return "missing";
  }

  if (statuses.includes("placeholder")) {
    return "placeholder";
  }

  return "configured";
}

export const integrationStatusLabels: Record<IntegrationStatus, string> = {
  missing: "Missing",
  placeholder: "Dev placeholder",
  configured: "Configured",
};
