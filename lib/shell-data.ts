import { subDays, subHours } from "date-fns";

export interface UsageRecord {
  id: string;
  client: string;
  project: string;
  workflow: string;
  user: string;
  channel: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalCost: string;
  occurredAt: Date;
}

export interface ClientShellRow {
  id: string;
  name: string;
  projectCount: number;
  monthlySpend: string;
  owner: string;
  status: "Active" | "Pilot";
}

export interface ProjectShellRow {
  id: string;
  name: string;
  client: string;
  workflowCount: number;
  monthlySpend: string;
  status: "Healthy" | "Scoping";
}

export interface WorkflowShellRow {
  id: string;
  name: string;
  project: string;
  provider: string;
  monthlySpend: string;
  status: "Live" | "Tuning";
}

export interface ChannelShellRow {
  id: string;
  name: string;
  workspace: string;
  project: string;
  workflow: string;
  status: "Linked" | "Monitoring";
}

export interface UserShellRow {
  id: string;
  name: string;
  role: "Owner" | "Operator" | "Strategist";
  primaryClient: string;
  primaryChannel: string;
  status: "Active" | "Invited";
}

export const shellUsageRecords: UsageRecord[] = [
  {
    id: "usage_01",
    client: "Northstar Travel",
    project: "Ops Copilot",
    workflow: "Daily brief generator",
    user: "Ava Patel",
    channel: "#northstar-ops",
    provider: "OpenAI",
    model: "gpt-4.1-mini",
    promptTokens: 18420,
    completionTokens: 3340,
    totalCost: "4.1821",
    occurredAt: subHours(new Date(), 2),
  },
  {
    id: "usage_02",
    client: "Sparrow Health",
    project: "Content QA",
    workflow: "Compliance rewrite",
    user: "Noah Kim",
    channel: "#sparrow-content",
    provider: "Anthropic",
    model: "claude-sonnet-4-0",
    promptTokens: 12780,
    completionTokens: 2950,
    totalCost: "3.6148",
    occurredAt: subHours(new Date(), 5),
  },
  {
    id: "usage_03",
    client: "Northstar Travel",
    project: "Ops Copilot",
    workflow: "Slack triage responder",
    user: "Lena Brooks",
    channel: "#northstar-support",
    provider: "OpenAI",
    model: "gpt-4.1-mini",
    promptTokens: 9230,
    completionTokens: 1980,
    totalCost: "1.9854",
    occurredAt: subHours(new Date(), 11),
  },
  {
    id: "usage_04",
    client: "Atlas Commerce",
    project: "Forecast Ops",
    workflow: "Margin anomaly scan",
    user: "Milo Chen",
    channel: "#atlas-finance",
    provider: "Google",
    model: "gemini-2.5-pro",
    promptTokens: 22110,
    completionTokens: 4110,
    totalCost: "6.2289",
    occurredAt: subDays(new Date(), 1),
  },
];

export const shellClients: ClientShellRow[] = [
  {
    id: "client_01",
    name: "Northstar Travel",
    projectCount: 2,
    monthlySpend: "2148.44",
    owner: "Ava Patel",
    status: "Active",
  },
  {
    id: "client_02",
    name: "Sparrow Health",
    projectCount: 1,
    monthlySpend: "1382.90",
    owner: "Noah Kim",
    status: "Active",
  },
  {
    id: "client_03",
    name: "Atlas Commerce",
    projectCount: 1,
    monthlySpend: "962.35",
    owner: "Milo Chen",
    status: "Pilot",
  },
];

export const shellProjects: ProjectShellRow[] = [
  {
    id: "project_01",
    name: "Ops Copilot",
    client: "Northstar Travel",
    workflowCount: 2,
    monthlySpend: "1328.61",
    status: "Healthy",
  },
  {
    id: "project_02",
    name: "Content QA",
    client: "Sparrow Health",
    workflowCount: 1,
    monthlySpend: "1382.90",
    status: "Healthy",
  },
  {
    id: "project_03",
    name: "Forecast Ops",
    client: "Atlas Commerce",
    workflowCount: 1,
    monthlySpend: "962.35",
    status: "Scoping",
  },
];

export const shellWorkflows: WorkflowShellRow[] = [
  {
    id: "workflow_01",
    name: "Daily brief generator",
    project: "Ops Copilot",
    provider: "OpenAI",
    monthlySpend: "442.16",
    status: "Live",
  },
  {
    id: "workflow_02",
    name: "Slack triage responder",
    project: "Ops Copilot",
    provider: "OpenAI",
    monthlySpend: "886.45",
    status: "Tuning",
  },
  {
    id: "workflow_03",
    name: "Compliance rewrite",
    project: "Content QA",
    provider: "Anthropic",
    monthlySpend: "1382.90",
    status: "Live",
  },
  {
    id: "workflow_04",
    name: "Margin anomaly scan",
    project: "Forecast Ops",
    provider: "Google",
    monthlySpend: "962.35",
    status: "Tuning",
  },
];

export const shellChannels: ChannelShellRow[] = [
  {
    id: "channel_01",
    name: "#northstar-ops",
    workspace: "Northstar HQ",
    project: "Ops Copilot",
    workflow: "Daily brief generator",
    status: "Linked",
  },
  {
    id: "channel_02",
    name: "#northstar-support",
    workspace: "Northstar HQ",
    project: "Ops Copilot",
    workflow: "Slack triage responder",
    status: "Linked",
  },
  {
    id: "channel_03",
    name: "#sparrow-content",
    workspace: "Sparrow Editorial",
    project: "Content QA",
    workflow: "Compliance rewrite",
    status: "Monitoring",
  },
];

export const shellUsers: UserShellRow[] = [
  {
    id: "user_01",
    name: "Ava Patel",
    role: "Owner",
    primaryClient: "Northstar Travel",
    primaryChannel: "#northstar-ops",
    status: "Active",
  },
  {
    id: "user_02",
    name: "Noah Kim",
    role: "Strategist",
    primaryClient: "Sparrow Health",
    primaryChannel: "#sparrow-content",
    status: "Active",
  },
  {
    id: "user_03",
    name: "Lena Brooks",
    role: "Operator",
    primaryClient: "Northstar Travel",
    primaryChannel: "#northstar-support",
    status: "Active",
  },
  {
    id: "user_04",
    name: "Milo Chen",
    role: "Operator",
    primaryClient: "Atlas Commerce",
    primaryChannel: "#atlas-finance",
    status: "Invited",
  },
];
