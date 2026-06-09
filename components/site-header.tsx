import Link from "next/link";

import { AppLogo } from "@/components/app-logo";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="container relative z-10 flex items-center justify-between py-6">
      <Link href="/" aria-label="Cost Tracking AI home">
        <AppLogo />
      </Link>
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" className="rounded-full">
          <Link href="/sign-in">Auth shell</Link>
        </Button>
        <Button asChild className="rounded-full px-5">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </header>
  );
}
