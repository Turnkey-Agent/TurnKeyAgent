// ─── Incident ────────────────────────────────────────────────────────────────

export type IncidentStatus =
  | "new"
  | "triaging"
  | "quoting"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "in_progress"
  | "resolved";

export type IncidentCategory =
  | "plumbing"
  | "electrical"
  | "hvac"
  | "appliance"
  | "structural";

export type Urgency = "low" | "medium" | "high" | "emergency";

export interface Quote {
  vendor_id: string;
  vendor_name: string;
  vendor_phone: string;
  vendor_rating: number;
  vendor_jobs_on_property: number;
  amount: number;
  eta_days: number;
  call_transcript?: string;
  recommended?: boolean;
}

export interface TimelineEvent {
  timestamp: string; // ISO string
  event: string;
  details?: string;
  model?: GeminiModel; // which Gemini model fired this
}

export interface Incident {
  id: string;
  property_id: string;
  unit_id: string | null;
  status: IncidentStatus;
  category: IncidentCategory;
  description: string;
  guest_phone: string | null;
  urgency: Urgency;
  related_maintenance_ids: string[] | null;
  quotes: Quote[];
  selected_vendor_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  scheduled_at: string | null;
  resolved_at: string | null;
  timeline: TimelineEvent[];
  created_at: string;
}

// ─── Call Log ─────────────────────────────────────────────────────────────────

export type CallDirection = "inbound" | "outbound";
export type ParticipantType = "guest" | "vendor" | "landlord";
export type CallSentiment = "positive" | "neutral" | "negative" | "angry";
export type CallStatus = "active" | "completed" | "failed";

export interface CallLog {
  id: string;
  incident_id: string;
  direction: CallDirection;
  participant_type: ParticipantType;
  participant_name: string;
  participant_phone: string;
  twilio_call_sid: string;
  duration_seconds: number | null;
  transcript: string | null;
  summary: string | null;
  sentiment: CallSentiment | null;
  status: CallStatus;
  created_at: string;
}

// ─── Gemini Activity ──────────────────────────────────────────────────────────

export type GeminiModel =
  | "gemini-2.5-flash-native-audio"
  | "gemini-2.5-flash-native-audio-latest"
  | "gemini-embedding-2"
  | "gemini-3.1-flash"
  | "gemini-2.5-flash-tts"
  | string; // allow new model names from DB

export type GeminiModelStatus = "idle" | "active" | "done";

export interface GeminiActivity {
  id: string;
  model: GeminiModel;
  status: GeminiModelStatus;
  label: string; // e.g. "Searching 5yr maintenance history"
  result?: string; // short result string
  timestamp: string;
}

// ─── Property / Vendor ───────────────────────────────────────────────────────

export interface Property {
  id: string;
  name: string;
  address: string;
  unit_count: number;
}

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  current_guest_name: string;
  current_guest_phone: string;
  status: "occupied" | "vacant" | "maintenance";
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  specialty: string[];
  rating: number;
  total_jobs: number;
  avg_response_time_hours: number;
  is_preferred: boolean;
}

// ─── Approval payload (POST /api/approve) ────────────────────────────────────

export interface ApprovePayload {
  incident_id: string;
  vendor_id: string;
  approved_by: string;
}
