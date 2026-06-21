import { formatSmallUsd } from "@/lib/db/costs";

export function truncateMiddle(
  value: string | null | undefined,
  head = 8,
  tail = 4,
): string {
  if (!value) {
    return "—";
  }

  if (value.length <= head + tail + 1) {
    return value;
  }

  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function formatNumber(value: number): string {
  return Intl.NumberFormat("en-US").format(value);
}

export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatTinyUsd(value: number): string {
  return formatSmallUsd(value);
}
