import type { Request, Response } from "express";
import type { WebSocket as WS } from "ws";
import { config } from "./config.js";
import { GeminiLiveSession, SYSTEM_PROMPTS } from "./gemini-session.js";
import { twilioToGemini, geminiToTwilio } from "./audio-utils.js";
import { triggerCallEnd, getWorkflowByCallSid, registerCallSidToWorkflow } from "./workflow.js";
import { supabase, logActivity } from "./tools.js";

// Active calls
const activeCalls = new Map<string, { gemini: GeminiLiveSession; streamSid: string; startedAt: number; incidentId?: string }>();

// Call context + pre-warmed Gemini sessions
const callContexts = new Map<string, { systemPrompt: string; type: string; incidentId?: string }>();
const prewarmedSessions = new Map<string, GeminiLiveSession>();

/**
 * Store call context AND pre-warm Gemini session before the phone even rings.
 */
export function storeCallContext(callSid: string, systemPrompt: string, type: string, incidentId?: string) {
  callContexts.set(callSid, { systemPrompt, type, incidentId });

  const session = new GeminiLiveSession({
    systemPrompt,
    onAudio: () => {},
    onText: (text: string) => { if (text.trim()) console.log(`[Agent:prewarm] ${text.slice(0, 80)}`); },
    onError: (err: Error) => console.error(`[Gemini:prewarm] ${err.message}`),
    onClose: () => { prewarmedSessions.delete(callSid); },
    onCallEnd: () => { triggerCallEnd(callSid); },
  });

  session.connect().then(() => {
    prewarmedSessions.set(callSid, session);
    console.log(`[Prewarm] Gemini ready for ${callSid} (${type})`);
  }).catch((err) => {
    console.error(`[Prewarm] Failed for ${callSid}:`, err);
  });
}

export function handleIncomingCall(req: Request, res: Response): void {
  const callSid = req.body?.CallSid || "unknown";
  const from = req.body?.From || "unknown";
  console.log(`[Twilio] Inbound from ${from} (${callSid})`);
  const wsUrl = getWebSocketUrl(req);
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Connect><Stream url="${wsUrl}">
  <Parameter name="callSid" value="${callSid}" />
  <Parameter name="callerNumber" value="${from}" />
  <Parameter name="direction" value="inbound" />
</Stream></Connect></Response>`);
}

export function handleOutboundCall(req: Request, res: Response): void {
  const callSid = req.body?.CallSid || "unknown";
  console.log(`[Twilio] Outbound connected (${callSid})`);
  const wsUrl = getWebSocketUrl(req);
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect><Stream url="${wsUrl}">
    <Parameter name="callSid" value="${callSid}" />
    <Parameter name="direction" value="outbound" />
  </Stream></Connect>
</Response>`);
}

