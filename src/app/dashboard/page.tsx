"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIncidentRealtime } from "@/hooks/useIncidentRealtime";
import { ActiveCallsPanel } from "@/components/dashboard/ActiveCallsPanel";
import { GeminiActivityFeed } from "@/components/dashboard/GeminiActivityFeed";
import { IncidentCard } from "@/components/dashboard/IncidentCard";
import { EventTimeline } from "@/components/dashboard/EventTimeline";
import { CallTranscript } from "@/components/dashboard/CallTranscript";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { IssueListPanel, type IssueSummary } from "@/components/dashboard/IssueListPanel";
import { PropertySwitcher, type PropertyMeta } from "@/components/dashboard/PropertySwitcher";
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

// ─── Mock incidents for other properties ─────────────────────────────────────
const MOCK_INCIDENT_MAPLE: Incident = {
  id: "mock-maple-0001",
  property_id: "prop-maple",
  unit_id: "unit-2a",
  status: "in_progress",
  category: "electrical",
  description: "Kitchen circuit breaker tripping repeatedly. Tenant reports flickering lights and two outlets dead near the range hood.",
  guest_phone: "+14089990001",
  urgency: "high",
  related_maintenance_ids: ["maint-maple-2023"],
  quotes: [
    {
      vendor_id: "vendor-elec1",
      vendor_name: "City Electric Co.",
      vendor_phone: "+14081112222",
      vendor_rating: 4.7,
      vendor_jobs_on_property: 5,
      amount: 220,
      eta_days: 1,
      recommended: true,
    },
  ],
  selected_vendor_id: "vendor-elec1",
  approved_by: "Ben (Landlord)",
  approved_at: new Date(Date.now() - 30 * 60000).toISOString(),
  scheduled_at: null,
  resolved_at: null,
  timeline: [
    { timestamp: new Date(Date.now() - 120 * 60000).toISOString(), event: "Guest call received", details: "Tenant reported flickering lights and dead outlets", model: "gemini-2.5-flash-native-audio" },
    { timestamp: new Date(Date.now() - 110 * 60000).toISOString(), event: "Searched maintenance history", details: "Found 1 prior electrical record (2023)", model: "gemini-embedding-2" },
    { timestamp: new Date(Date.now() - 100 * 60000).toISOString(), event: "Vendor quote received: City Electric Co. — $220 / 1 day", model: "gemini-2.5-flash-native-audio" },
    { timestamp: new Date(Date.now() - 30 * 60000).toISOString(), event: "Vendor approved by landlord", details: "City Electric Co. dispatched" },
  ],
  created_at: new Date(Date.now() - 125 * 60000).toISOString(),
};

const MOCK_INCIDENT_SUNRISE: Incident = {
  id: "mock-sunrise-0001",
  property_id: "prop-sunrise",
  unit_id: "unit-7f",
  status: "scheduled",
  category: "hvac",
  description: "AC unit in Unit 7F unable to cool below 80°F. Tenant has been without adequate cooling for 3 days. Filter replaced but issue persists — likely compressor.",
  guest_phone: "+14087770003",
  urgency: "medium",
  related_maintenance_ids: [],
  quotes: [
    {
      vendor_id: "vendor-hvac1",
      vendor_name: "CoolAir Services",
      vendor_phone: "+14083334444",
      vendor_rating: 4.5,
      vendor_jobs_on_property: 2,
      amount: 480,
      eta_days: 3,
      recommended: true,
    },
  ],
  selected_vendor_id: "vendor-hvac1",
  approved_by: "Ben (Landlord)",
  approved_at: new Date(Date.now() - 60 * 60000).toISOString(),
  scheduled_at: new Date(Date.now() + 2 * 24 * 60 * 60000).toISOString(),
  resolved_at: null,
  timeline: [
    { timestamp: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(), event: "Guest call received", details: "Tenant reported AC not cooling below 80°F", model: "gemini-2.5-flash-native-audio" },
    { timestamp: new Date(Date.now() - 3 * 24 * 60 * 60000 + 5 * 60000).toISOString(), event: "Filter check performed remotely", details: "Agent guided tenant through filter replacement — issue persists", model: "gemini-3.1-flash" },
    { timestamp: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(), event: "Vendor quote received: CoolAir Services — $480 / 3 days", model: "gemini-2.5-flash-native-audio" },
    { timestamp: new Date(Date.now() - 60 * 60000).toISOString(), event: "Appointment scheduled", details: "CoolAir Services arriving in 2 days" },
  ],
  created_at: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(),
};

