import { formatDistanceToNow } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUsd } from "@/lib/db";
import type { UsageRecord } from "@/lib/shell-data";

interface UsageTableProps {
  rows: UsageRecord[];
}

export function UsageTable({ rows }: UsageTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Workflow</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Tokens</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead className="text-right">Observed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div>
                <p className="font-medium">{row.workflow}</p>
                <p className="text-xs text-muted-foreground">{row.project}</p>
              </div>
            </TableCell>
            <TableCell>{row.client}</TableCell>
            <TableCell>{row.user}</TableCell>
            <TableCell>{row.channel}</TableCell>
            <TableCell>
              <div>
                <p className="font-medium">{row.provider}</p>
                <p className="text-xs text-muted-foreground">{row.model}</p>
              </div>
            </TableCell>
            <TableCell>
              {Intl.NumberFormat("en-US").format(
                row.promptTokens + row.completionTokens,
              )}
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatUsd(row.totalCost)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatDistanceToNow(row.occurredAt, { addSuffix: true })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
