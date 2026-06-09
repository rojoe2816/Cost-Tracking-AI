import type { ReactNode } from "react";

import { AppLogo } from "@/components/app-logo";
import { Card } from "@/components/ui/card";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="container flex min-h-screen items-center py-10">
      <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="surface-panel hidden border-0 p-10 lg:block">
          <div className="space-y-6">
            <AppLogo />
            <div className="space-y-4">
              <h1 className="max-w-xl font-heading text-5xl font-semibold tracking-tight text-balance">
                Auth will plug into the agency membership model next.
              </h1>
              <p className="max-w-lg text-lg leading-8 text-muted-foreground">
                The shell is ready for role-aware agency access, but this milestone
                intentionally stops at database and application setup so the auth
                strategy can be chosen cleanly.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-center">{children}</div>
      </div>
    </main>
  );
}
