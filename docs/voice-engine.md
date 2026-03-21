# Voice Engine

> Twilio ↔ Gemini Live API Bridge

## Audio Flow

```
Phone Call → Twilio → Media Streams WebSocket → Bridge Server → Gemini Live API WebSocket
                                                       ↕
                                              Function Calling
                                                       ↕
                                              Supabase / Calendar
```

---

## Bridge Server (Python FastAPI or Node.js)

1. **Inbound call:** Twilio sends incoming call webhook → returns TwiML with `<Stream>` to WebSocket endpoint
2. **Gemini session:** Bridge opens Gemini Live API session with:
   - System prompt (agent persona + property context)
   - Tools (`search_maintenance`, `get_vendor_code`, `create_incident`, `schedule_repair`)
   - Voice selection (professional, calm tone)
3. **Audio resampling:** Chunks flow bidirectionally:
   - Twilio μ-law 8kHz → resample to 16kHz PCM → Gemini
   - Gemini audio response → resample to μ-law 8kHz → Twilio
4. **Function calls mid-conversation:** When Gemini triggers function calls:
   - `search_maintenance(query)` → embed query → Supabase vector search
   - `get_vendor_code(property_id)` → Supabase lookup
   - `create_incident(details)` → Supabase insert → WebSocket push to dashboard
   - `update_incident_status(id, status)` → Supabase update → dashboard push
   - `schedule_repair(vendor, date, property)` → Google Calendar API

---

## Outbound Calls

For agent-initiated calls (to plumbers, landlord):

1. Vercel Workflow triggers outbound call via Twilio REST API
2. Twilio connects → same bridge → Gemini Live session with call-specific system prompt
3. Agent has different persona per call type:
   - **To vendors:** Professional, efficient, gets quote and availability
   - **To landlord:** Concise, presents data, asks for decision
   - **To guest:** Empathetic, reassuring, provides updates

---

## Parallel Calls

The Workflow DevKit `DurableAgent` spawns 2+ vendor calls as parallel steps:

```typescript
async function vendorOutreach(incidentId: string, vendorIds: string[]) {
  "use workflow";

  // Parallel call all vendors simultaneously
  const quotes = await Promise.all(
    vendorIds.map(vendorId =>
      callVendor(incidentId, vendorId) // each is a "use step"
    )
  );

  // Gemini 3.1 Flash analyzes quotes
  const recommendation = await analyzeQuotes(quotes, incidentId);

  // Call landlord for approval
  const approval = await callLandlord(incidentId, recommendation);

  if (approval.approved) {
    await scheduleRepair(incidentId, recommendation.selectedVendor);
  }
}
```

---

## Key Resource

Reference implementation: `github.com/sa-kanean/gemini-live-voice-ai-agent-with-telephony`
