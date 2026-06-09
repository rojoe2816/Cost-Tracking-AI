"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { dashboardNavigation } from "@/lib/navigation";

interface DashboardNavProps {
  compact?: boolean;
}

export function DashboardNav({ compact = false }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        compact ? "flex gap-2 overflow-x-auto pb-1" : "space-y-2",
      )}
      aria-label="Dashboard navigation"
    >
      {dashboardNavigation.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              compact
                ? "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors"
                : "block rounded-2xl border px-4 py-3 transition-colors",
              isActive
                ? "border-primary/20 bg-primary/10 text-primary"
                : compact
                  ? "border-border/70 bg-white/70 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                  : "border-transparent bg-transparent text-muted-foreground hover:border-border/80 hover:bg-white/80 hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {compact ? (
              <span>{item.label}</span>
            ) : (
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-xs">{item.description}</p>
              </div>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
