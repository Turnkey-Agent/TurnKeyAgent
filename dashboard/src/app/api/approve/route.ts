import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { ApprovePayload } from "@/lib/types";

// Service-role client — bypasses RLS for the approval write
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ApprovePayload;
    const { incident_id, vendor_id, approved_by } = body;

    if (!incident_id || !vendor_id) {
      return NextResponse.json({ error: "Missing incident_id or vendor_id" }, { status: 400 });
    }

    // 1. Update incident in Supabase — Realtime will push this to the dashboard
    const { error: updateErr } = await supabase
      .from("incidents")
      .update({
        status: "approved",
        selected_vendor_id: vendor_id,
        approved_by: approved_by ?? "landlord",
        approved_at: new Date().toISOString(),
      })
      .eq("id", incident_id);

    if (updateErr) {
      console.error("Supabase update error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 2. Append approval to timeline
    const { data: incident } = await supabase
      .from("incidents")
      .select("timeline")
      .eq("id", incident_id)
      .single();

    if (incident) {
      const timeline = incident.timeline ?? [];
      timeline.push({
        timestamp: new Date().toISOString(),
        event: "Landlord approved quote",
        details: `Selected vendor ID: ${vendor_id}`,
      });

      await supabase
        .from("incidents")
        .update({ timeline })
        .eq("id", incident_id);
    }

    // 3. TODO (Arnav): Resume the DurableAgent workflow here
    // The orchestration layer should subscribe to `incidents` Realtime for status="approved"
    // OR you can call a Vercel Workflow endpoint directly:
    //
    // await fetch(`${process.env.VERCEL_URL}/api/workflow/resume`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ incident_id, vendor_id }),
    // });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Approval error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
