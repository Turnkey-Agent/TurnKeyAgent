"use client";

import { X, Wrench, Zap, Wind, Package, Building, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import type { IncidentCategory, IncidentStatus, Urgency } from "@/lib/types";

export interface IssueSummary {
  id: string;
  category: IncidentCategory;
  urgency: Urgency;
  status: IncidentStatus;
  title: string;
  unit: string;
  createdAt: string;
}

interface IssueListPanelProps {
  issues: IssueSummary[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const categoryIcon: Record<IncidentCategory, React.ReactNode> = {
  plumbing: <Wrench size={13} />,
  electrical: <Zap size={13} />,
  hvac: <Wind size={13} />,
  appliance: <Package size={13} />,
  structural: <Building size={13} />,
};

const urgencyColor: Record<Urgency, string> = {
  low: "text-gray-400",
  medium: "text-yellow-400",
  high: "text-orange-400",
  emergency: "text-red-400",
};

export function IssueListPanel({ issues, activeId, onSelect, onClose }: IssueListPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-20" onClick={onClose} />

      {/* Panel */}
      <div className="absolute top-full left-0 right-0 z-30 mt-1 animate-fade-in">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
            <span className="text-[11px] font-semibold text-[var(--text)] uppercase tracking-wider">
              All Issues · Lemon Property
            </span>
            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              <X size={13} />
            </button>
          </div>

          {/* Issue rows */}
          <div className="divide-y divide-[var(--border-subtle)] max-h-72 overflow-y-auto">
            {issues.map((issue) => {
              const isActive = issue.id === activeId;
              return (
                <button
                  key={issue.id}
                  onClick={() => { onSelect(issue.id); onClose(); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]",
                    isActive && "bg-[var(--surface-2)]"
                  )}
                >
                  {/* Active indicator bar */}
                  <div className={cn("w-0.5 h-6 rounded-full flex-shrink-0", isActive ? "bg-blue-400" : "bg-transparent")} />

                  {/* Category icon */}
                  <div className={cn("flex-shrink-0 w-4 flex justify-center", urgencyColor[issue.urgency])}>
                    {categoryIcon[issue.category]}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[var(--text)] truncate">
                        {issue.title}
                      </span>
                      {issue.urgency === "emergency" && (
                        <AlertTriangle size={10} className="text-red-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-[var(--text-muted)]">Unit {issue.unit}</span>
                      <span className="text-[var(--border)] text-[10px]">·</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {new Date(issue.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <StatusBadge status={issue.status} size="sm" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
