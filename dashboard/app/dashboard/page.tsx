"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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

// ─── Hardcoded for demo: the latest open incident ─────────────────────────────
// In production: fetch from Supabase, select from list, etc.
const DEMO_INCIDENT_ID = process.env.NEXT_PUBLIC_DEMO_INCIDENT_ID ?? null;

// Fallback mock for development before Supabase is wired up
const MOCK_INCIDENT: Incident = {
  id: "mock-1234-5678-abcd",
  property_id: "prop-lemon",
  unit_id: "unit-3b",
  status: "quoting",
  category: "plumbing",
  description:
    "Guest reports water flooding from bathroom. Possible pipe failure under sink. Similar to Oct 2024 incident with PVC joint.",
  guest_phone: "+17654134446",
  urgency: "emergency",
  related_maintenance_ids: ["maint-oct-2024", "maint-jul-2022"],
  quotes: [
    {
      vendor_id: "vendor-plumber1",
      vendor_name: "Mike's Plumbing",
      vendor_phone: "+14085812962",
      vendor_rating: 4.9,
      vendor_jobs_on_property: 12,
      amount: 300,
      eta_days: 2,
      recommended: true,
      call_transcript:
        "[Agent]: Hi Mike, emergency pipe leak at 742 Evergreen Terrace, Unit 3B.\n[Vendor]: Yeah I know that place. PVC under the sink again?\n[Agent]: Likely. Quote and availability?\n[Vendor]: $300, Wednesday morning.",
    },
    {
      vendor_id: "vendor-plumber2",
      vendor_name: "Derek & Sons",
      vendor_phone: "+13142990513",
      vendor_rating: 4.2,
      vendor_jobs_on_property: 3,
      amount: 1000,
      eta_days: 5,
      recommended: false,
    },
  ],
  selected_vendor_id: null,
  approved_by: null,
  approved_at: null,
  scheduled_at: null,
  resolved_at: null,
  timeline: [
    {
      timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
      event: "Guest call received (angry)",
      details: "Caller reported water flooding from bathroom",
      model: "gemini-2.5-flash-native-audio",
    },
    {
      timestamp: new Date(Date.now() - 7 * 60000).toISOString(),
      event: "Searched 5-year maintenance history",
      details: "Found 3 similar plumbing records: Oct 2024, Jul 2022, Jan 2022",
      model: "gemini-embedding-2",
    },
    {
      timestamp: new Date(Date.now() - 6 * 60000).toISOString(),
      event: "Dispatched parallel vendor calls",
      details: "Calling Mike's Plumbing and Derek & Sons simultaneously",
      model: "gemini-2.5-flash-native-audio",
    },
    {
      timestamp: new Date(Date.now() - 4 * 60000).toISOString(),
      event: "Quote received: Mike's Plumbing — $300 / 2 days",
      model: "gemini-2.5-flash-native-audio",
    },
    {
      timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
      event: "Quote received: Derek & Sons — $1,000 / 5 days",
      model: "gemini-2.5-flash-native-audio",
    },
    {
      timestamp: new Date(Date.now() - 1 * 60000).toISOString(),
      event: "AI recommendation generated",
      details: "Mike's Plumbing: 70% cheaper, 3 days faster, 12 prior jobs on property",
      model: "gemini-3.1-flash",
    },
  ],
  created_at: new Date(Date.now() - 9 * 60000).toISOString(),
};

export default function DashboardPage() {
  const [incidentId, setIncidentId] = useState<string | null>(DEMO_INCIDENT_ID);
  const [useMock, setUseMock] = useState(!DEMO_INCIDENT_ID);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

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

  // If no env var set, use mock data so dashboard renders immediately
  const incident = useMock ? MOCK_INCIDENT : liveIncident;

  // Handle approval
  const handleApprove = async (vendorId: string) => {
    if (!incident) return;

    const res = await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incident_id: incident.id,
        vendor_id: vendorId,
        approved_by: "Ben (Landlord)",
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Approval failed:", err);
    }
  };

  if (!incident) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#6b7280]">
            {isLoading ? "Loading incident..." : "No active incidents"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-[#2a2a3a] bg-[#0a0a0f]/80 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
            TK
          </div>
          <span className="text-sm font-semibold text-[#e8e8f0]">Turnkey Agent</span>
          <span className="text-[#2a2a3a]">·</span>
          <span className="text-sm text-[#6b7280]">Lemon Property</span>
        </div>
        <StatusBadge status={incident.status} />
      </header>

      {/* ── Main layout ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-0">
        {/* Left sidebar */}
        <aside
          style={{ width: sidebarWidth }}
          className="flex-shrink-0 border-r border-[#2a2a3a] p-4 flex flex-col gap-4 sticky top-[49px] self-start h-[calc(100vh-49px)] overflow-y-auto">
          <ActiveCallsPanel callLogs={useMock ? MOCK_CALL_LOGS : callLogs} />
          <GeminiActivityFeed activities={useMock ? MOCK_GEMINI_ACTIVITY : geminiActivity} />

          {/* Property context */}
          <div className="rounded-xl border border-[#2a2a3a] bg-[#111118] p-4 flex flex-col gap-2">
            <span className="text-xs font-semibold text-[#e8e8f0] uppercase tracking-wider">
              Property
            </span>
            <div className="text-[11px] text-[#6b7280] space-y-1">
              <p className="text-[#e8e8f0] font-medium">742 Evergreen Terrace</p>
              <p>Unit 3B · Occupied</p>
              <p className="text-blue-400">
                {incident.related_maintenance_ids.length} similar past issues
              </p>
            </div>
            <div className="pt-1 border-t border-[#1a1a24]">
              <p className="text-[10px] text-[#6b7280]">Vendor code</p>
              <p className="text-xs font-mono text-[#e8e8f0] tracking-widest">••••</p>
            </div>
          </div>

          {useMock && (
            <div className="text-[10px] text-[#6b7280] text-center px-2">
              Mock data — set{" "}
              <code className="text-blue-400">NEXT_PUBLIC_DEMO_INCIDENT_ID</code> to use live Supabase
            </div>
          )}
        </aside>

        {/* Drag handle */}
        <div
          onMouseDown={onDragStart}
          className="w-1 flex-shrink-0 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors"
        />

        {/* Main content */}
        <main className="flex-1 p-6 flex flex-col gap-4">
          <IncidentCard
            incident={incident}
            unitNumber="3B"
            propertyName="Lemon Property"
          />

          <EventTimeline events={incident.timeline} />

          {incident.quotes.length > 0 && (
            <QuoteComparison
              quotes={incident.quotes}
              incidentId={incident.id}
              approvedVendorId={incident.selected_vendor_id}
              onApprove={handleApprove}
            />
          )}

          <CallTranscript callLogs={useMock ? MOCK_CALL_LOGS : callLogs} />
        </main>
      </div>
    </div>
  );
}

