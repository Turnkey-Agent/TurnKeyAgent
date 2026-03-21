import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      property_id: body.property_id,
      unit_id: body.unit_id,
      category: body.category,
      description: body.description,
      urgency: body.urgency,
      guest_phone: body.guest_phone,
      status: "new",
      timeline: [
        {
          timestamp: new Date().toISOString(),
          event: "incident_created",
          details: body.description,
        },
      ],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
