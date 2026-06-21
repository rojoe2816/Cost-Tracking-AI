export type DemoMembershipRole = "OWNER" | "ADMIN" | "MEMBER";
export type DemoEntityStatus = "ACTIVE" | "ARCHIVED";
export type DemoPromptStorageMode =
  | "METADATA_ONLY"
  | "REDACTED"
  | "FULL_LOGGING";

export interface DemoProjectDefinition {
  id: string;
  name: string;
  status: DemoEntityStatus;
}

export interface DemoClientDefinition {
  id: string;
  name: string;
  externalAccountingId: string | null;
  status: DemoEntityStatus;
  projects: readonly DemoProjectDefinition[];
}

interface DemoAgencyDefinition {
  name: string;
  slug: string;
  owner: {
    email: string;
    name: string;
    role: DemoMembershipRole;
  };
  clients: readonly DemoClientDefinition[];
  workflowTypes: readonly string[];
  employees: readonly DemoEmployeeDefinition[];
  sourceApps: readonly DemoSourceAppDefinition[];
  privacy: {
    promptStorageMode: DemoPromptStorageMode;
  };
}

export interface DemoEmployeeDefinition {
  name: string;
  email: string | null;
  department: string | null;
  role: string | null;
  externalId: string | null;
}

export interface DemoSourceAppDefinition {
  name: string;
  type: string;
  description: string | null;
}

export const demoAgency = {
  name: "Demo Agency",
  slug: "demo-agency",
  owner: {
    email: "owner@example.com",
    name: "Demo Owner",
    role: "OWNER",
  },
  clients: [
    {
      id: "acme-dental",
      name: "Acme Dental",
      externalAccountingId: null,
      status: "ACTIVE",
      projects: [
        {
          id: "seo-retainer",
          name: "SEO Retainer",
          status: "ACTIVE",
        },
      ],
    },
    {
      id: "greenline-roofing",
      name: "Greenline Roofing",
      externalAccountingId: null,
      status: "ACTIVE",
      projects: [
        {
          id: "ad-campaign",
          name: "Ad Campaign",
          status: "ACTIVE",
        },
      ],
    },
    {
      id: "northstar-fitness",
      name: "Northstar Fitness",
      externalAccountingId: null,
      status: "ACTIVE",
      projects: [
        {
          id: "website-refresh",
          name: "Website Refresh",
          status: "ACTIVE",
        },
      ],
    },
  ],
  workflowTypes: [
    "Blog Drafting",
    "SEO Research",
    "Client Update",
    "Proposal Writing",
    "Meeting Summary",
    "Ad Copy",
    "Internal Admin",
  ],
  employees: [
    {
      name: "Tucker Hawkins",
      email: "tucker@demo-agency.test",
      department: "Operations",
      role: "Director",
      externalId: "emp_tucker",
    },
    {
      name: "Rohan Shah",
      email: "rohan@demo-agency.test",
      department: "Product",
      role: "Product Lead",
      externalId: "emp_rohan",
    },
    {
      name: "Demo Analyst",
      email: "analyst@demo-agency.test",
      department: "Analytics",
      role: "Analyst",
      externalId: "emp_analyst",
    },
    {
      name: "Client Success Lead",
      email: "cs@demo-agency.test",
      department: "Client Success",
      role: "Lead",
      externalId: "emp_cs_lead",
    },
    {
      name: "Support Analyst",
      email: "support@demo-agency.test",
      department: "Support",
      role: "Analyst",
      externalId: "emp_support",
    },
  ],
  sourceApps: [
    {
      name: "Mock Company AI Portal",
      type: "mock_company_portal",
      description: "Demo internal AI portal for employee task workflows.",
    },
    {
      name: "Internal Knowledge Assistant",
      type: "internal_knowledge_assistant",
      description: "Company knowledge search and summarization tool.",
    },
    {
      name: "Sales AI Tool",
      type: "sales_ai_tool",
      description: "Sales enablement and proposal drafting assistant.",
    },
    {
      name: "Support AI Tool",
      type: "support_ai_tool",
      description: "Customer support response drafting and triage.",
    },
    {
      name: "Slack Connector",
      type: "slack_connector",
      description: "Optional Slack integration source for attributed usage.",
    },
  ],
  privacy: {
    promptStorageMode: "METADATA_ONLY",
  },
} as const satisfies DemoAgencyDefinition;

export const demoAgencyProjects = demoAgency.clients.flatMap((client) =>
  client.projects.map((project) => ({
    id: `${client.id}:${project.id}`,
    name: project.name,
    clientName: client.name,
    status: project.status,
  })),
);

export const demoAgencyCounts = {
  clients: demoAgency.clients.length,
  projects: demoAgencyProjects.length,
  workflowTypes: demoAgency.workflowTypes.length,
};

export function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