// ─── Mock data for local dev before Supabase is wired ────────────────────────
import type { CallLog, GeminiActivity } from "@/lib/types";

const MOCK_CALL_LOGS: CallLog[] = [
  {
    id: "call-1",
    incident_id: "mock-1234-5678-abcd",
    direction: "inbound",
    participant_type: "guest",
    participant_name: "Ayush (Guest)",
    participant_phone: "+13142990513",
    twilio_call_sid: "CA000001",
    duration_seconds: 142,
    transcript:
      "[Guest]: There's water EVERYWHERE. The bathroom is flooding!\n[Agent]: I understand, let me look into this immediately. Can you confirm the issue is under the sink?\n[Guest]: Yes, water is spraying from the pipes.\n[Agent]: I see a similar incident from October 2024. I'm calling plumbers now.",
    summary: "Flooding in bathroom, possible PVC pipe failure",
    sentiment: "angry",
    status: "completed",
    created_at: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    id: "call-2",
    incident_id: "mock-1234-5678-abcd",
    direction: "outbound",
    participant_type: "vendor",
    participant_name: "Mike's Plumbing",
    participant_phone: "+14085812962",
    twilio_call_sid: "CA000002",
    duration_seconds: 74,
    transcript:
      "[Agent]: Hi Mike, emergency pipe leak at 742 Evergreen Terrace, Unit 3B.\n[Vendor]: Yeah I know that place. PVC under the sink again?\n[Agent]: Likely. Quote and availability?\n[Vendor]: $300, Wednesday morning.",
    summary: "$300 quote, available Wednesday AM",
    sentiment: "positive",
    status: "completed",
    created_at: new Date(Date.now() - 4 * 60000).toISOString(),
  },
  {
    id: "call-3",
    incident_id: "mock-1234-5678-abcd",
    direction: "outbound",
    participant_type: "vendor",
    participant_name: "Derek & Sons",
    participant_phone: "+17654134446",
    twilio_call_sid: "CA000003",
    duration_seconds: 58,
    transcript:
      "[Agent]: Emergency plumbing at 742 Evergreen Terrace. Can you quote a PVC joint repair?\n[Vendor]: Earliest I can do is 5 days, $1000.\n[Agent]: Noted, thank you.",
    summary: "$1,000 quote, 5 days out",
    sentiment: "neutral",
    status: "completed",
    created_at: new Date(Date.now() - 2 * 60000).toISOString(),
  },
];

const MOCK_GEMINI_ACTIVITY: GeminiActivity[] = [
  {
    id: "ga-1",
    model: "gemini-2.5-flash-native-audio",
    status: "done",
    label: "Handled inbound guest call",
    result: "Identified emergency pipe leak, extracted issue details",
    timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    id: "ga-2",
    model: "gemini-embedding-2",
    status: "done",
    label: "Searched 5-year maintenance history",
    result: "Found 3 similar records (Oct 2024, Jul 2022, Jan 2022)",
    timestamp: new Date(Date.now() - 7 * 60000).toISOString(),
  },
  {
    id: "ga-3",
    model: "gemini-2.5-flash-native-audio",
    status: "done",
    label: "Parallel vendor calls (×2 simultaneous)",
    result: "Mike: $300/2d · Derek: $1000/5d",
    timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
  },
  {
    id: "ga-4",
    model: "gemini-3.1-flash",
    status: "active",
    label: "Analyzing quotes for recommendation",
    result: undefined,
    timestamp: new Date(Date.now() - 1 * 60000).toISOString(),
  },
];
