import { PageHeader } from "@/components/dashboard/page-header";
import { SlackMappingManager } from "@/components/slack/slack-mapping-manager";
import {
  getDemoOrganization,
  getSlackMappingPageData,
} from "@/lib/slack/mappings";

export default async function SlackPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const organization = await getDemoOrganization();
  const params = await searchParams;

  if (!organization) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Slack"
          title="Slack channel attribution"
          description="Manage manual Slack channel mappings for Demo Agency."
        />
        <div className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
          Demo Agency organization not found. Run `npm run db:seed` to create local
          development data.
        </div>
      </div>
    );
  }

  const data = await getSlackMappingPageData(organization.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Slack"
        title="Slack channel attribution"
        description="View and manage manual Slack channel mappings for Demo Agency. OAuth install is deferred; local development uses seeded workspace records."
      />

      <SlackMappingManager
        data={data}
        notice={params.notice}
        error={params.error}
      />
    </div>
  );
}
