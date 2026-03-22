/**
 * Real-time hooks triggered by tool calls during live conversations.
 *
 * When Gemini calls tools mid-conversation, these hooks fire side-effects:
 * - Image generation (Gemini Flash) when an incident is created
 * - Invoice generation when a vendor quote is logged
 * - Invoice finalization when a repair is approved
 * - Gemini activity logging for dashboard display
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

// ─── Gemini Activity Logger ─────────────────────────────────────────────────
// Logs model activity to gemini_activity table for real-time dashboard display

export async function logGeminiActivity(
  incidentId: string,
  model: string,
  label: string,
  status: "active" | "done" | "error",
  result?: string
): Promise<void> {
  try {
    await supabase.from("gemini_activity").insert({
      incident_id: incidentId,
      model,
      label,
      status,
      result: result || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[hooks] Failed to log gemini activity:", err);
  }
}

// ─── Image Generation Hook ──────────────────────────────────────────────────
// Generates a contextual image when an incident is created.
// Runs async — dashboard shows loading state, then image appears ~10s later.

export async function generateIncidentImage(
  incidentId: string,
  category: string,
  description: string
): Promise<void> {
  try {
    await logGeminiActivity(
      incidentId,
      "gemini-2.5-flash-image",
      "Generating contextual image",
      "active"
    );

    const prompt = buildImagePrompt(category, description);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    let imageUrl: string | null = null;

    // Extract image from response
    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          // Upload to Supabase Storage
          const filename = `incidents/${incidentId}/photo_${Date.now()}.png`;
          const imageBuffer = Buffer.from(part.inlineData.data as string, "base64");

          const { error: uploadError } = await supabase.storage
            .from("incident-photos")
            .upload(filename, imageBuffer, {
              contentType: "image/png",
              upsert: true,
            });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from("incident-photos")
              .getPublicUrl(filename);
            imageUrl = urlData.publicUrl;
          } else {
            // Fallback: store as data URI in the incident
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          }
          break;
        }
      }
    }

    // Update incident with the generated image
    if (imageUrl) {
      const { data: incident } = await supabase
        .from("incidents")
        .select("timeline")
        .eq("id", incidentId)
        .single();

      const timeline = [...(incident?.timeline || [])];
      timeline.push({
        timestamp: new Date().toISOString(),
        event: "image_generated",
        details: "Contextual image created from issue description",
        image_url: imageUrl,
        model: "gemini-2.5-flash-image",
      });

      await supabase
        .from("incidents")
        .update({ timeline })
        .eq("id", incidentId);
    }

    await logGeminiActivity(
      incidentId,
      "gemini-2.5-flash-image",
      "Image generated",
      "done",
      imageUrl ? "Image attached to incident" : "Image generation failed"
    );

    console.log(`[hooks] Image generated for incident ${incidentId}`);
  } catch (err) {
    console.error("[hooks] Image generation failed:", err);
    await logGeminiActivity(
      incidentId,
      "gemini-2.5-flash-image",
      "Image generation failed",
      "error",
      String(err)
    );
  }
}

function buildImagePrompt(category: string, description: string): string {
  const categoryPrompts: Record<string, string> = {
    plumbing:
      "a realistic iPhone photo of a plumbing issue in a residential bathroom or kitchen",
    electrical:
      "a realistic iPhone photo of an electrical issue in a residential unit",
    hvac: "a realistic iPhone photo of an HVAC or air conditioning problem in a residential unit",
    appliance:
      "a realistic iPhone photo of a broken household appliance in a residential kitchen",
    structural:
      "a realistic iPhone photo of structural damage in a residential unit",
  };

  const base = categoryPrompts[category] || "a realistic iPhone maintenance photo";
  return `Generate ${base}. The specific issue is: ${description}. Harsh indoor lighting, maintenance documentation style, looks like a photo taken by a frustrated tenant with their phone.`;
}

// ─── Invoice Generation Hook ────────────────────────────────────────────────
// Creates a draft invoice when a vendor quote is logged.

export async function generateDraftInvoice(
  incidentId: string,
  vendorId: string,
  amount: number,
  notes: string
): Promise<void> {
  try {
    // Get vendor details
    const { data: vendor } = await supabase
      .from("vendors")
      .select("name, phone, hourly_rate")
      .eq("id", vendorId)
      .single();

    // Generate invoice number
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true });
    const seq = (count || 0) + 1;
    const invoiceNumber = `INV-${year}-${String(seq).padStart(4, "0")}`;

    // Calculate tax (SF 8.625%)
    const tax = Math.round(amount * 0.08625 * 100) / 100;
    const total = Math.round((amount + tax) * 100) / 100;

    // Generate realistic line items based on amount
    const hourlyRate = vendor?.hourly_rate || 85;
    const laborHours = Math.max(1, Math.round((amount * 0.7) / hourlyRate));
    const laborCost = laborHours * hourlyRate;
    const partsCost = amount - laborCost;

    const lineItems = [
      {
        description: `Labor - ${notes || "Repair service"} (${laborHours} hr${laborHours > 1 ? "s" : ""})`,
        quantity: laborHours,
        unit_price: hourlyRate,
        total: laborCost,
      },
    ];

    if (partsCost > 0) {
      lineItems.push({
        description: "Parts and materials",
        quantity: 1,
        unit_price: partsCost,
        total: partsCost,
      });
    }

    // Insert draft invoice
    await supabase.from("invoices").insert({
      incident_id: incidentId,
      vendor_id: vendorId,
      invoice_number: invoiceNumber,
      amount,
      tax,
      total,
      status: "draft",
      payment_method: "pending",
      issued_at: new Date().toISOString(),
      line_items: lineItems,
      notes: `Draft invoice for ${vendor?.name || "vendor"}: ${notes || "Maintenance repair"}`,
    });

    // Log to gemini activity
    await logGeminiActivity(
      incidentId,
      "system",
      `Draft invoice ${invoiceNumber} created`,
      "done",
      `$${amount} + $${tax} tax = $${total}`
    );

    // Update incident timeline
    const { data: incident } = await supabase
      .from("incidents")
      .select("timeline")
      .eq("id", incidentId)
      .single();

    const timeline = [...(incident?.timeline || [])];
    timeline.push({
      timestamp: new Date().toISOString(),
      event: "invoice_generated",
      details: `Draft invoice ${invoiceNumber}: $${total} (incl. SF tax)`,
    });

    await supabase
      .from("incidents")
      .update({ timeline })
      .eq("id", incidentId);

    console.log(`[hooks] Draft invoice ${invoiceNumber} created for incident ${incidentId}`);
  } catch (err) {
    console.error("[hooks] Invoice generation failed:", err);
  }
}

// ─── Invoice Finalization Hook ──────────────────────────────────────────────
// When incident status changes to "approved", finalize the draft invoice.

export async function finalizeInvoice(incidentId: string): Promise<void> {
  try {
    // Find draft invoices for this incident
    const { data: drafts } = await supabase
      .from("invoices")
      .select("id, invoice_number, total")
      .eq("incident_id", incidentId)
      .eq("status", "draft");

    if (!drafts?.length) return;

    // Get the selected vendor's invoice (most recent draft)
    const { data: incident } = await supabase
      .from("incidents")
      .select("selected_vendor_id")
      .eq("id", incidentId)
      .single();

    // Finalize matching invoices, cancel others
    for (const draft of drafts) {
      const isSelected = incident?.selected_vendor_id
        ? true // finalize all drafts for now
        : false;

      await supabase
        .from("invoices")
        .update({
          status: isSelected ? "approved" : "cancelled",
          paid_at: isSelected ? null : undefined, // will be set when actually paid
        })
        .eq("id", draft.id);
    }

    await logGeminiActivity(
      incidentId,
      "system",
      "Invoice approved — pending payment",
      "done",
      `${drafts.length} invoice(s) finalized`
    );

    console.log(`[hooks] Invoices finalized for incident ${incidentId}`);
  } catch (err) {
    console.error("[hooks] Invoice finalization failed:", err);
  }
}

// ─── Embedding Hook ─────────────────────────────────────────────────────────
// After an incident is resolved, embed the full record into maintenance_logs
// for future vector search.

export async function embedResolvedIncident(
  incidentId: string
): Promise<void> {
  try {
    const { data: incident } = await supabase
      .from("incidents")
      .select("*")
      .eq("id", incidentId)
      .single();

    if (!incident) return;

    // Build embedding text from the full incident
    const embedText = `
Category: ${incident.category}
Date: ${incident.created_at}
Urgency: ${incident.urgency}
Issue: ${incident.description}
Resolution: ${incident.timeline?.find((e: { event: string }) => e.event === "resolved")?.details || "Resolved"}
Cost: $${incident.quotes?.[0]?.amount || 0}
    `.trim();

    const embeddingResult = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: embedText,
      config: { taskType: "RETRIEVAL_DOCUMENT" },
    });

    const embedding = embeddingResult.embeddings?.[0]?.values;
    if (!embedding) return;

    // Insert into maintenance_logs for future searches
    await supabase.from("maintenance_logs").insert({
      property_id: incident.property_id,
      unit_id: incident.unit_id,
      category: incident.category,
      description: incident.description,
      resolution:
        incident.timeline?.find((e: { event: string }) => e.event === "resolved")?.details ||
        "Resolved",
      vendor_name: null, // will be populated from vendor table if needed
      cost: incident.quotes?.find(
        (q: { vendor_id: string }) => q.vendor_id === incident.selected_vendor_id
      )?.amount || 0,
      reported_at: incident.created_at,
      resolved_at: incident.resolved_at || new Date().toISOString(),
      severity: incident.urgency,
      embedding,
    });

    await logGeminiActivity(
      incidentId,
      "gemini-embedding-2",
      "Incident embedded for future search",
      "done"
    );

    console.log(`[hooks] Resolved incident ${incidentId} embedded into maintenance_logs`);
  } catch (err) {
    console.error("[hooks] Embedding resolved incident failed:", err);
  }
}
