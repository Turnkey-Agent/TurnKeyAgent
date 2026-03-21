import type { Request, Response } from "express";
import type { WebSocket as WS } from "ws";
import { config } from "./config.js";
import { GeminiLiveSession, SYSTEM_PROMPTS } from "./gemini-session.js";
import { twilioToGemini, geminiToTwilio } from "./audio-utils.js";
import { triggerCallEnd } from "./workflow.js";

// Active calls
const activeCalls = new Map<string, { gemini: GeminiLiveSession; streamSid: string; startedAt: number }>();

// Call context store — workflow.ts writes, handleMediaStream reads
const callContexts = new Map<string, { systemPrompt: string; type: string }>();

export function storeCallContext(callSid: string, systemPrompt: string, type: string) {
  callContexts.set(callSid, { systemPrompt, type });
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
<Response><Connect><Stream url="${wsUrl}">
  <Parameter name="callSid" value="${callSid}" />
  <Parameter name="direction" value="outbound" />
</Stream></Connect></Response>`);
}

export function handleMediaStream(ws: WS): void {
  let streamSid = "";
  let callSid = "";
  let geminiSession: GeminiLiveSession | null = null;

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

        // Get system prompt from stored context (workflow) or default
        let systemPrompt: string;
        const storedContext = callContexts.get(callSid);
        if (storedContext) {
          systemPrompt = storedContext.systemPrompt;
          callContexts.delete(callSid);
          console.log(`[WS] Using ${storedContext.type} prompt`);
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
            if (text.trim()) console.log(`[Agent] ${text.slice(0, 120)}`);
          },
          onError: (err: Error) => console.error(`[Gemini ERR] ${err.message}`),
          onClose: () => {
            console.log(`[Gemini] Closed: ${callSid}`);
            activeCalls.delete(callSid);
          },
          onCallEnd: () => {
            // Trigger workflow progression
            triggerCallEnd(callSid);
          },
        });

        await geminiSession.connect();
        activeCalls.set(callSid, { gemini: geminiSession, streamSid, startedAt: Date.now() });
        break;
      }

      case "media":
        if (geminiSession && msg.media?.payload) {
          geminiSession.sendAudio(twilioToGemini(msg.media.payload));
        }
        break;

      case "stop":
        console.log(`[WS] Stopped: ${streamSid}`);
        if (geminiSession) { await geminiSession.close(); geminiSession = null; }
        activeCalls.delete(callSid);
        // Trigger workflow when stream stops (call ended)
        triggerCallEnd(callSid);
        break;
    }
  });

  ws.on("close", async () => {
    if (geminiSession) { await geminiSession.close(); geminiSession = null; }
    if (callSid) {
      activeCalls.delete(callSid);
      triggerCallEnd(callSid);
    }
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