// ─── Lemon Property — per-issue mock incidents ────────────────────────────────

const MOCK_INCIDENT_LEMON_ELEC: Incident = {
  id: "lemon-issue-2",
  property_id: "prop-lemon",
  unit_id: "unit-2a",
  status: "in_progress",
  category: "electrical",
  description: "Kitchen circuit breaker tripping repeatedly. Tenant reports flickering lights and two dead outlets near the range hood.",
  guest_phone: "+15551234001",
  urgency: "high",
  related_maintenance_ids: [],
  quotes: [{ vendor_id: "vendor-elec2", vendor_name: "Spark Electric", vendor_phone: "+15559990001", vendor_rating: 4.6, vendor_jobs_on_property: 3, amount: 185, eta_days: 1, recommended: true }],
  selected_vendor_id: "vendor-elec2",
  approved_by: "Ben (Landlord)",
  approved_at: new Date(Date.now() - 90 * 60000).toISOString(),
  scheduled_at: null,
  resolved_at: null,
  timeline: [
    { timestamp: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(), event: "Guest call received", details: "Flickering lights and dead outlets reported", model: "gemini-2.5-flash-native-audio" },
    { timestamp: new Date(Date.now() - 2 * 24 * 60 * 60000 + 5 * 60000).toISOString(), event: "Searched maintenance history", details: "No prior electrical issues found", model: "gemini-embedding-2" },
    { timestamp: new Date(Date.now() - 2 * 24 * 60 * 60000 + 10 * 60000).toISOString(), event: "Quote received: Spark Electric — $185 / 1 day", model: "gemini-2.5-flash-native-audio" },
    { timestamp: new Date(Date.now() - 90 * 60000).toISOString(), event: "Vendor approved by landlord", details: "Spark Electric dispatched" },
  ],
  created_at: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(),
};

const MOCK_CALL_LOGS_LEMON_ELEC: CallLog[] = [
  { id: "elec-call-1", incident_id: "lemon-issue-2", direction: "inbound", participant_type: "guest", participant_name: "Marcus (Tenant)", participant_phone: "+15551234001", twilio_call_sid: "CD000001", duration_seconds: 88, transcript: "[Guest]: Hey, the kitchen lights have been flickering all morning and two outlets don't work.\n[Agent]: Got it. Is this near the range hood area?\n[Guest]: Yeah, exactly. I'm worried it might be a fire hazard.\n[Agent]: Understood. I'll dispatch an electrician right away.", summary: "Flickering lights, dead outlets near range hood", sentiment: "negative", status: "completed", created_at: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString() },
  { id: "elec-call-2", incident_id: "lemon-issue-2", direction: "outbound", participant_type: "vendor", participant_name: "Spark Electric", participant_phone: "+15559990001", twilio_call_sid: "CD000002", duration_seconds: 45, transcript: "[Agent]: Hi, I have an electrical issue at 742 Evergreen Terrace, Unit 2A — tripping breaker and dead outlets.\n[Vendor]: Sounds like a circuit overload. We can be there tomorrow, $185.\n[Agent]: Perfect, I'll confirm with the landlord.", summary: "$185 quote, available next day", sentiment: "positive", status: "completed", created_at: new Date(Date.now() - 2 * 24 * 60 * 60000 + 10 * 60000).toISOString() },
];

