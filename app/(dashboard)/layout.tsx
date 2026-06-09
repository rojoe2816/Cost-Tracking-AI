import type { ReactNode } from "react";

import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { demoAgency, demoAgencyCounts } from "@/lib/demo-agency";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <DashboardSidebar
          organizationName={demoAgency.name}
          clientCount={demoAgencyCounts.clients}
          projectCount={demoAgencyCounts.projects}
          workflowTypeCount={demoAgencyCounts.workflowTypes}
        />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 px-6 py-5 backdrop-blur md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    Agency control plane
                  </p>
                  <h1 className="font-heading text-3xl font-semibold tracking-tight">
                    {demoAgency.name}
                  </h1>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  Dashboard shell for the current local milestone. Authentication,
                  live spend ingestion, and Slack install flows are still
                  intentionally deferred while the data model and integration seams
                  settle.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  Local MVP shell
                </Badge>
                <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                  Auth deferred
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  Metadata-only default
                </Badge>
              </div>
            </div>

            <div className="mt-4 xl:hidden">
              <DashboardNav compact />
            </div>
          </header>

          <main className="min-w-0 flex-1 px-6 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
