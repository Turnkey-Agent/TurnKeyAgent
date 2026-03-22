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
  const callSid = await makeCall(cfg.guestPhone, "guest", cfg.situation, cfg.ngrokUrl, state.incidentId!);
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
  const v1Sid = await makeCall(state.config.vendor1Phone, "vendor", state.config.situation, state.config.ngrokUrl, state.incidentId!);

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
    const v2Sid = await makeCall(state.config.vendor2Phone, "vendor", state.config.situation, state.config.ngrokUrl, state.incidentId!);
    if (v2Sid) {
      await logCallEvent(state.incidentId!, "outbound", "vendor", state.config.vendor2Phone, v2Sid);
      registerCallEndCallback(v2Sid, () => onVendorCallEnd(workflowId, state.config.vendor2Phone));
    }
    return;
  }

  // Both vendors done → analyze quotes with Gemini 3.1 Flash → present for approval
  state.status = "pending_approval";

  // Fetch quotes from DB
  const { data: incidentData } = await supabase
    .from("incidents")
    .select("quotes")
    .eq("id", state.incidentId!)
    .single();

  const dbQuotes = incidentData?.quotes || [];

  // Use Gemini 3.1 Flash to analyze and recommend
  let recommendation = "Review both quotes and select a vendor.";
  if (dbQuotes.length >= 2) {
    try {
      const analysis = await analyzeQuotes(dbQuotes, state.config.situation);
      recommendation = analysis.summary || analysis.reasoning;
      console.log(`[Workflow ${workflowId}] AI recommendation: ${recommendation}`);

      // Mark the recommended quote
      const updatedQuotes = dbQuotes.map((q: any) => ({
        ...q,
        recommended: q.vendor_id === analysis.selected_vendor_id ||
          q.vendor_phone === analysis.selected_vendor_id,
      }));

      await supabase.from("incidents").update({ quotes: updatedQuotes }).eq("id", state.incidentId!);
      await logActivity(state.incidentId!, `AI Recommendation: ${recommendation}`, "done");
    } catch (err) {
      console.error(`[Workflow ${workflowId}] Quote analysis failed:`, err);
      // Fallback: recommend the cheaper one
      if (dbQuotes.length >= 2) {
        const sorted = [...dbQuotes].sort((a: any, b: any) => (a.amount || 999) - (b.amount || 999));
        const updatedQuotes = dbQuotes.map((q: any) => ({
          ...q,
          recommended: q === sorted[0],
        }));
        await supabase.from("incidents").update({ quotes: updatedQuotes }).eq("id", state.incidentId!);
        recommendation = `Recommend ${sorted[0].vendor_name || "Vendor 1"} — lowest price at $${sorted[0].amount}`;
      }
    }
  }

  await supabase.from("incidents").update({
    status: "pending_approval",
    timeline: await appendTimeline(state.incidentId!,
      `Both quotes received. ${recommendation}. Awaiting landlord approval.`),
  }).eq("id", state.incidentId!);

  await logActivity(state.incidentId!, "Quotes ready — awaiting landlord approval", "active");

  console.log(`[Workflow ${workflowId}] Both quotes received — waiting for landlord approval`);
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
    approved_by: "Ben (Landlord)",
    approved_at: new Date().toISOString(),
    timeline: await appendTimeline(state.incidentId!, `Landlord approved vendor ${vendorPhone}`),
  }).eq("id", state.incidentId!);

  // Call the selected vendor back to schedule
  const callSid = await makeCall(
    vendorPhone,
    "vendor_schedule",
    state.config.situation,
    state.config.ngrokUrl,
    state.incidentId!
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

async function makeCall(to: string, type: string, situation: string, ngrokUrl: string, incidentId?: string): Promise<string | null> {
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
      storeCallContext(data.sid, systemPrompt, type, incidentId);
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
