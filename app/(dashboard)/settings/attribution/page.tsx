import { requireAdminSession } from "@/lib/auth/session";
import { getAttributionQualityReport } from "@/lib/attribution/decisions";
import { listTrainingExamplesForAdmin } from "@/lib/attribution/training";
import { softDeleteTrainingExampleAction } from "@/app/(dashboard)/settings/attribution/actions";
import { Button } from "@/components/ui/button";

export default async function AttributionSettingsPage() {
  const session = await requireAdminSession();
  const [report, examples] = await Promise.all([
    getAttributionQualityReport(session.organizationId),
    listTrainingExamplesForAdmin(session.organizationId),
  ]);

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Settings / Attribution
        </p>
        <h2 className="font-heading text-3xl font-semibold tracking-tight">
          Attribution quality
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Classifier performance, override rates, and consented training examples.
          Raw prompts are never shown here.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Active model" value={report.activeModelVersion ?? "None"} />
        <Metric
          label="Holdout macro F1"
          value={
            report.holdoutMacroF1 == null
              ? "—"
              : report.holdoutMacroF1.toFixed(3)
          }
        />
        <Metric
          label="Top-2 accuracy"
          value={
            report.holdoutTop2Accuracy == null
              ? "—"
              : report.holdoutTop2Accuracy.toFixed(3)
          }
        />
        <Metric label="Predictions" value={String(report.predictionCount)} />
        <Metric
          label="Override rate"
          value={`${(report.overrideRate * 100).toFixed(1)}%`}
        />
        <Metric
          label="Low-confidence rate"
          value={`${(report.lowConfidenceRate * 100).toFixed(1)}%`}
        />
        <Metric
          label="Training examples"
          value={String(report.trainingExampleCount)}
        />
        <Metric
          label="Most predicted task"
          value={report.mostCommonPredictedTaskType ?? "—"}
        />
        <Metric
          label="Most overridden task"
          value={report.mostOverriddenTaskType ?? "—"}
        />
      </div>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold">Training examples</h3>
        <p className="text-sm text-muted-foreground">
          Labels and timestamps only. Encrypted training text is never previewed.
        </p>
        <div className="space-y-3">
          {examples.length === 0 ? (
            <p className="text-sm text-muted-foreground">No consented examples yet.</p>
          ) : (
            examples.map((example) => (
              <div
                key={example.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 px-4 py-3"
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {example.finalWorkflowType.name} · {example.finalTaskType}
                  </p>
                  <p className="text-muted-foreground">
                    {example.approved ? "Approved" : "Pending"} ·{" "}
                    {example.createdAt.toISOString()}
                  </p>
                </div>
                <form action={softDeleteTrainingExampleAction}>
                  <input type="hidden" name="exampleId" value={example.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Delete
                  </Button>
                </form>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {props.label}
      </p>
      <p className="mt-2 text-lg font-semibold">{props.value}</p>
    </div>
  );
}