export function handleMediaStream(ws: WS): void {
  let streamSid = "";
  let callSid = "";
  let geminiSession: GeminiLiveSession | null = null;
  let callType = "unknown";
  let incidentId: string | undefined;
  let transcriptParts: string[] = [];
  let callLogId: string | null = null;
  let lastFlushTime = 0;

  // Stream transcript to DB in real-time (debounced to every 500ms)
  const flushTranscript = async () => {
    const now = Date.now();
    if (!callLogId || transcriptParts.length === 0 || now - lastFlushTime < 500) return;
    lastFlushTime = now;
    try {
      await supabase.from("call_logs").update({
        transcript: transcriptParts.join("\n"),
      }).eq("id", callLogId);
    } catch {}
  };

  // Add a transcript line and flush
  const addTranscriptLine = (speaker: string, text: string) => {
    if (!text.trim()) return;
    const line = `[${speaker}]: ${text.trim()}`;
    transcriptParts.push(line);
    console.log(`[Transcript] ${line.slice(0, 120)}`);
    flushTranscript();
  };

  ws.on("message", async (data: Buffer) => {
    const msg = JSON.parse(data.toString());

    switch (msg.event) {
      case "connected":
        console.log("[WS] Connected");
        break;

      case "start": {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        const params = msg.start.customParameters || {};
        const direction = params.direction || "inbound";

        console.log(`[WS] Stream: ${streamSid} | Call: ${callSid} | ${direction}`);

        // Get call type and incident ID from stored context
        const ctx = callContexts.get(callSid);
        callType = ctx?.type || direction;
        incidentId = ctx?.incidentId;

        // Also check workflow mapping
        if (!incidentId) {
          const wf = getWorkflowByCallSid?.(callSid);
          if (wf) incidentId = wf.incidentId || undefined;
        }

        // Determine participant name
        let participantName = "Unknown";
        if (callType === "guest") participantName = "Guest (Ayush)";
        else if (callType === "vendor") participantName = "Vendor";
        else if (callType === "vendor_schedule") participantName = "Vendor (Scheduling)";
        else if (callType === "landlord") participantName = "Landlord (Ben)";

        // Create call_log entry with incident_id
        try {
          const insertData: Record<string, unknown> = {
            direction: direction === "inbound" ? "inbound" : "outbound",
            participant_type: callType === "vendor_schedule" ? "vendor" : callType,
            participant_name: participantName,
            twilio_call_sid: callSid,
            transcript: "",
            sentiment: "neutral",
          };
          if (incidentId) insertData.incident_id = incidentId;

          const { data: logEntry } = await supabase.from("call_logs")
            .insert(insertData)
            .select("id")
            .single();
          if (logEntry) callLogId = logEntry.id;
        } catch (e) {
          console.error("[WS] Failed to create call_log:", e);
        }

        // Check for pre-warmed session
        const prewarmed = prewarmedSessions.get(callSid);
        if (prewarmed) {
          geminiSession = prewarmed;
          prewarmedSessions.delete(callSid);
          callContexts.delete(callSid);

          // Rewire audio handler
          geminiSession.setAudioHandler((base64Pcm: string) => {
            const twilioAudio = geminiToTwilio(base64Pcm);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ event: "media", streamSid, media: { payload: twilioAudio } }));
            }
          });

          // Rewire text handler for real-time transcript
          geminiSession.setTextHandler((text: string) => {
            if (text.trim()) {
              addTranscriptLine("Agent", text);
            }
          });

          console.log(`[WS] Using PRE-WARMED Gemini session (zero latency)`);
          geminiSession.sendText("The person just picked up the phone. Start speaking now with your opening line.");
        } else {
          // Cold start
          let systemPrompt: string;
          const storedContext = callContexts.get(callSid);
          if (storedContext) {
            systemPrompt = storedContext.systemPrompt;
            callContexts.delete(callSid);
          } else {
            systemPrompt = SYSTEM_PROMPTS.guestOutbound("Emergency maintenance issue reported");
          }

          geminiSession = new GeminiLiveSession({
            systemPrompt,
            onAudio: (base64Pcm: string) => {
              const twilioAudio = geminiToTwilio(base64Pcm);
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ event: "media", streamSid, media: { payload: twilioAudio } }));
              }
            },
            onText: (text: string) => {
              if (text.trim()) {
                addTranscriptLine("Agent", text);
              }
            },
            onError: (err: Error) => console.error(`[Gemini ERR] ${err.message}`),
            onClose: () => { activeCalls.delete(callSid); },
            onCallEnd: () => { triggerCallEnd(callSid); },
          });

          await geminiSession.connect();
          console.log(`[WS] Cold-started Gemini session`);
          geminiSession.sendText("The person just picked up the phone. Start speaking now with your opening line.");
        }

        activeCalls.set(callSid, { gemini: geminiSession, streamSid, startedAt: Date.now(), incidentId });
        break;
      }

      case "media":
        if (geminiSession && msg.media?.payload) {
          const pcmData = twilioToGemini(msg.media.payload);
          if (pcmData.length > 0) {
            geminiSession.sendAudio(pcmData);
          }
        }
        break;

      case "stop":
        console.log(`[WS] Stopped: ${streamSid}`);
        if (geminiSession) { await geminiSession.close(); geminiSession = null; }
        activeCalls.delete(callSid);
        // Final transcript flush
        if (callLogId) {
          supabase.from("call_logs").update({
            transcript: transcriptParts.join("\n"),
            duration_seconds: Math.floor((Date.now() - (activeCalls.get(callSid)?.startedAt || Date.now())) / 1000),
          }).eq("id", callLogId).then(() => {});
        }
        triggerCallEnd(callSid);
        break;
    }
  });

  ws.on("close", async () => {
    if (geminiSession) { await geminiSession.close(); geminiSession = null; }
    if (callLogId) {
      supabase.from("call_logs").update({
        transcript: transcriptParts.join("\n"),
      }).eq("id", callLogId).then(() => {});
    }
    if (callSid) { activeCalls.delete(callSid); triggerCallEnd(callSid); }
  });

  ws.on("error", (err) => console.error("[WS] Error:", err.message));
}

export function getActiveCalls() {
  return {
    count: activeCalls.size,
    calls: Array.from(activeCalls.entries()).map(([callSid, { streamSid, startedAt }]) => ({
      callSid, streamSid, durationSec: Math.floor((Date.now() - startedAt) / 1000),
    })),
  };
}

function getWebSocketUrl(req: Request): string {
  if (config.ngrokUrl) return config.ngrokUrl.replace(/^https?:\/\//, "wss://") + "/twilio/media-stream";
  const host = req.headers.host || `localhost:${config.port}`;
  return `${req.secure ? "wss" : "ws"}://${host}/twilio/media-stream`;
}
