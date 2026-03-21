"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import type { IncidentStatus } from "@/lib/types";

export interface PropertyMeta {
  id: string;
  name: string;
  address: string;
  activeUnit: string;
  occupancy: string;
  activeIssueCount: number;
  activeStatus: IncidentStatus;
}

interface PropertySwitcherProps {
  properties: PropertyMeta[];
  selectedId: string;
  onSelect: (id: string) => void;
  relatedIssueCount: number;
}

export function PropertySwitcher({
  properties,
  selectedId,
  onSelect,
  relatedIssueCount,
}: PropertySwitcherProps) {
  const [open, setOpen] = useState(false);
  const selected = properties.find((p) => p.id === selectedId)!;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Header — clickable */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-start justify-between gap-2 px-4 py-3 w-full text-left hover:bg-[var(--surface-2)] transition-colors"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Property
          </span>
          <p className="text-sm font-semibold text-[var(--text)] truncate">{selected.name}</p>
          <p className="text-[11px] text-[var(--text-muted)]">{selected.address}</p>
          <p className="text-[10px] text-[var(--text-muted)]">
            Unit {selected.activeUnit} · {selected.occupancy}
          </p>
          {relatedIssueCount > 0 && (
            <p className="text-[10px] text-blue-400">{relatedIssueCount} similar past issues</p>
          )}
        </div>
        <div className="flex-shrink-0 mt-1 text-[var(--text-muted)]">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Dropdown list */}
      {open && (
        <div className="border-t border-[var(--border)] max-h-56 overflow-y-auto">
          {properties.map((prop) => {
            const isActive = prop.id === selectedId;
            return (
              <button
                key={prop.id}
                onClick={() => { onSelect(prop.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left border-b border-[var(--border-subtle)] last:border-b-0 transition-colors",
                  isActive ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Active dot */}
                  <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", isActive ? "bg-blue-400" : "bg-transparent")} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--text)] truncate">{prop.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">{prop.address}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {prop.activeIssueCount} open issue{prop.activeIssueCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <StatusBadge status={prop.activeStatus} size="sm" />
              </button>
            );
          })}
        </div>
      )}

      {/* Vendor code */}
      <div className="px-4 py-2.5 border-t border-[var(--border-subtle)]">
        <p className="text-[10px] text-[var(--text-muted)]">Vendor code</p>
        <p className="text-xs font-mono text-[var(--text)] tracking-widest">••••</p>
      </div>
    </div>
  );
}
