"use client";

import { cn } from "@/lib/utils";
import type { IncidentStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  IncidentStatus,
  { label: string; color: string; dot: string }
> = {
  new:              { label: "New",              color: "text-gray-400 bg-gray-500/10 border-gray-500/20",      dot: "bg-gray-400" },
  triaging:         { label: "Triaging",         color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", dot: "bg-yellow-400" },
  quoting:          { label: "Quoting",          color: "text-orange-400 bg-orange-500/10 border-orange-500/20", dot: "bg-orange-400" },
  pending_approval: { label: "Needs Approval",   color: "text-red-400 bg-red-500/10 border-red-500/20",         dot: "bg-red-400" },
  approved:         { label: "Approved",         color: "text-blue-400 bg-blue-500/10 border-blue-500/20",      dot: "bg-blue-400" },
  scheduled:        { label: "Scheduled",        color: "text-purple-400 bg-purple-500/10 border-purple-500/20", dot: "bg-purple-400" },
  in_progress:      { label: "In Progress",      color: "text-green-400 bg-green-500/10 border-green-500/20",   dot: "bg-green-400" },
  resolved:         { label: "Resolved",         color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
};

const ACTIVE_STATES: IncidentStatus[] = [
  "triaging", "quoting", "pending_approval", "approved", "scheduled", "in_progress",
];

interface StatusBadgeProps {
  status: IncidentStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const isActive = ACTIVE_STATES.includes(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        config.color,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      )}
    >
      <span
        className={cn(
          "rounded-full flex-shrink-0",
          config.dot,
          isActive && "live-dot",
          size === "sm" ? "w-1 h-1" : "w-1.5 h-1.5"
        )}
      />
      {config.label}
    </span>
  );
}
