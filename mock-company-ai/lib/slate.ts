import "server-only";

import { SlateClient } from "@slate-ai/sdk";

export function getSlateClient(): SlateClient {
  const baseUrl = process.env.SLATE_BASE_URL?.trim();
  const apiKey = process.env.SLATE_SOURCE_APP_KEY?.trim();

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Configure SLATE_BASE_URL and SLATE_SOURCE_APP_KEY in mock-company-ai/.env.local.",
    );
  }

  return new SlateClient({
    baseUrl,
    apiKey,
    timeoutMs: 35_000,
    maxRetries: 1,
  });
}