const MOCK_INCIDENT_LEMON_STRUCT: Incident = {
  id: "lemon-issue-3",
  property_id: "prop-lemon",
  unit_id: "unit-4a",
  status: "pending_approval",
  category: "structural",
  description: "Visible crack in the exterior wall of Unit 4A, approximately 12 inches long. Tenant concerned about water intrusion.",
  guest_phone: "+15552345002",
  urgency: "high",
  related_maintenance_ids: [],
  quotes: [
    { vendor_id: "vendor-struct1", vendor_name: "SolidBuild Contractors", vendor_phone: "+15558880001", vendor_rating: 4.8, vendor_jobs_on_property: 1, amount: 750, eta_days: 4, recommended: true },
    { vendor_id: "vendor-struct2", vendor_name: "QuickFix Repairs", vendor_phone: "+15558880002", vendor_rating: 4.1, vendor_jobs_on_property: 0, amount: 600, eta_days: 7, recommended: false },
  ],
  selected_vendor_id: null,
  approved_by: null,
  approved_at: null,
  scheduled_at: null,
  resolved_at: null,
  timeline: [
    { timestamp: new Date(Date.now() - 24 * 60 * 60000).toISOString(), event: "Guest call received", details: "Tenant reported exterior wall crack", model: "gemini-2.5-flash-native-audio" },
    { timestamp: new Date(Date.now() - 23 * 60 * 60000).toISOString(), event: "Searched maintenance history", details: "No prior structural work on this unit", model: "gemini-embedding-2" },
    { timestamp: new Date(Date.now() - 22 * 60 * 60000).toISOString(), event: "Dispatched parallel contractor calls", details: "Calling SolidBuild and QuickFix simultaneously", model: "gemini-2.5-flash-native-audio" },
    { timestamp: new Date(Date.now() - 20 * 60 * 60000).toISOString(), event: "Quote received: SolidBuild Contractors — $750 / 4 days", model: "gemini-2.5-flash-native-audio" },
    { timestamp: new Date(Date.now() - 18 * 60 * 60000).toISOString(), event: "Quote received: QuickFix Repairs — $600 / 7 days", model: "gemini-2.5-flash-native-audio" },
    { timestamp: new Date(Date.now() - 17 * 60 * 60000).toISOString(), event: "AI recommendation generated", details: "SolidBuild: faster timeline, higher rating, prior property experience", model: "gemini-3.1-flash" },
  ],
  created_at: new Date(Date.now() - 24 * 60 * 60000).toISOString(),
};

const MOCK_CALL_LOGS_LEMON_STRUCT: CallLog[] = [
  { id: "struct-call-1", incident_id: "lemon-issue-3", direction: "inbound", participant_type: "guest", participant_name: "Nina (Tenant)", participant_phone: "+15552345002", twilio_call_sid: "CE000001", duration_seconds: 76, transcript: "[Guest]: There's a crack in the wall outside my unit. It wasn't there last month.\n[Agent]: How long is it approximately? Any signs of moisture?\n[Guest]: About a foot long. No water yet but I'm worried.\n[Agent]: I'll get contractors out to assess and quote the repair.", summary: "Exterior wall crack, ~12 inches, no moisture yet", sentiment: "negative", status: "completed", created_at: new Date(Date.now() - 24 * 60 * 60000).toISOString() },
  { id: "struct-call-2", incident_id: "lemon-issue-3", direction: "outbound", participant_type: "vendor", participant_name: "SolidBuild Contractors", participant_phone: "+15558880001", twilio_call_sid: "CE000002", duration_seconds: 52, transcript: "[Agent]: Hi, I need a structural repair quote at 742 Evergreen Terrace, Unit 4A — exterior wall crack.\n[Vendor]: We can assess and repair. $750, available in 4 days.\n[Agent]: Thank you, noted.", summary: "$750 quote, 4 days out", sentiment: "positive", status: "completed", created_at: new Date(Date.now() - 22 * 60 * 60000).toISOString() },
  { id: "struct-call-3", incident_id: "lemon-issue-3", direction: "outbound", participant_type: "vendor", participant_name: "QuickFix Repairs", participant_phone: "+15558880002", twilio_call_sid: "CE000003", duration_seconds: 38, transcript: "[Agent]: Exterior wall crack repair needed at 742 Evergreen Terrace, Unit 4A.\n[Vendor]: Earliest we can do is 7 days. $600.\n[Agent]: Noted, thank you.", summary: "$600 quote, 7 days out", sentiment: "neutral", status: "completed", created_at: new Date(Date.now() - 22 * 60 * 60000 + 5 * 60000).toISOString() },
];

