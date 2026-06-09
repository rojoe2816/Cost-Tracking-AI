export interface JobDefinition {
  key: string;
  label: string;
  scheduleHint: string;
  description: string;
}

export const jobCatalog: JobDefinition[] = [
  {
    key: "sync-litellm-usage",
    label: "Sync LiteLLM usage",
    scheduleHint: "Every 5 min",
    description: "Pull model usage and cost metadata into the usage ledger.",
  },
  {
    key: "sync-slack-channels",
    label: "Sync Slack channels",
    scheduleHint: "Hourly",
    description: "Refresh workspace and channel mappings for attribution.",
  },
  {
    key: "rollup-daily-costs",
    label: "Roll up daily costs",
    scheduleHint: "Nightly",
    description: "Persist agency, client, project, and workflow summary tables.",
  },
];
