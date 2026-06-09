export interface RateLimitPolicy {
  name: string;
  windowMs: number;
  maxRequests: number;
}

export const defaultRateLimitPolicies = {
  apiRead: {
    name: "api-read",
    windowMs: 60_000,
    maxRequests: 120,
  },
  webhook: {
    name: "webhook",
    windowMs: 60_000,
    maxRequests: 300,
  },
} satisfies Record<string, RateLimitPolicy>;

export function buildRateLimitKey(parts: string[]) {
  return parts
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join(":");
}
