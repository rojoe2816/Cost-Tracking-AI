import { format } from "date-fns";

import { PageHeader } from "@/components/dashboard/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRecentBackgroundJobs } from "@/lib/queue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

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
              No durable background jobs yet. Start `npm run worker` and trigger a
              Slack event to enqueue work.
            </p>
          ) : (
            <Table>
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
                    <TableCell>{job.type}</TableCell>
                    <TableCell>{job.status}</TableCell>
                    <TableCell className="text-right">
                      {job.attempts}/{job.maxAttempts}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(job.runAfter, "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
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
