import { PageHeader } from "@/components/dashboard/page-header";
import {
  SourceAppManager,
  type SourceAppManagerRow,
} from "@/components/source-apps/source-app-manager";
import { requireAdminSession } from "@/lib/auth/session";
import { listSourceAppsForAdmin } from "@/lib/internal-ai/sourceAppAdmin";

export const dynamic = "force-dynamic";

export default async function SourceAppsPage() {
  const session = await requireAdminSession();
  const apps = await listSourceAppsForAdmin(session.organizationId);
  const serialized: SourceAppManagerRow[] = apps.map((app) => ({
    ...app,
    createdAt: app.createdAt.toISOString(),
    credentials: app.credentials.map((credential) => ({
      ...credential,
      createdAt: credential.createdAt.toISOString(),
      lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
      revokedAt: credential.revokedAt?.toISOString() ?? null,
    })),
    usage: {
      ...app.usage,
      latestUsageAt: app.usage.latestUsageAt?.toISOString() ?? null,
    },
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings / Integrations"
        title="Source applications"
        description="Issue organization-scoped credentials, rotate or revoke access, and monitor each connected application without exposing stored hashes."
      />
      <SourceAppManager apps={serialized} />
    </div>
  );
}
