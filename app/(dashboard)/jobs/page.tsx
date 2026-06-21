import { format } from "date-fns";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRecentBackgroundJobs } from "@/lib/queue";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const jobStatusStyles: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  FAILED: "bg-rose-50 text-rose-700 hover:bg-rose-50",
  PROCESSING: "bg-sky-50 text-sky-700 hover:bg-sky-50",
  QUEUED: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  CANCELED: "bg-slate-100 text-slate-700 hover:bg-slate-100",
};

function JobStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "whitespace-nowrap rounded-full px-3 py-1",
        jobStatusStyles[status] ?? "bg-slate-100 text-slate-700 hover:bg-slate-100",
      )}
    >
      {status}
    </Badge>
  );
}

export default async function JobsPage() {
  const jobs = await getRecentBackgroundJobs(20);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Background jobs"
        description="Recent durable queue rows for local development. Payloads are not displayed to avoid leaking metadata."
      />

      <Card className="surface-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Recent jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No durable background jobs yet. Start `npm run worker` and trigger
              a gateway or optional connector workflow to enqueue work.
            </p>
          ) : (
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Run after</TableHead>
                  <TableHead>Last error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(job.createdAt, "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate font-mono text-xs">
                      {job.type}
                    </TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {job.attempts}/{job.maxAttempts}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(job.runAfter, "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-muted-foreground">
                      {job.lastError ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
