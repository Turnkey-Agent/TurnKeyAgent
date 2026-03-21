"use client";

import { AlertTriangle, Wrench, Zap, Wind, Package, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import type { Incident, IncidentCategory, Urgency } from "@/lib/types";

interface IncidentCardProps {
  incident: Incident;
  unitNumber: string;
  propertyName: string;
}

const categoryConfig: Record<IncidentCategory, { icon: React.ReactNode; label: string }> = {
  plumbing:   { icon: <Wrench size={14} />,   label: "Plumbing" },
  electrical: { icon: <Zap size={14} />,      label: "Electrical" },
  hvac:       { icon: <Wind size={14} />,      label: "HVAC" },
  appliance:  { icon: <Package size={14} />,   label: "Appliance" },
  structural: { icon: <Building size={14} />,  label: "Structural" },
};

const urgencyConfig: Record<Urgency, { label: string; color: string }> = {
  low:       { label: "Low",       color: "text-gray-400" },
  medium:    { label: "Medium",    color: "text-yellow-400" },
  high:      { label: "High",      color: "text-orange-400" },
  emergency: { label: "Emergency", color: "text-red-400" },
};

export function IncidentCard({ incident, unitNumber, propertyName }: IncidentCardProps) {
  const category = categoryConfig[incident.category];
  const urgency = urgencyConfig[incident.urgency];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[var(--text-muted)] text-xs font-mono">
              {propertyName} — Unit {unitNumber}
            </span>
            <span className="text-[var(--border)]">·</span>
            <span className={cn("text-xs font-medium flex items-center gap-1", urgency.color)}>
              {incident.urgency === "emergency" && <AlertTriangle size={11} />}
              {urgency.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-[var(--text-muted)]", "flex items-center gap-1.5 text-sm")}>
              {category.icon}
              <span className="font-medium text-[var(--text)]">{category.label} Issue</span>
            </span>
          </div>
        </div>

        <StatusBadge status={incident.status} />
      </div>

      {/* Description */}
      <p className="text-sm text-[var(--text-subtle)] mt-3 leading-relaxed">
        {incident.description}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--border-subtle)]">
        <div className="text-[10px] text-[var(--text-muted)]">
          Incident{" "}
          <span className="font-mono text-[var(--text)]">
            #{incident.id.slice(0, 8).toUpperCase()}
          </span>
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">
          Created{" "}
          <span className="text-[var(--text)]">
            {new Date(incident.created_at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
        {(incident.related_maintenance_ids?.length ?? 0) > 0 && (
          <div className="text-[10px] text-blue-400">
            {incident.related_maintenance_ids!.length} similar past issue
            {incident.related_maintenance_ids!.length > 1 ? "s" : ""} found
          </div>
        )}
      </div>
    </div>
  );
}
