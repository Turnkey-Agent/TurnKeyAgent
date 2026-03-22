"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, History, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PropertyHistoryPanel,
  type PropertyHistoryEntry,
} from "@/components/dashboard/PropertyHistoryPanel";
import { formatCurrency } from "@/lib/utils";

function PropertyHistoryPageContent() {
  const searchParams = useSearchParams();
  const requestedPropertyId = searchParams.get("propertyId");

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState("Loading...");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [unitStatus, setUnitStatus] = useState("");
  const [historyEntries, setHistoryEntries] = useState<PropertyHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const supabase = createClient();
    let isCancelled = false;

    (async () => {
      try {
        const propertyQuery = requestedPropertyId
          ? supabase
              .from("properties")
              .select("id, name, address")
              .eq("id", requestedPropertyId)
              .single()
          : supabase
              .from("properties")
              .select("id, name, address")
              .limit(1)
              .single();

        const { data: prop, error: propError } = await propertyQuery;
        if (propError) throw propError;
        if (!prop || isCancelled) return;

        setPropertyId(prop.id);
        setPropertyName(prop.name);
        setPropertyAddress(prop.address);

        const { data: unit } = await supabase
          .from("units")
          .select("unit_number, status")
          .eq("property_id", prop.id)
          .limit(1)
          .single();

        if (!isCancelled && unit) {
          setUnitNumber(unit.unit_number);
          setUnitStatus(unit.status);
        }
      } catch (error) {
        console.error("Property lookup failed:", error);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [requestedPropertyId]);

  useEffect(() => {
    if (!propertyId) {
      setHistoryEntries([]);
      setHistoryLoading(false);
      return;
    }

    const supabase = createClient();
    let isCancelled = false;

    (async () => {
      setHistoryLoading(true);

      try {
        const [
          { data: incidentsData, error: incidentsError },
          { data: maintenanceData, error: maintenanceError },
        ] = await Promise.all([
          supabase
            .from("incidents")
            .select("id, status, category, description, urgency, created_at, resolved_at")
            .eq("property_id", propertyId)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("maintenance_logs")
            .select("id, category, description, resolution, vendor_name, cost, reported_at, resolved_at")
            .eq("property_id", propertyId)
            .order("reported_at", { ascending: false })
            .limit(30),
        ]);

        if (incidentsError) throw incidentsError;
        if (maintenanceError) throw maintenanceError;

        const locationLabel =
          unitNumber.trim().length > 0
            ? `Unit ${unitNumber}`
            : propertyName !== "Loading..."
              ? propertyName
              : undefined;

        const incidentEntries: PropertyHistoryEntry[] = (incidentsData ?? []).map((entry: any) => ({
          id: `incident-${entry.id}`,
          kind: "incident",
          title: entry.description || "Untitled incident",
          timestamp: entry.resolved_at || entry.created_at,
          summary: entry.urgency
            ? `Urgency ${entry.urgency} and currently ${String(entry.status ?? "new").replace(/_/g, " ")}.`
            : undefined,
          status: String(entry.status ?? "new").replace(/_/g, " "),
          category: entry.category ? String(entry.category) : undefined,
          location: locationLabel,
          isResolved: Boolean(entry.resolved_at),
        }));

        const maintenanceEntries: PropertyHistoryEntry[] = (maintenanceData ?? []).map((entry: any) => {
          const cost = Number(entry.cost);

          return {
            id: `maintenance-${entry.id}`,
            kind: "maintenance",
            title: entry.description || "Maintenance record",
            timestamp: entry.resolved_at || entry.reported_at,
            summary:
              entry.resolution ||
              (entry.vendor_name ? `Handled by ${entry.vendor_name}.` : "Historical maintenance record."),
            status: entry.resolved_at ? "resolved" : "reported",
            category: entry.category ? String(entry.category) : undefined,
            amount: Number.isFinite(cost) ? formatCurrency(cost) : undefined,
            location: locationLabel,
            isResolved: Boolean(entry.resolved_at),
          };
        });

        const combinedHistory = [...incidentEntries, ...maintenanceEntries].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        if (!isCancelled) {
          setHistoryEntries(combinedHistory);
        }
      } catch (error) {
        console.error("Property history fetch failed:", error);
        if (!isCancelled) {
          setHistoryEntries([]);
        }
      } finally {
        if (!isCancelled) {
          setHistoryLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [propertyId, propertyName, unitNumber]);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background-blur)] backdrop-blur px-6 py-3">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
              TK
            </div>
            <span className="text-sm font-semibold text-[var(--text)]">Turnkey Agent</span>
            <span className="text-[var(--border)]">·</span>
            <span className="truncate text-sm text-[var(--text-muted)]">{propertyName}</span>
            <span className="text-[var(--border)]">·</span>
            <span className="text-sm text-[var(--text)]">History</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              <ArrowLeft size={12} />
              <span>Back to dashboard</span>
            </Link>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <History size={16} className="text-blue-400" />
                <h1 className="text-lg font-semibold text-[var(--text)]">Full Property History</h1>
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Historical incidents and maintenance records for the property currently shown in the dashboard.
              </p>
            </div>
            <div className="min-w-[14rem] rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--text-muted)]">
              <p className="font-medium text-[var(--text)]">{propertyAddress || propertyName}</p>
              {unitNumber && <p className="mt-1">Unit {unitNumber} · {unitStatus || "occupied"}</p>}
              <p className="mt-2 flex items-center gap-1.5 text-[var(--text-subtle)]">
                <MapPin size={12} />
                Property-scoped record view
              </p>
            </div>
          </div>
        </section>

        <PropertyHistoryPanel
          loading={historyLoading}
          entries={historyEntries}
          title="Property History"
          subtitle="All incidents and maintenance records currently available for this dashboard property"
        />
      </main>
    </div>
  );
}

function PropertyHistoryPageFallback() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background-blur)] backdrop-blur px-6 py-3">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
            TK
          </div>
          <span className="text-sm font-semibold text-[var(--text)]">Turnkey Agent</span>
          <span className="text-[var(--border)]">·</span>
          <span className="text-sm text-[var(--text-muted)]">History</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
        <div className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
        <div className="h-[30rem] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
      </main>
    </div>
  );
}

export default function PropertyHistoryPage() {
  return (
    <Suspense fallback={<PropertyHistoryPageFallback />}>
      <PropertyHistoryPageContent />
    </Suspense>
  );
}
