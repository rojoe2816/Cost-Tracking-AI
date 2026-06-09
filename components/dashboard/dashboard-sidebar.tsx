"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppLogo } from "@/components/app-logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { dashboardNavigation } from "@/lib/navigation";

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-80 shrink-0 border-r border-border/70 bg-white/55 px-6 py-6 backdrop-blur xl:block">
      <div className="space-y-8">
        <AppLogo />

        <div className="space-y-3">
          <Badge variant="secondary" className="rounded-full">
            Build milestone
          </Badge>
          <p className="text-sm leading-6 text-muted-foreground">
            Public shell for the MVP foundation. Authentication and live usage
            ingestion will plug into this layout next.
          </p>
        </div>

        <nav className="space-y-2">
          {dashboardNavigation.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-2xl border px-4 py-3 transition-colors",
                  isActive
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-transparent bg-transparent text-muted-foreground hover:border-border/80 hover:bg-white/80 hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5" />
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs">{item.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
