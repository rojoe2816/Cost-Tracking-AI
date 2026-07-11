import type { ReactNode } from "react";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/app/(auth)/sign-in/actions";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireDashboardSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireDashboardSession();
  const [clientCount, projectCount, workflowTypeCount] = await db.$transaction([
    db.client.count({ where: { organizationId: session.organizationId } }),
    db.project.count({ where: { organizationId: session.organizationId } }),
    db.workflowType.count({ where: { organizationId: session.organizationId } }),
  ]);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <DashboardSidebar
          organizationName={session.organizationName}
          clientCount={clientCount}
          projectCount={projectCount}
          workflowTypeCount={workflowTypeCount}
        />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 px-6 py-5 backdrop-blur md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    Internal AI control plane
                  </p>
                  <h1 className="font-heading text-3xl font-semibold tracking-tight">
                    {session.organizationName}
                  </h1>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  Monitor source-app gateway usage, attribution, credentials, and
                  client profitability inside this authenticated workspace.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {session.userName}
                </Badge>
                <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                  {session.role}
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  Metadata-only default
                </Badge>
                <form action={signOutAction}>
                  <Button type="submit" variant="outline" size="sm" className="gap-2 rounded-full">
                    <LogOut className="h-4 w-4" /> Sign out
                  </Button>
                </form>
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
