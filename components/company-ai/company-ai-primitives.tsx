import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/30 p-5 text-sm">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-2 text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-border/70 bg-white/80 px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
