import { config } from "./config.js";
import { supabase, logActivity, logCallEvent } from "./tools.js";
import { analyzeQuotes } from "./reasoning.js";

interface WorkflowConfig {
  situation: string;
  guestPhone: string;
  vendor1Phone: string;
  vendor2Phone: string;
  landlordPhone: string;
  ngrokUrl: string;
}

interface WorkflowState {
  id: string;
  incidentId: string | null;
  status: "guest_call" | "vendor_calls" | "pending_approval" | "scheduling" | "complete" | "error";
  quotes: Array<{ vendorPhone: string; amount?: number; eta_days?: number; notes?: string }>;
  selectedVendorPhone: string | null;
  vendorCallsDone: number;
  config: WorkflowConfig;
}

// Active workflows keyed by workflow ID
const workflows = new Map<string, WorkflowState>();

// Map incident_id → workflow_id for approval routing
const incidentWorkflowMap = new Map<string, string>();

/**
 * Start the full demo workflow:
 * 1. Call guest → confirm issue
 * 2. Call vendor1 + vendor2 in parallel → get quotes
 * 3. Present quotes on dashboard → wait for landlord approval
 * 4. Call selected vendor → schedule repair
 */
export async function startWorkflow(cfg: WorkflowConfig): Promise<WorkflowState> {
  const id = `wf_${Date.now()}`;
  const state: WorkflowState = {
    id,
    incidentId: null,
    status: "guest_call",
    quotes: [],
    selectedVendorPhone: null,
    vendorCallsDone: 0,
    config: cfg,
  };
  workflows.set(id, state);

  console.log(`[Workflow ${id}] Starting — situation: ${cfg.situation.slice(0, 80)}`);

  // Create incident in DB immediately so dashboard shows it
  const { data: incident } = await supabase
    .from("incidents")
    .insert({
      property_id: await getPropertyId(),
      category: "plumbing",
      description: cfg.situation,
      urgency: "emergency",
      guest_phone: cfg.guestPhone,
      status: "triaging",
      timeline: [{
        timestamp: new Date().toISOString(),
        event: "workflow_started",
        details: "Turnkey Agent deployed — calling guest to confirm issue",
      }],
    })
    .select()
    .single();

  if (incident) {
    state.incidentId = incident.id;
    incidentWorkflowMap.set(incident.id, id);
  }

  await logActivity(state.incidentId!, "Calling guest to confirm issue", "active");

  // Step 1: Call the guest
  const callSid = await makeCall(cfg.guestPhone, "guest", cfg.situation, cfg.ngrokUrl);
  if (callSid) {
    await logCallEvent(state.incidentId!, "outbound", "guest", cfg.guestPhone, callSid, "Calling guest to confirm issue");

    // Register callback for when guest call ends
    registerCallEndCallback(callSid, () => onGuestCallEnd(id));
  }

  return state;
}

/**
 * After guest call ends → call both vendors in parallel
 */
async function onGuestCallEnd(workflowId: string) {
  const state = workflows.get(workflowId);
  if (!state) return;

  console.log(`[Workflow ${workflowId}] Guest call ended → calling vendors`);
  state.status = "vendor_calls";

  await logActivity(state.incidentId!, "Guest confirmed issue — dispatching vendors", "done");

  // Update incident status
  await supabase.from("incidents").update({
    status: "quoting",
    timeline: await appendTimeline(state.incidentId!, "Calling vendors for quotes"),
  }).eq("id", state.incidentId!);

  await logActivity(state.incidentId!, "Calling Vendor 1 for quote", "active");

  // Call vendors SEQUENTIALLY — vendor 1 first, then vendor 2 after vendor 1 ends
  const v1Sid = await makeCall(state.config.vendor1Phone, "vendor", state.config.situation, state.config.ngrokUrl);

  if (v1Sid) {
    await logCallEvent(state.incidentId!, "outbound", "vendor", state.config.vendor1Phone, v1Sid);
    registerCallEndCallback(v1Sid, () => onVendorCallEnd(workflowId, state.config.vendor1Phone));
  }
}

/**
 * After vendor call ends → if vendor 1 done, call vendor 2. If both done, present quotes.
 */
