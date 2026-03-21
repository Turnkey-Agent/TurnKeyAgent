import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  const { message, incidentId } = await req.json();

  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  // Gather context from Supabase
  let context = "";

  // Current incident
  if (incidentId) {
    const { data: incident } = await supabase
      .from("incidents")
      .select("*")
      .eq("id", incidentId)
      .single();
    if (incident) {
      context += `\nCurrent Incident: ${incident.category} - ${incident.description}\nStatus: ${incident.status}\nUrgency: ${incident.urgency}\n`;
      if (incident.quotes?.length) {
        context += `Quotes: ${JSON.stringify(incident.quotes)}\n`;
      }
      if (incident.timeline?.length) {
        context += `Timeline: ${incident.timeline.map((e: { event: string; details?: string }) => e.details || e.event).join(" → ")}\n`;
      }
    }

    // Call logs for this incident
    const { data: calls } = await supabase
      .from("call_logs")
      .select("participant_type, participant_name, summary, sentiment, transcript")
      .eq("incident_id", incidentId)
      .order("created_at", { ascending: true })
      .limit(10);
    if (calls?.length) {
      context += `\nCall History:\n${calls.map((c) => `- ${c.participant_type} (${c.participant_name}): ${c.summary || c.transcript?.slice(0, 100) || "No summary"}`).join("\n")}\n`;
    }
  }

  // Recent maintenance history
  const { data: maintenance } = await supabase
    .from("maintenance_logs")
    .select("category, subcategory, description, resolution, cost, vendor_name, reported_at")
    .order("reported_at", { ascending: false })
    .limit(10);
  if (maintenance?.length) {
    context += `\nRecent Maintenance History:\n${maintenance.map((m) => `- ${m.reported_at?.slice(0, 10)}: ${m.category}/${m.subcategory} - ${m.description?.slice(0, 80)} (${m.vendor_name}, $${m.cost})`).join("\n")}\n`;
  }

  // Recent invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("invoice_number, amount, total, status, vendor_id, issued_at, notes")
    .order("issued_at", { ascending: false })
    .limit(5);
  if (invoices?.length) {
    context += `\nRecent Invoices:\n${invoices.map((i) => `- ${i.invoice_number}: $${i.total} (${i.status}) - ${i.notes?.slice(0, 60)}`).join("\n")}\n`;
  }

  // Vendors
  const { data: vendors } = await supabase
    .from("vendors")
    .select("name, phone, specialty, rating, total_jobs, is_preferred")
    .limit(10);
  if (vendors?.length) {
    context += `\nVendors:\n${vendors.map((v) => `- ${v.name} (${v.phone}) - ${v.specialty?.join(", ")} - Rating: ${v.rating} - ${v.total_jobs} jobs${v.is_preferred ? " [PREFERRED]" : ""}`).join("\n")}\n`;
  }

  // Property info
  const { data: property } = await supabase
    .from("properties")
    .select("name, address, guest_access_code, vendor_access_code")
    .limit(1)
    .single();
  if (property) {
    context += `\nProperty: ${property.name} at ${property.address}\n`;
  }

  // Call Gemini
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are Turnkey Agent, an AI property management assistant for landlords. You have access to the property's full database. Answer the landlord's question concisely using the context below.

DATABASE CONTEXT:
${context}

LANDLORD'S QUESTION: ${message}

Respond in 1-3 sentences. Be specific with data — include dates, costs, vendor names, and invoice numbers when relevant. If they ask about maintenance history, pull from the records. If they ask about vendors, provide ratings and contact info.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 300,
          },
        }),
      }
    );

    const data = await response.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn't process that request.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Gemini chat error:", err);
    return NextResponse.json({
      reply: "I'm having trouble connecting right now. Please try again.",
    });
  }
}
