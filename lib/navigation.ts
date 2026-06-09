import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Hash,
  Layers3,
  LayoutDashboard,
  ShieldCheck,
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
    label: "Dashboard",
    description: "Agency overview and placeholders",
    icon: LayoutDashboard,
  },
  {
    href: "/clients",
    label: "Clients",
    description: "Seeded clients and project scope",
    icon: Building2,
  },
  {
    href: "/projects",
    label: "Projects",
    description: "Project shell and mapping readiness",
    icon: Layers3,
  },
  {
    href: "/slack",
    label: "Slack",
    description: "Channel mapping and install status",
    icon: Hash,
  },
  {
    href: "/settings/privacy",
    label: "Privacy",
    description: "Prompt storage defaults",
    icon: ShieldCheck,
  },
];
