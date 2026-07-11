import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Hash,
  Layers3,
  LayoutDashboard,
  ListTodo,
  ShieldCheck,
  KeyRound,
  ServerCog,
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
    description: "Spend and usage overview",
    icon: LayoutDashboard,
  },
  {
    href: "/clients",
    label: "Clients",
    description: "Profitability and AI cost",
    icon: Building2,
  },
  {
    href: "/projects",
    label: "Projects",
    description: "Delivery attribution setup",
    icon: Layers3,
  },
  {
    href: "/jobs",
    label: "Jobs",
    description: "Queue and connector operations",
    icon: ListTodo,
  },
  {
    href: "/slack",
    label: "Slack",
    description: "Optional connector mappings",
    icon: Hash,
  },
  {
    href: "/settings/source-apps",
    label: "Source Apps",
    description: "Credentials and app usage",
    icon: KeyRound,
  },
  {
    href: "/settings/model-providers",
    label: "Model Access",
    description: "Provider and model policy",
    icon: ServerCog,
  },
  {
    href: "/settings/privacy",
    label: "Privacy",
    description: "Prompt storage defaults",
    icon: ShieldCheck,
  },
];
