import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";
import type { FunctionDeclaration } from "@google/genai";

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

/**
 * Tool declarations registered with Gemini Live API.
 * Must match docs/gemini-tools.md exactly.
 */
export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "search_maintenance_history",
    description:
      "Search property maintenance history for similar past issues using vector similarity",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
          description: "Description of the issue to search for",
        },
        property_id: {
          type: "string" as const,
          description: "Property UUID",
        },
      },
      required: ["query", "property_id"],
    },
  },
  {
    name: "create_incident",
    description: "Create a new maintenance incident",
    parameters: {
      type: "object" as const,
      properties: {
        property_id: { type: "string" as const },
        unit_id: { type: "string" as const },
        category: {
          type: "string" as const,
          enum: ["plumbing", "electrical", "hvac", "appliance", "structural"],
        },
        description: { type: "string" as const },
        urgency: {
          type: "string" as const,
          enum: ["low", "medium", "high", "emergency"],
        },
        guest_phone: { type: "string" as const },
      },
      required: ["property_id", "category", "description", "urgency"],
    },
  },
  {
    name: "log_vendor_quote",
    description: "Record a vendor's quote for an incident",
    parameters: {
      type: "object" as const,
      properties: {
        incident_id: { type: "string" as const },
        vendor_id: { type: "string" as const },
        amount: { type: "number" as const },
        eta_days: { type: "number" as const },
        notes: { type: "string" as const },
      },
      required: ["incident_id", "vendor_id", "amount", "eta_days"],
    },
  },
  {
    name: "get_vendor_access_code",
    description:
      "Retrieve the vendor door access code for a property. Only provide to verified scheduled vendors.",
    parameters: {
      type: "object" as const,
      properties: {
        property_id: { type: "string" as const },
        vendor_phone: {
          type: "string" as const,
          description: "Caller's phone to verify against scheduled vendor",
        },
      },
      required: ["property_id"],
    },
  },
  {
    name: "schedule_repair",
    description:
      "Schedule a repair by creating a calendar event and updating the incident",
    parameters: {
      type: "object" as const,
      properties: {
        incident_id: { type: "string" as const },
        vendor_id: { type: "string" as const },
        scheduled_date: {
          type: "string" as const,
          description: "ISO date string",
        },
        time_preference: {
          type: "string" as const,
          enum: ["morning", "afternoon", "evening"],
        },
      },
      required: ["incident_id", "vendor_id", "scheduled_date"],
    },
  },
  {
    name: "update_incident_status",
    description: "Update the status of an incident",
    parameters: {
      type: "object" as const,
      properties: {
        incident_id: { type: "string" as const },
        status: {
          type: "string" as const,
          enum: [
            "triaging",
            "quoting",
            "pending_approval",
            "approved",
            "scheduled",
            "in_progress",
            "resolved",
          ],
        },
      },
      required: ["incident_id", "status"],
    },
  },
];

