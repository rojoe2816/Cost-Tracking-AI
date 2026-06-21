import { CompanyAiWorkspace } from "@/components/company-ai/company-ai-workspace";
import {
  getInternalAiContextOptions,
} from "@/lib/internal-ai/context";
import { isCompanyAiGatewayConfigured } from "@/lib/internal-ai/companyAiRun";
import { getDemoOrganization } from "@/lib/slack/mappings";

export const dynamic = "force-dynamic";

export default async function CompanyAiPage() {
  const organization = await getDemoOrganization();

  if (!organization) {
    return (
      <div className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
        Demo Agency organization not found. Run `npm run db:seed` to create local
        development data.
      </div>
    );
  }

  const context = await getInternalAiContextOptions(organization.id);

  return (
    <CompanyAiWorkspace
      organizationName={organization.name}
      context={context}
      gatewayConfigured={isCompanyAiGatewayConfigured()}
    />
  );
}
