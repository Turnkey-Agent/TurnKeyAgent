"use client";

import { AlertTriangle, Clock3, History, MapPin, Wrench, CircleCheckBig } from "lucide-react";
import { cn } from "@/lib/utils";

export type PropertyHistoryEntryKind = "incident" | "maintenance";

export interface PropertyHistoryEntry {
  id: string;
  kind: PropertyHistoryEntryKind;
  title: string;
  timestamp: string;
  summary?: string;
  status?: string;
  category?: string;
  amount?: string;
  location?: string;
  isResolved?: boolean;
}

export interface PropertyHistoryPanelProps {
  loading: boolean;
  entries: PropertyHistoryEntry[];
  className?: string;
  title?: string;
  subtitle?: string;
}

function formatHistoryTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getKindStyles(kind: PropertyHistoryEntryKind) {
  return kind === "incident"
    ? {
        label: "Incident",
        icon: <AlertTriangle size={13} />,
        accent: "text-orange-400",
        chip: "bg-orange-500/10 border-orange-500/20",
      }
    : {
        label: "Maintenance",
        icon: <Wrench size={13} />,
        accent: "text-blue-400",
        chip: "bg-blue-500/10 border-blue-500/20",
      };
}

function HistoryRow({ entry }: { entry: PropertyHistoryEntry }) {
  const kind = getKindStyles(entry.kind);

  return (
    <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3">
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border",
          kind.chip,
          kind.accent
        )}
      >
        {kind.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-[var(--text)]">{entry.title}</p>
              <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider", kind.chip, kind.accent)}>
                {kind.label}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1 font-mono">
                <Clock3 size={10} />
                {formatHistoryTimestamp(entry.timestamp)}
              </span>
              {entry.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={10} />
                  {entry.location}
                </span>
              )}
              {entry.category && <span>{entry.category}</span>}
            </div>
          </div>

          {entry.status && (
            <span className="rounded-full border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
              {entry.status}
            </span>
          )}
        </div>

        {entry.summary && (
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-subtle)]">
            {entry.summary}
          </p>
        )}

        {typeof entry.amount === "string" && entry.amount.trim().length > 0 && (
          <p className="mt-2 text-[10px] text-[var(--text-muted)]">
            Cost {entry.amount}
          </p>
        )}

        {entry.isResolved && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400">
            <CircleCheckBig size={11} />
            Closed
          </div>
        )}
      </div>
    </div>
  );
}

export function PropertyHistoryPanel({
  loading,
  entries,
  className,
  title = "Property History",
  subtitle = "Read-only activity log for the current property",
}: PropertyHistoryPanelProps) {
  const incidentCount = entries.filter((entry) => entry.kind === "incident").length;
  const maintenanceCount = entries.filter((entry) => entry.kind === "maintenance").length;
  const latestEntry = entries[0];

  return (
    <section
      className={cn(
        "flex min-h-[24rem] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-black/20",
        className
      )}
      aria-label="Property history"
    >
      <div className="flex items-start gap-4 border-b border-[var(--border)] px-4 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400">
              <History size={14} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Total</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text)]">{entries.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Incidents</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text)]">{incidentCount}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Maintenance</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text)]">{maintenanceCount}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[var(--text-muted)]">
          <span className="truncate">
            {loading
              ? "Refreshing history..."
              : latestEntry
                ? `Latest update: ${latestEntry.title}`
                : "No history available"}
          </span>
          {!loading && latestEntry && (
            <span className="flex-shrink-0 font-mono">
              {formatHistoryTimestamp(latestEntry.timestamp)}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60" />
            <div className="h-20 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60" />
            <div className="h-20 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] px-6 text-center">
            <History size={18} className="text-[var(--text-muted)]" />
            <p className="mt-3 text-sm font-medium text-[var(--text)]">No history yet</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              Historical incidents and maintenance records will appear here when available.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {entries.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