const MOCK_INCIDENT_LEMON_APPL: Incident = {
  id: "lemon-issue-4",
  property_id: "prop-lemon",
  unit_id: "unit-1d",
  status: "resolved",
  category: "appliance",
  description: "Dishwasher not draining after cycle. Standing water remains in tub. Tenant confirmed filter was cleaned.",
  guest_phone: "+15553456003",
  urgency: "low",
  related_maintenance_ids: [],
  quotes: [{ vendor_id: "vendor-appl1", vendor_name: "Home Appliance Pro", vendor_phone: "+15556660001", vendor_rating: 4.4, vendor_jobs_on_property: 2, amount: 120, eta_days: 2, recommended: true }],
  selected_vendor_id: "vendor-appl1",
  approved_by: "Ben (Landlord)",
  approved_at: new Date(Date.now() - 12 * 24 * 60 * 60000).toISOString(),
  scheduled_at: new Date(Date.now() - 11 * 24 * 60 * 60000).toISOString(),
  resolved_at: new Date(Date.now() - 10 * 24 * 60 * 60000).toISOString(),
  timeline: [
    { timestamp: new Date(Date.now() - 12 * 24 * 60 * 60000 - 2 * 60 * 60000).toISOString(), event: "Guest call received", details: "Dishwasher not draining after cycle", model: "gemini-2.5-flash-native-audio" },
    { timestamp: new Date(Date.now() - 12 * 24 * 60 * 60000 - 60 * 60000).toISOString(), event: "Quote received: Home Appliance Pro — $120 / 2 days", model: "gemini-2.5-flash-native-audio" },
    { timestamp: new Date(Date.now() - 12 * 24 * 60 * 60000).toISOString(), event: "Vendor approved by landlord" },
    { timestamp: new Date(Date.now() - 10 * 24 * 60 * 60000).toISOString(), event: "Issue resolved", details: "Drain pump replaced. Dishwasher working normally." },
  ],
  created_at: new Date(Date.now() - 12 * 24 * 60 * 60000 - 2 * 60 * 60000).toISOString(),
};

const MOCK_CALL_LOGS_LEMON_APPL: CallLog[] = [
  { id: "appl-call-1", incident_id: "lemon-issue-4", direction: "inbound", participant_type: "guest", participant_name: "Leo (Tenant)", participant_phone: "+15553456003", twilio_call_sid: "CF000001", duration_seconds: 62, transcript: "[Guest]: The dishwasher isn't draining. There's water sitting at the bottom.\n[Agent]: Did you already check and clean the filter?\n[Guest]: Yes, filter is clean. Still not draining.\n[Agent]: Likely a pump issue. I'll get a technician scheduled.", summary: "Dishwasher not draining, filter already checked", sentiment: "neutral", status: "completed", created_at: new Date(Date.now() - 12 * 24 * 60 * 60000 - 2 * 60 * 60000).toISOString() },
];

// ─── Property directory ───────────────────────────────────────────────────────
import type { CallLog, GeminiActivity } from "@/lib/types";

interface IssueData {
  incident: Incident;
  callLogs: CallLog[];
}

interface PropertyData {
  meta: PropertyMeta;
  defaultIssueId: string;
  issues: IssueSummary[];
  issueData: Record<string, IssueData>;
}

