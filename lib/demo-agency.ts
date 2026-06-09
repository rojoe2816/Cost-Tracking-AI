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
  privacy: {
    promptStorageMode: DemoPromptStorageMode;
  };
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
