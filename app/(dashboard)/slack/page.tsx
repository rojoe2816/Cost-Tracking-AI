import { PageHeader } from "@/components/dashboard/page-header";
import { SlackMappingManager } from "@/components/slack/slack-mapping-manager";
import { requireDashboardSession } from "@/lib/auth/session";
import { getSlackMappingPageData } from "@/lib/slack/mappings";

export const dynamic = "force-dynamic";

export default async function SlackPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requireDashboardSession();
  const params = await searchParams;
  const data = await getSlackMappingPageData(session.organizationId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Slack"
        title="Slack channel attribution"
        description="Connect a Slack workspace to Slate, then map channels to clients, projects, and workflow types."
      />

      <SlackMappingManager
        data={data}
        notice={params.notice}
        error={params.error}
      />
    </div>
  );
}