const MOCK_PROPERTIES_DATA: PropertyData[] = [
  {
    meta: { id: "prop-lemon", name: "Lemon Property", address: "742 Evergreen Terrace", activeUnit: "3B", occupancy: "Occupied", activeIssueCount: 3, activeStatus: "quoting" },
    defaultIssueId: "mock-1234-5678-abcd",
    issues: [
      { id: "mock-1234-5678-abcd", category: "plumbing", urgency: "emergency", status: "quoting", title: "Water flooding from bathroom", unit: "3B", createdAt: new Date(Date.now() - 9 * 60000).toISOString() },
      { id: "lemon-issue-2", category: "electrical", urgency: "high", status: "in_progress", title: "Tripped breaker in kitchen", unit: "2A", createdAt: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString() },
      { id: "lemon-issue-3", category: "structural", urgency: "high", status: "pending_approval", title: "Crack in exterior wall", unit: "4A", createdAt: new Date(Date.now() - 1 * 24 * 60 * 60000).toISOString() },
      { id: "lemon-issue-4", category: "appliance", urgency: "low", status: "resolved", title: "Dishwasher not draining", unit: "1D", createdAt: new Date(Date.now() - 10 * 24 * 60 * 60000).toISOString() },
    ],
    issueData: {
      "mock-1234-5678-abcd": {
        incident: MOCK_INCIDENT,
        callLogs: [
          { id: "call-1", incident_id: "mock-1234-5678-abcd", direction: "inbound", participant_type: "guest", participant_name: "Ayush (Guest)", participant_phone: "+13142990513", twilio_call_sid: "CA000001", duration_seconds: 142, transcript: "[Guest]: There's water EVERYWHERE. The bathroom is flooding!\n[Agent]: I understand, let me look into this immediately. Can you confirm the issue is under the sink?\n[Guest]: Yes, water is spraying from the pipes.\n[Agent]: I see a similar incident from October 2024. I'm calling plumbers now.", summary: "Flooding in bathroom, possible PVC pipe failure", sentiment: "angry", status: "completed", created_at: new Date(Date.now() - 8 * 60000).toISOString() },
          { id: "call-2", incident_id: "mock-1234-5678-abcd", direction: "outbound", participant_type: "vendor", participant_name: "Mike's Plumbing", participant_phone: "+14085812962", twilio_call_sid: "CA000002", duration_seconds: 74, transcript: "[Agent]: Hi Mike, emergency pipe leak at 742 Evergreen Terrace, Unit 3B.\n[Vendor]: Yeah I know that place. PVC under the sink again?\n[Agent]: Likely. Quote and availability?\n[Vendor]: $300, Wednesday morning.", summary: "$300 quote, available Wednesday AM", sentiment: "positive", status: "completed", created_at: new Date(Date.now() - 4 * 60000).toISOString() },
          { id: "call-3", incident_id: "mock-1234-5678-abcd", direction: "outbound", participant_type: "vendor", participant_name: "Derek & Sons", participant_phone: "+17654134446", twilio_call_sid: "CA000003", duration_seconds: 58, transcript: "[Agent]: Emergency plumbing at 742 Evergreen Terrace. Can you quote a PVC joint repair?\n[Vendor]: Earliest I can do is 5 days, $1000.\n[Agent]: Noted, thank you.", summary: "$1,000 quote, 5 days out", sentiment: "neutral", status: "completed", created_at: new Date(Date.now() - 2 * 60000).toISOString() },
        ],
      },
      "lemon-issue-2": { incident: MOCK_INCIDENT_LEMON_ELEC, callLogs: MOCK_CALL_LOGS_LEMON_ELEC },
      "lemon-issue-3": { incident: MOCK_INCIDENT_LEMON_STRUCT, callLogs: MOCK_CALL_LOGS_LEMON_STRUCT },
      "lemon-issue-4": { incident: MOCK_INCIDENT_LEMON_APPL, callLogs: MOCK_CALL_LOGS_LEMON_APPL },
    },
  },
  {
    meta: { id: "prop-maple", name: "Maple Gardens", address: "156 Maple Avenue", activeUnit: "2A", occupancy: "Occupied", activeIssueCount: 1, activeStatus: "in_progress" },
    defaultIssueId: "mock-maple-0001",
    issues: [
      { id: "mock-maple-0001", category: "electrical", urgency: "high", status: "in_progress", title: "Tripped breaker — kitchen dead outlets", unit: "2A", createdAt: new Date(Date.now() - 125 * 60000).toISOString() },
      { id: "maple-issue-2", category: "plumbing", urgency: "low", status: "resolved", title: "Slow drain in Unit 3B bathroom", unit: "3B", createdAt: new Date(Date.now() - 15 * 24 * 60 * 60000).toISOString() },
    ],
    issueData: {
      "mock-maple-0001": {
        incident: MOCK_INCIDENT_MAPLE,
        callLogs: [
          { id: "maple-call-1", incident_id: "mock-maple-0001", direction: "inbound", participant_type: "guest", participant_name: "Jordan (Tenant)", participant_phone: "+14089990001", twilio_call_sid: "CB000001", duration_seconds: 98, transcript: "[Guest]: Hi, the kitchen lights keep flickering and two outlets stopped working.\n[Agent]: Thanks for calling. Is the range hood outlet also affected?\n[Guest]: Yes, that one too. I haven't touched the breaker panel.\n[Agent]: I'll check the maintenance history and dispatch an electrician.", summary: "Flickering lights and dead outlets near range hood", sentiment: "negative", status: "completed", created_at: new Date(Date.now() - 120 * 60000).toISOString() },
          { id: "maple-call-2", incident_id: "mock-maple-0001", direction: "outbound", participant_type: "vendor", participant_name: "City Electric Co.", participant_phone: "+14081112222", twilio_call_sid: "CB000002", duration_seconds: 55, transcript: "[Agent]: Hi, I need an electrician at 156 Maple Avenue, Unit 2A — tripped circuit, dead outlets.\n[Vendor]: We can be there tomorrow morning. $220 for diagnosis and fix.\n[Agent]: Confirmed, I'll let the landlord know.", summary: "$220 quote, available next morning", sentiment: "positive", status: "completed", created_at: new Date(Date.now() - 100 * 60000).toISOString() },
        ],
      },
      "maple-issue-2": {
        incident: { ...MOCK_INCIDENT_MAPLE, id: "maple-issue-2", status: "resolved", category: "plumbing", urgency: "low", description: "Slow drain in Unit 3B bathroom. Tenant reported water pooling. Resolved with drain clearing.", quotes: [], selected_vendor_id: null, resolved_at: new Date(Date.now() - 10 * 24 * 60 * 60000).toISOString(), timeline: [{ timestamp: new Date(Date.now() - 15 * 24 * 60 * 60000).toISOString(), event: "Guest call received", details: "Slow drain in bathroom reported", model: "gemini-2.5-flash-native-audio" }, { timestamp: new Date(Date.now() - 14 * 24 * 60 * 60000).toISOString(), event: "Agent guided drain clearing", details: "Tenant used plunger — issue resolved" }] },
        callLogs: [{ id: "maple-drain-call", incident_id: "maple-issue-2", direction: "inbound", participant_type: "guest", participant_name: "Jordan (Tenant)", participant_phone: "+14089990001", twilio_call_sid: "CB000003", duration_seconds: 40, transcript: "[Guest]: The bathroom drain is really slow, water is pooling.\n[Agent]: Let's try plunging it first. Do you have a plunger available?\n[Guest]: Yes, trying now... it worked!\n[Agent]: Great, the drain is clear. Let me know if it recurs.", summary: "Drain cleared with plunger, resolved", sentiment: "positive", status: "completed", created_at: new Date(Date.now() - 15 * 24 * 60 * 60000).toISOString() }],
      },
    },
  },
  {
    meta: { id: "prop-sunrise", name: "Sunrise Apartments", address: "890 Sunrise Boulevard", activeUnit: "7F", occupancy: "Occupied", activeIssueCount: 1, activeStatus: "scheduled" },
    defaultIssueId: "mock-sunrise-0001",
    issues: [
      { id: "mock-sunrise-0001", category: "hvac", urgency: "medium", status: "scheduled", title: "AC not cooling below 80°F", unit: "7F", createdAt: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString() },
      { id: "sunrise-issue-2", category: "appliance", urgency: "low", status: "resolved", title: "Oven igniter not working", unit: "2C", createdAt: new Date(Date.now() - 20 * 24 * 60 * 60000).toISOString() },
    ],
    issueData: {
      "mock-sunrise-0001": {
        incident: MOCK_INCIDENT_SUNRISE,
        callLogs: [
          { id: "sunrise-call-1", incident_id: "mock-sunrise-0001", direction: "inbound", participant_type: "guest", participant_name: "Priya (Tenant)", participant_phone: "+14087770003", twilio_call_sid: "CC000001", duration_seconds: 115, transcript: "[Guest]: It's been 3 days and the AC won't go below 80. I already replaced the filter.\n[Agent]: I'm sorry to hear that. Filter replacement didn't resolve it — likely a compressor issue. Let me get a technician scheduled.\n[Guest]: Please, it's really hot in here.\n[Agent]: Understood. I'll have someone out within 3 days.", summary: "AC compressor suspected, tenant without cooling for 3 days", sentiment: "negative", status: "completed", created_at: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString() },
          { id: "sunrise-call-2", incident_id: "mock-sunrise-0001", direction: "outbound", participant_type: "vendor", participant_name: "CoolAir Services", participant_phone: "+14083334444", twilio_call_sid: "CC000002", duration_seconds: 63, transcript: "[Agent]: Hi, I need HVAC service at 890 Sunrise Blvd, Unit 7F. AC not cooling, likely compressor.\n[Vendor]: We can do it in 3 days. $480 for diagnostics and compressor service.\n[Agent]: Perfect. The appointment is confirmed.", summary: "$480 quote, scheduled in 3 days", sentiment: "positive", status: "completed", created_at: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString() },
        ],
      },
      "sunrise-issue-2": {
        incident: { ...MOCK_INCIDENT_SUNRISE, id: "sunrise-issue-2", status: "resolved", category: "appliance", urgency: "low", description: "Oven igniter not sparking in Unit 2C. Technician replaced igniter.", quotes: [], selected_vendor_id: null, resolved_at: new Date(Date.now() - 18 * 24 * 60 * 60000).toISOString(), timeline: [{ timestamp: new Date(Date.now() - 20 * 24 * 60 * 60000).toISOString(), event: "Guest call received", details: "Oven igniter not working", model: "gemini-2.5-flash-native-audio" }, { timestamp: new Date(Date.now() - 18 * 24 * 60 * 60000).toISOString(), event: "Igniter replaced", details: "Appliance technician repaired oven" }] },
        callLogs: [{ id: "sunrise-oven-call", incident_id: "sunrise-issue-2", direction: "inbound", participant_type: "guest", participant_name: "Priya (Tenant)", participant_phone: "+14087770003", twilio_call_sid: "CC000003", duration_seconds: 48, transcript: "[Guest]: The oven won't light. The igniter clicks but no flame.\n[Agent]: That sounds like a faulty igniter. I'll schedule an appliance technician.\n[Guest]: Thank you, I need to be able to cook.\n[Agent]: Understood, I'll get someone there in 2 days.", summary: "Oven igniter faulty, technician scheduled", sentiment: "neutral", status: "completed", created_at: new Date(Date.now() - 20 * 24 * 60 * 60000).toISOString() }],
      },
    },
  },
];