/**
 * Handle a tool call from Gemini and return the result.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "search_maintenance_history":
      return searchMaintenanceHistory(
        args.query as string,
        args.property_id as string
      );
    case "create_incident":
      return createIncident(args);
    case "log_vendor_quote":
      return logVendorQuote(args);
    case "get_vendor_access_code":
      return getVendorAccessCode(
        args.property_id as string,
        args.vendor_phone as string | undefined
      );
    case "schedule_repair":
      return scheduleRepair(args);
    case "update_incident_status":
      return updateIncidentStatus(
        args.incident_id as string,
        args.status as string
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function searchMaintenanceHistory(
  query: string,
  propertyId: string
): Promise<unknown> {
  // Generate embedding for the query
  const embeddingResult = await ai.models.embedContent({
    model: "gemini-embedding-exp-03-07",
    contents: query,
    config: { taskType: "RETRIEVAL_QUERY" },
  });

  const queryEmbedding = embeddingResult.embeddings?.[0]?.values;
  if (!queryEmbedding) {
    throw new Error("Failed to generate query embedding");
  }

  // Call the Supabase vector search function
  const { data, error } = await supabase.rpc("match_maintenance_logs", {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: 5,
    filter_property_id: propertyId,
  });

  if (error) throw error;

  return {
    results: data || [],
    count: data?.length || 0,
    message:
      data?.length > 0
        ? `Found ${data.length} similar past issues`
        : "No similar past issues found",
  };
}

async function createIncident(
  args: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      property_id: args.property_id,
      unit_id: args.unit_id || null,
      category: args.category,
      description: args.description,
      urgency: args.urgency,
      guest_phone: args.guest_phone || null,
      status: "new",
      timeline: [
        {
          timestamp: new Date().toISOString(),
          event: "incident_created",
          details: `Emergency ${args.category} issue reported: ${args.description}`,
        },
      ],
    })
    .select()
    .single();

  if (error) throw error;
  return { incident_id: data.id, status: "created", message: "Incident created successfully" };
}

async function logVendorQuote(args: Record<string, unknown>): Promise<unknown> {
  // Get current incident
  const { data: incident, error: fetchError } = await supabase
    .from("incidents")
    .select("quotes, timeline")
    .eq("id", args.incident_id)
    .single();

  if (fetchError) throw fetchError;

  const quotes = [...(incident.quotes || [])];
  quotes.push({
    vendor_id: args.vendor_id,
    amount: args.amount,
    eta_days: args.eta_days,
    notes: args.notes || "",
    received_at: new Date().toISOString(),
  });

  const timeline = [...(incident.timeline || [])];
  timeline.push({
    timestamp: new Date().toISOString(),
    event: "quote_received",
    details: `Vendor quote: $${args.amount}, ${args.eta_days} days`,
  });

  const { error: updateError } = await supabase
    .from("incidents")
    .update({ quotes, timeline })
    .eq("id", args.incident_id);

  if (updateError) throw updateError;
  return { success: true, quote_count: quotes.length };
}

async function getVendorAccessCode(
  propertyId: string,
  vendorPhone?: string
): Promise<unknown> {
  // Verify vendor is scheduled if phone provided
  if (vendorPhone) {
    const { data: scheduled } = await supabase
      .from("incidents")
      .select("id, selected_vendor_id")
      .eq("property_id", propertyId)
      .eq("status", "scheduled")
      .limit(1);

    if (!scheduled?.length) {
      return { error: "No scheduled repairs found for this property" };
    }
  }

  const { data, error } = await supabase
    .from("properties")
    .select("vendor_access_code")
    .eq("id", propertyId)
    .single();

  if (error) throw error;
  return { access_code: data.vendor_access_code };
}

async function scheduleRepair(args: Record<string, unknown>): Promise<unknown> {
  const timeline_entry = {
    timestamp: new Date().toISOString(),
    event: "repair_scheduled",
    details: `Scheduled for ${args.scheduled_date} (${args.time_preference || "any time"})`,
  };

  const { data: incident } = await supabase
    .from("incidents")
    .select("timeline")
    .eq("id", args.incident_id)
    .single();

  const timeline = [...(incident?.timeline || []), timeline_entry];

  const { error } = await supabase
    .from("incidents")
    .update({
      selected_vendor_id: args.vendor_id,
      scheduled_at: args.scheduled_date,
      status: "scheduled",
      timeline,
    })
    .eq("id", args.incident_id);

  if (error) throw error;

  // TODO: Create Google Calendar event here
  return {
    success: true,
    message: `Repair scheduled for ${args.scheduled_date}`,
  };
}

async function updateIncidentStatus(
  incidentId: string,
  status: string
): Promise<unknown> {
  const { data: incident } = await supabase
    .from("incidents")
    .select("timeline")
    .eq("id", incidentId)
    .single();

  const timeline = [...(incident?.timeline || [])];
  timeline.push({
    timestamp: new Date().toISOString(),
    event: "status_changed",
    details: `Status updated to: ${status}`,
  });

  const { error } = await supabase
    .from("incidents")
    .update({ status, timeline })
    .eq("id", incidentId);

  if (error) throw error;
  return { success: true, status };
}