async function onVendorCallEnd(workflowId: string, vendorPhone: string) {
  const state = workflows.get(workflowId);
  if (!state) return;

  state.vendorCallsDone++;
  console.log(`[Workflow ${workflowId}] Vendor ${vendorPhone} call ended (${state.vendorCallsDone}/2)`);

  await logActivity(state.incidentId!, `Vendor ${vendorPhone} quote received`, "done");

  // After vendor 1 → call vendor 2
  if (state.vendorCallsDone === 1) {
    await logActivity(state.incidentId!, "Calling Vendor 2 for quote", "active");
    const v2Sid = await makeCall(state.config.vendor2Phone, "vendor", state.config.situation, state.config.ngrokUrl);
    if (v2Sid) {
      await logCallEvent(state.incidentId!, "outbound", "vendor", state.config.vendor2Phone, v2Sid);
      registerCallEndCallback(v2Sid, () => onVendorCallEnd(workflowId, state.config.vendor2Phone));
    }
    return;
  }

  // Both vendors done → present quotes for approval
  state.status = "pending_approval";

  await supabase.from("incidents").update({
    status: "pending_approval",
    timeline: await appendTimeline(state.incidentId!, "Both vendor quotes received — awaiting landlord approval"),
  }).eq("id", state.incidentId!);

  await logActivity(state.incidentId!, "Quotes ready — awaiting landlord approval", "active");

  console.log(`[Workflow ${workflowId}] Both quotes received — waiting for landlord approval on dashboard`);
}

/**
 * Landlord approves a vendor from the dashboard
 */
export async function approveVendor(incidentId: string, vendorPhone: string): Promise<void> {
  const workflowId = incidentWorkflowMap.get(incidentId);
  if (!workflowId) {
    console.error(`[Workflow] No workflow found for incident ${incidentId}`);
    return;
  }

  const state = workflows.get(workflowId);
  if (!state) return;

  console.log(`[Workflow ${workflowId}] Vendor approved: ${vendorPhone} — scheduling`);
  state.status = "scheduling";
  state.selectedVendorPhone = vendorPhone;

  await logActivity(state.incidentId!, "Landlord approved vendor — calling to schedule", "active");

  await supabase.from("incidents").update({
    status: "approved",
    timeline: await appendTimeline(state.incidentId!, `Landlord approved vendor ${vendorPhone}`),
  }).eq("id", state.incidentId!);

  // Call the selected vendor back to schedule
  const callSid = await makeCall(
    vendorPhone,
    "vendor_schedule",
    state.config.situation,
    state.config.ngrokUrl
  );

  if (callSid) {
    await logCallEvent(state.incidentId!, "outbound", "vendor", vendorPhone, callSid, "Scheduling repair");
    registerCallEndCallback(callSid, () => onScheduleCallEnd(workflowId));
  }
}

async function onScheduleCallEnd(workflowId: string) {
  const state = workflows.get(workflowId);
  if (!state) return;

  state.status = "complete";

  await supabase.from("incidents").update({
    status: "scheduled",
    scheduled_at: new Date(Date.now() + 86400000).toISOString(), // tomorrow
    timeline: await appendTimeline(state.incidentId!, "Repair scheduled — vendor confirmed for tomorrow morning"),
  }).eq("id", state.incidentId!);

  await logActivity(state.incidentId!, "Repair scheduled — workflow complete", "done");
  console.log(`[Workflow ${workflowId}] COMPLETE`);
}

// ── Helpers ──

const callEndCallbacks = new Map<string, () => void>();

export function registerCallEndCallback(callSid: string, cb: () => void) {
  callEndCallbacks.set(callSid, cb);
}

export function triggerCallEnd(callSid: string) {
  const cb = callEndCallbacks.get(callSid);
  if (cb) {
    callEndCallbacks.delete(callSid);
    cb();
  }
}

async function makeCall(to: string, type: string, situation: string, ngrokUrl: string): Promise<string | null> {
  const authHeader = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64");
  const webhookUrl = `${ngrokUrl}/twilio/voice/outbound`;

  // Store call context so twilio-handler knows the prompt
  const { SYSTEM_PROMPTS } = await import("./gemini-session.js");
  let systemPrompt: string;
  switch (type) {
    case "vendor":
      systemPrompt = SYSTEM_PROMPTS.vendorOutbound(situation);
      break;
    case "vendor_schedule":
      systemPrompt = SYSTEM_PROMPTS.vendorSchedule(situation);
      break;
    default:
      systemPrompt = SYSTEM_PROMPTS.guestOutbound(situation);
  }

  // Store in the shared context map (imported from twilio-handler)
  const { storeCallContext } = await import("./twilio-handler.js");

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: config.twilioPhoneNumber, Url: webhookUrl }),
      }
    );
    const data = await res.json();
    if (data.sid) {
      storeCallContext(data.sid, systemPrompt, type);
      console.log(`[Workflow] Call ${type} → ${to}: ${data.sid}`);
      return data.sid;
    } else {
      console.error(`[Workflow] Call failed:`, data.message);
      return null;
    }
  } catch (err) {
    console.error(`[Workflow] Call error:`, err);
    return null;
  }
}

