import { NextResponse } from "next/server";

import {
  getRecentInternalAiUsage,
  getSpendByEmployee,
  getSpendBySourceApp,
  getSpendByTaskType,
} from "@/lib/analytics/internalUsage";
import { getDemoOrganization } from "@/lib/slack/mappings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const organization = await getDemoOrganization();

  if (!organization) {
    return NextResponse.json(
      {
        error: {
          code: "ORGANIZATION_NOT_FOUND",
          message: "Demo Agency organization was not found.",
        },
      },
      { status: 404 },
    );
  }

  const [byEmployee, bySourceApp, byTaskType, recent] = await Promise.all([
    getSpendByEmployee(organization.id),
    getSpendBySourceApp(organization.id),
    getSpendByTaskType(organization.id),
    getRecentInternalAiUsage(organization.id),
  ]);

  return NextResponse.json({
    organization: {
      id: organization.id,
      name: organization.name,
    },
    byEmployee,
    bySourceApp,
    byTaskType,
    recent,
  });
}
