"use client";

import { ArrowRight, CheckCircle2, Circle } from "lucide-react";

const FLOW = [
  "Company AI",
  "Slate Gateway",
  "LiteLLM",
  "Usage Tracking",
] as const;

export function CompanyAiFlowIndicator() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary">
      {FLOW.map((step, index) => (
        <div key={step} className="flex items-center gap-2">
          <span className="font-medium">{step}</span>
          {index < FLOW.length - 1 ? (
            <ArrowRight className="h-4 w-4 text-primary/70" aria-hidden="true" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function CompanyAiLoadingSteps({ active }: { active: boolean }) {
  if (!active) {
    return null;
  }

  return (
    <div
      className="rounded-2xl border border-border/70 bg-secondary/40 p-4"
      aria-live="polite"
    >
      <p className="text-sm font-medium text-foreground">
        Routing through Slate gateway…
      </p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {[
          "Authenticating source app",
          "Validating attribution",
          "Calling model through LiteLLM",
          "Recording usage event",
        ].map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            {index === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
            )}
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
