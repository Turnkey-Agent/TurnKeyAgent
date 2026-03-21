"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIncidentRealtime } from "@/hooks/useIncidentRealtime";
import { ActiveCallsPanel } from "@/components/dashboard/ActiveCallsPanel";
import { GeminiActivityFeed } from "@/components/dashboard/GeminiActivityFeed";
import { IncidentCard } from "@/components/dashboard/IncidentCard";
import { EventTimeline } from "@/components/dashboard/EventTimeline";
import { QuoteComparison } from "@/components/dashboard/QuoteComparison";
import { CallTranscript } from "@/components/dashboard/CallTranscript";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { Incident } from "@/lib/types";

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://localhost:3456";

// ─── Pre-configured issues matching the 10 generated videos ─────────────────
const PRESET_ISSUES = [
  { id: "toilet", icon: "🚽", title: "Toilet Overflow", subtitle: "Bathroom flooding, water on floor", urgency: "Emergency", category: "plumbing", description: "Toilet is overflowing in the bathroom. Water is flooding onto the tile floor and spreading. Guest reports water EVERYWHERE." },
  { id: "flush", icon: "🔧", title: "Broken Flush Handle", subtitle: "Flush handle snapped, can't flush", urgency: "High", category: "plumbing", description: "The toilet flush handle is broken and won't work. Guest has been trying to fix it but the handle just spins. Can't flush at all." },
  { id: "sink", icon: "🍜", title: "Clogged Kitchen Sink", subtitle: "Sink overflowing with standing water", urgency: "High", category: "plumbing", description: "Kitchen sink is completely clogged and overflowing. Standing water rising with dirty dishes piled up. Water about to spill onto the floor." },
  { id: "disposal", icon: "⚙️", title: "Garbage Disposal Grinding", subtitle: "Terrible grinding noise, won't drain", urgency: "Medium", category: "appliance", description: "Garbage disposal is making a terrible grinding noise. Something is stuck in it. Kitchen sink won't drain and there's a burning smell." },
  { id: "ac", icon: "🥵", title: "AC Broken During Heatwave", subtitle: "No cooling, 95°F inside", urgency: "Emergency", category: "hvac", description: "AC completely stopped working during a heatwave. It's 95 degrees outside and the unit is just humming but not cooling. Guest is sweating profusely." },
  { id: "pipe", icon: "💧", title: "Pipe Leak Under Sink", subtitle: "PVC joint dripping, bucket overflowing", urgency: "Emergency", category: "plumbing", description: "Water is leaking from the PVC pipe joint under the bathroom sink. The bucket underneath is overflowing. This is the same pipe that was fixed in October 2024." },
  { id: "electrical", icon: "⚡", title: "Electrical Sparks", subtitle: "Power strip sparking, monitors flickering", urgency: "Emergency", category: "electrical", description: "The power strip with all the laptop chargers just sparked. All the monitors in the room flickered. There's a burning plastic smell." },
  { id: "smoke", icon: "🔔", title: "Smoke Detector Beeping", subtitle: "3am beeping, can't reach it", urgency: "Medium", category: "electrical", description: "Smoke detector has been beeping every 30 seconds since 3am. Battery is dead. Guest can't reach it even standing on a chair." },
  { id: "door", icon: "🚪", title: "Door Lock Jammed", subtitle: "Can't open front door, key stuck", urgency: "High", category: "structural", description: "Front door lock is completely jammed. The key goes in but won't turn. Guest is locked inside and has a pizza delivery waiting outside." },
  { id: "ceiling", icon: "💦", title: "Ceiling Leak", subtitle: "Water dripping onto desk and electronics", urgency: "Emergency", category: "structural", description: "Water is dripping from a brown stain on the ceiling directly onto the desk with monitors and keyboards. Guest is frantically moving laptops." },
];

// ─── Hardcoded for demo: the latest open incident ─────────────────────────────
const DEMO_INCIDENT_ID = process.env.NEXT_PUBLIC_DEMO_INCIDENT_ID ?? null;