export default function DashboardPage() {
  const [incidentId, setIncidentId] = useState<string | null>(DEMO_INCIDENT_ID);
  const [useMock, setUseMock] = useState(!DEMO_INCIDENT_ID);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [issuesPanelOpen, setIssuesPanelOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState("prop-lemon");
  const [selectedIssueId, setSelectedIssueId] = useState("mock-1234-5678-abcd");

  const selectedPropertyData = MOCK_PROPERTIES_DATA.find((p) => p.meta.id === selectedPropertyId)!;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

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

  // Reset selected issue when property changes
  useEffect(() => {
    setSelectedIssueId(selectedPropertyData.defaultIssueId);
  }, [selectedPropertyId]);

  // Resolve active issue data
  const activeIssueData = selectedPropertyData.issueData[selectedIssueId] ?? selectedPropertyData.issueData[selectedPropertyData.defaultIssueId];
  const incident = useMock ? activeIssueData.incident : liveIncident;
  const mockCallLogs = activeIssueData.callLogs;

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
          <p className="text-sm text-[var(--text-muted)]">
            {isLoading ? "Loading incident..." : "No active incidents"}
          </p>
        </div>
      </div>
    );
  }

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
          <span className="text-sm text-[var(--text-muted)]">{selectedPropertyData.meta.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs transition-colors"
          >
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
          <StatusBadge status={incident.status} />
        </div>
      </header>

      {/* ── Main layout ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-0">
        {/* Left sidebar */}
        <aside
          style={{ width: sidebarWidth }}
          className="flex-shrink-0 border-r border-[var(--border)] p-4 flex flex-col gap-4 sticky top-[49px] self-start h-[calc(100vh-49px)] overflow-y-auto">
          <ActiveCallsPanel callLogs={useMock ? mockCallLogs : callLogs} />
          <GeminiActivityFeed activities={useMock ? MOCK_GEMINI_ACTIVITY : geminiActivity} />

          <PropertySwitcher
            properties={MOCK_PROPERTIES_DATA.map((p) => p.meta)}
            selectedId={selectedPropertyId}
            onSelect={(id) => {
              setSelectedPropertyId(id);
              setIssuesPanelOpen(false);
            }}
            relatedIssueCount={incident?.related_maintenance_ids.length ?? 0}
          />

          {useMock && (
            <div className="text-[10px] text-[var(--text-muted)] text-center px-2">
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
          <div className="relative">
            <IncidentCard
              incident={incident}
              unitNumber={selectedPropertyData.meta.activeUnit}
              propertyName={selectedPropertyData.meta.name}
              onClick={() => setIssuesPanelOpen((o) => !o)}
            />
            {issuesPanelOpen && (
              <IssueListPanel
                issues={selectedPropertyData.issues}
                activeId={selectedIssueId}
                onSelect={(id) => {
                  setSelectedIssueId(id);
                  setIssuesPanelOpen(false);
                }}
                onClose={() => setIssuesPanelOpen(false)}
              />
            )}
          </div>

          <CallTranscript
            key={selectedIssueId}
            callLogs={useMock ? mockCallLogs : callLogs}
            quotes={incident.quotes}
            incidentId={incident.id}
            approvedVendorId={incident.selected_vendor_id}
            onApprove={handleApprove}
          />

          <EventTimeline events={incident.timeline} />
        </main>
      </div>
    </div>
  );
}

// ─── Mock Gemini activity ─────────────────────────────────────────────────────
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
