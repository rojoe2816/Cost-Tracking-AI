import { redirect } from "next/navigation";
import type { Route } from "next";

import { clearDashboardSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LogoutPage() {
  await clearDashboardSession();
  redirect("/login" as Route);
}