export default function DashboardPage() {
  const [incidentId, setIncidentId] = useState<string | null>(DEMO_INCIDENT_ID);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Workflow trigger form
  const [situation, setSituation] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [workflowActive, setWorkflowActive] = useState(false);

  const handleDeployAgent = async (overrideDescription?: string) => {
    const desc = overrideDescription || situation;
    if (!desc.trim()) return;
    if (overrideDescription) setSituation(overrideDescription);
    setDeploying(true);
    try {
      const res = await fetch(`${BRIDGE_URL}/workflow/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situation: desc,
          guestPhone: "+13142990513",    // Ayush
          vendor1Phone: "+12832328091",   // Chow
          vendor2Phone: "+14085812962",   // Arnav
          landlordPhone: "+17654134446",  // Ben
        }),
      });
      const data = await res.json();
      if (data.incidentId) {
        setIncidentId(data.incidentId);
        setWorkflowActive(true);
      }
    } catch (err) {
      console.error("Deploy failed:", err);
    } finally {
      setDeploying(false);
    }
  };

  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - dragStartX.current;
      setSidebarWidth(Math.max(180, Math.min(480, dragStartWidth.current + delta)));
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  const { incident: liveIncident, callLogs, geminiActivity, isLoading } =
    useIncidentRealtime(incidentId);

  const incident = liveIncident;

  // Handle approval — calls bridge to trigger scheduling call
  const handleApprove = async (vendorId: string) => {
    if (!incident) return;

    // Find the vendor phone from the quote
    const quote = incident.quotes.find((q: any) => q.vendor_id === vendorId);
    const vendorPhone = quote?.vendor_phone || "";

    // Call bridge workflow approve endpoint
    try {
      await fetch(`${BRIDGE_URL}/workflow/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: incident.id,
          vendorPhone,
        }),
      });
    } catch (err) {
      console.error("Approval failed:", err);
    }

    // Also update via local API for Supabase
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incident_id: incident.id,
        vendor_id: vendorId,
        approved_by: "Ben (Landlord)",
      }),
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background-blur)] backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
            TK
          </div>
          <span className="text-sm font-semibold text-[var(--text)]">Turnkey Agent</span>
          <span className="text-[var(--border)]">·</span>
          <span className="text-sm text-[var(--text-muted)]">Lemon Property</span>
        </div>
        <div className="flex items-center gap-3">
          {incident && <StatusBadge status={incident.status} />}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>
      </header>

      {/* ── Main layout ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-0">
        {/* Left sidebar */}
        <aside
          style={{ width: sidebarWidth }}
          className="flex-shrink-0 border-r border-[var(--border)] p-4 flex flex-col gap-4 sticky top-[49px] self-start h-[calc(100vh-49px)] overflow-y-auto">
          <ActiveCallsPanel callLogs={callLogs} />
          <GeminiActivityFeed activities={geminiActivity} />

          {/* Property context */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
            <span className="text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
              Property
            </span>
            <div className="text-[11px] text-[var(--text-muted)] space-y-1">
              <p className="text-[var(--text)] font-medium">742 Evergreen Terrace</p>
              <p>Unit 3B · Occupied</p>
              <p className="text-blue-400">
                {incident?.related_maintenance_ids?.length ?? 0} similar past issues
              </p>
            </div>
            <div className="pt-1 border-t border-[var(--border-subtle)]">
              <p className="text-[10px] text-[var(--text-muted)]">Vendor code</p>
              <p className="text-xs font-mono text-[var(--text)] tracking-widest">••••</p>
            </div>
          </div>

        </aside>

        {/* Drag handle */}
        <div
          onMouseDown={onDragStart}
          className="w-1 flex-shrink-0 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors"
        />

        {/* Main content */}
        <main className="flex-1 p-6 flex flex-col gap-4">
          {/* Quick-deploy: 10 pre-configured issues — shown when no active incident */}
          {!incident && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-lg font-semibold text-[var(--text)] mb-2">Deploy Turnkey Agent</h2>
              <p className="text-xs text-[var(--text-muted)] mb-4">Select an issue to start the agent. It will call the guest, dispatch vendors, and get you a recommendation.</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {PRESET_ISSUES.map((issue) => (
                  <button
                    key={issue.id}
                    onClick={() => {
                      setSituation(issue.description);
                      handleDeployAgent(issue.description);
                    }}
                    disabled={deploying}
                    className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] hover:border-blue-500/50 hover:bg-[var(--surface-2)] text-left transition-all disabled:opacity-50 group"
                  >
                    <span className="text-xl flex-shrink-0">{issue.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text)] truncate">{issue.title}</p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">{issue.subtitle}</p>
                    </div>
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 flex-shrink-0">
                      {issue.urgency}
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom input fallback */}
              <div className="flex gap-2">
                <input
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && situation.trim() && handleDeployAgent()}
                  placeholder="Or describe a custom issue..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => handleDeployAgent()}
                  disabled={deploying || !situation.trim()}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-[var(--surface-2)] text-white text-sm font-semibold transition-colors flex-shrink-0"
                >
                  {deploying ? "..." : "Deploy"}
                </button>
              </div>
            </div>
          )}

          {/* Incident card — only when active */}
          {incident && (
            <IncidentCard
              incident={incident}
              unitNumber="3B"
              propertyName="Lemon Property"
            />
          )}

          {/* Loading state after deploy click */}
          {isLoading && !incident && incidentId && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
              <span className="text-sm text-[var(--text-muted)]">Agent deploying — calling guest...</span>
            </div>
          )}

          {/* Live Transcript — always visible */}
          <CallTranscript
            callLogs={incident ? callLogs : []}
            quotes={incident?.quotes ?? []}
            incidentId={incident?.id ?? ""}
            approvedVendorId={incident?.selected_vendor_id ?? null}
            onApprove={handleApprove}
          />

          {/* Timeline — always visible */}
          <EventTimeline events={incident?.timeline ?? []} />
        </main>
      </div>
    </div>
  );
}

