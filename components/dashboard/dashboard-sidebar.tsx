"use client";

import { AppLogo } from "@/components/app-logo";
import { Badge } from "@/components/ui/badge";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

interface DashboardSidebarProps {
  organizationName: string;
  clientCount: number;
  projectCount: number;
  workflowTypeCount: number;
}

export function DashboardSidebar({
  organizationName,
  clientCount,
  projectCount,
  workflowTypeCount,
}: DashboardSidebarProps) {
  return (
    <aside className="hidden w-80 shrink-0 border-r border-border/70 bg-white/55 px-6 py-6 backdrop-blur xl:block">
      <div className="space-y-8">
        <AppLogo />

        <div className="rounded-3xl border border-border/70 bg-secondary/65 p-5">
          <Badge variant="secondary" className="rounded-full">
            Demo workspace
          </Badge>
          <h2 className="mt-4 font-heading text-2xl font-semibold">
            {organizationName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Local dashboard shell with seeded clients and privacy defaults. Auth,
            spend sync, and Slack installation are intentionally deferred.
          </p>
          <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl bg-white/75 p-3">
              <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Clients
              </dt>
              <dd className="mt-2 font-heading text-2xl">{clientCount}</dd>
            </div>
            <div className="rounded-2xl bg-white/75 p-3">
              <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Projects
              </dt>
              <dd className="mt-2 font-heading text-2xl">{projectCount}</dd>
            </div>
            <div className="rounded-2xl bg-white/75 p-3">
              <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Workflows
              </dt>
              <dd className="mt-2 font-heading text-2xl">{workflowTypeCount}</dd>
            </div>
          </dl>
        </div>

        <DashboardNav />
      </div>
    </aside>
  );
}