async function getPropertyId(): Promise<string> {
  const { data } = await supabase.from("properties").select("id").limit(1).single();
  return data?.id || "00000000-0000-0000-0000-000000000000";
}

async function appendTimeline(incidentId: string, details: string) {
  const { data } = await supabase.from("incidents").select("timeline").eq("id", incidentId).single();
  const timeline = [...(data?.timeline || [])];
  timeline.push({ timestamp: new Date().toISOString(), event: "workflow_step", details });
  return timeline;
}

export function getWorkflow(id: string) { return workflows.get(id); }
export function getWorkflowByIncident(incidentId: string) {
  const wfId = incidentWorkflowMap.get(incidentId);
  return wfId ? workflows.get(wfId) : undefined;
}

/**
 * Fetch Twilio call details and save to twilio_call_logs table
 */
export async function saveTwilioCallDetails(callLogId: string, callSid: string): Promise<void> {
  const authHeader = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64");

  try {
    // Fetch call details
    const callRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Calls/${callSid}.json`,
      {
        headers: { Authorization: `Basic ${authHeader}` },
      }
    );

    if (!callRes.ok) {
      console.error(`[Twilio] Failed to fetch call details for ${callSid}`);
      return;
    }

    const callData = await callRes.json();

    // Fetch recordings for this call
    const recordingRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Calls/${callSid}/Recordings.json`,
      {
        headers: { Authorization: `Basic ${authHeader}` },
      }
    );

    let recordingSid: string | null = null;
    let recordingUrl: string | null = null;
    let recordingDuration: number | null = null;

    if (recordingRes.ok) {
      const recordings = await recordingRes.json();
      if (recordings.recordings && recordings.recordings.length > 0) {
        const rec = recordings.recordings[0];
        recordingSid = rec.sid;
        recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Recordings/${rec.sid}.mp3`;
        recordingDuration = parseInt(rec.duration) || null;
      }
    }

    // Save to twilio_call_logs table
    const insertData = {
      call_log_id: callLogId,
      twilio_call_sid: callData.sid,
      twilio_account_sid: callData.account_sid,
      from_number: callData.from,
      to_number: callData.to,
      status: callData.status,
      direction: callData.direction,
      start_time: callData.start_time ? new Date(callData.start_time).toISOString() : null,
      end_time: callData.end_time ? new Date(callData.end_time).toISOString() : null,
      duration_seconds: parseInt(callData.duration) || null,
      price: callData.price ? parseFloat(callData.price) : null,
      price_unit: callData.price_unit || 'USD',
      uri: callData.uri,
      recording_sid: recordingSid,
      recording_url: recordingUrl,
      recording_duration_seconds: recordingDuration,
      raw_twilio_response: callData || {},
    };

    // Log the actual insert attempt
    console.log(`[Twilio] Insert data prepared for ${callSid}:`);
    console.log(`  - call_log_id: ${insertData.call_log_id}`);
    console.log(`  - twilio_call_sid: ${insertData.twilio_call_sid}`);
    console.log(`  - status: ${insertData.status}`);
    console.log(`  - duration: ${insertData.duration_seconds}s`);
    console.log(`  - price: $${insertData.price}`);
    console.log(`  - has recording: ${insertData.recording_url ? 'yes' : 'no'}`);

    console.log(`[Twilio] Attempting to save call details for ${callSid}:`, JSON.stringify(insertData, null, 2));

    const { error } = await supabase.from("twilio_call_logs").insert(insertData);

    if (error) {
      console.error(`[Twilio] FAILED to save call details for ${callSid}:`, error);
      console.error(`[Twilio] Error details:`, JSON.stringify(error, null, 2));
    } else {
      console.log(`[Twilio] SUCCESS - Saved call details for ${callSid}: ${callData.duration}s, $${callData.price}, recording: ${recordingUrl ? 'yes' : 'no'}`);
    }
  } catch (err) {
    console.error(`[Twilio] EXCEPTION fetching/saving call details for ${callSid}:`, err);
    if (err instanceof Error) {
      console.error(`[Twilio] Error stack:`, err.stack);
    }
  }
}
