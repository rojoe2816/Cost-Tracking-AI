import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Building2,
  Hash,
  Layers3,
  LayoutDashboard,
  Users,
} from "lucide-react";

export interface DashboardNavItem {
  href: Route;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const dashboardNavigation: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    description: "Spend and readiness summary",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/usage",
    label: "Usage",
    description: "Event-level AI ledger",
    icon: Activity,
  },
  {
    href: "/dashboard/clients",
    label: "Clients",
    description: "Agency-to-client rollups",
    icon: Building2,
  },
  {
    href: "/dashboard/projects",
    label: "Projects",
    description: "Project costing views",
    icon: Layers3,
  },
  {
    href: "/dashboard/workflows",
    label: "Workflows",
    description: "Automation cost attribution",
    icon: Layers3,
  },
  {
    href: "/dashboard/channels",
    label: "Slack channels",
    description: "Channel-level usage context",
    icon: Hash,
  },
  {
    href: "/dashboard/people",
    label: "People",
    description: "User and membership tracking",
    icon: Users,
  },
];
