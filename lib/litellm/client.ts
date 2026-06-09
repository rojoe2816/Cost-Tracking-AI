import { env } from "@/lib/env";

export interface LiteLLMRuntimeConfig {
  enabled: boolean;
  baseUrl?: string;
}

export function getLiteLLMRuntimeConfig(): LiteLLMRuntimeConfig {
  return {
    enabled: true,
    baseUrl: env.LITELLM_PROXY_URL,
  };
}

export function createLiteLLMHeaders() {
  return {
    Authorization: `Bearer ${env.LITELLM_MASTER_KEY}`,
    "Content-Type": "application/json",
  };
}
