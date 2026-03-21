import type { Request, Response } from "express";
import type { WebSocket as WS } from "ws";
import { config } from "./config.js";
import { GeminiLiveSession, SYSTEM_PROMPTS } from "./gemini-session.js";
import { twilioToGemini, geminiToTwilio } from "./audio-utils.js";

// Track active calls
const activeCalls = new Map<
  string,
  { gemini: GeminiLiveSession; streamSid: string; startedAt: number }
>();

// Store context for outbound calls (keyed by CallSid)
const callContexts = new Map<string, { systemPrompt: string; type: string }>();

/**
 * POST /twilio/voice — Inbound call webhook.
 */
export function handleIncomingCall(req: Request, res: Response): void {
  const callSid = req.body?.CallSid || "unknown";
  const from = req.body?.From || "unknown";
  console.log(`[Twilio] Inbound call from ${from} (${callSid})`);

  const wsUrl = getWebSocketUrl(req);
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="callSid" value="${callSid}" />
      <Parameter name="callerNumber" value="${from}" />
      <Parameter name="direction" value="inbound" />
    </Stream>
  </Connect>
</Response>`;

  res.type("text/xml").send(twiml);
}

/**
 * POST /twilio/voice/outbound — Outbound call webhook.
 */
export function handleOutboundCall(req: Request, res: Response): void {
  const callSid = req.body?.CallSid || "unknown";
  console.log(`[Twilio] Outbound call connected (${callSid})`);

  const wsUrl = getWebSocketUrl(req);
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="callSid" value="${callSid}" />
      <Parameter name="direction" value="outbound" />
    </Stream>
  </Connect>
</Response>`;

  res.type("text/xml").send(twiml);
}

/**
 * POST /initiate-call — Dashboard triggers an outbound call.
 * Body: { to: "+1234567890", situation: "Bathroom flooding...", type: "guest"|"vendor"|"landlord" }
 */
export async function initiateCall(req: Request, res: Response): Promise<void> {
  const { to, situation, type = "guest" } = req.body;

  if (!to || !situation) {
    res.status(400).json({ error: "Missing 'to' and 'situation' fields" });
    return;
  }

  // Build the system prompt based on call type
  let systemPrompt: string;
  switch (type) {
    case "vendor":
      systemPrompt = SYSTEM_PROMPTS.vendorOutbound(situation);
      break;
    case "landlord":
      systemPrompt = SYSTEM_PROMPTS.landlordOutbound(situation, req.body.quotes || "No quotes yet");
      break;
    default:
      systemPrompt = SYSTEM_PROMPTS.guestOutbound(situation);
  }

  const webhookUrl = config.ngrokUrl
    ? `${config.ngrokUrl}/twilio/voice/outbound`
    : `http://localhost:${config.port}/twilio/voice/outbound`;

  try {
    const authHeader = Buffer.from(
      `${config.twilioAccountSid}:${config.twilioAuthToken}`
    ).toString("base64");

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: config.twilioPhoneNumber,
          Url: webhookUrl,
        }),
      }
    );

    const callData = await twilioRes.json();

    if (callData.sid) {
      // Store context so when the WebSocket connects, we know which prompt to use
      callContexts.set(callData.sid, { systemPrompt, type });
      console.log(`[Twilio] Outbound call initiated: ${callData.sid} → ${to}`);
      res.json({ callSid: callData.sid, status: callData.status, to });
    } else {
      console.error("[Twilio] Call failed:", callData);
      res.status(500).json({ error: callData.message || "Call failed" });
    }
  } catch (err) {
    console.error("[Twilio] Call initiation error:", err);
    res.status(500).json({ error: String(err) });
  }
}

/**
 * Handle a Twilio Media Streams WebSocket connection.
 */
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

        // Get system prompt — check stored context first (for dashboard-initiated calls)
        let systemPrompt: string;
        const storedContext = callContexts.get(callSid);
        if (storedContext) {
          systemPrompt = storedContext.systemPrompt;
          callContexts.delete(callSid);
          console.log(`[WS] Using stored ${storedContext.type} prompt`);
        } else if (direction === "outbound") {
          systemPrompt = SYSTEM_PROMPTS.vendorOutbound("Emergency maintenance issue");
        } else {
          systemPrompt = SYSTEM_PROMPTS.guestInbound;
        }

        // Create Gemini Live session
        geminiSession = new GeminiLiveSession({
          systemPrompt,
          onAudio: (base64Pcm: string) => {
            const twilioAudio = geminiToTwilio(base64Pcm);
            if (ws.readyState === ws.OPEN) {
              ws.send(
                JSON.stringify({
                  event: "media",
                  streamSid,
                  media: { payload: twilioAudio },
                })
              );
            }
          },
          onText: (text: string) => {
            if (text.trim()) console.log(`[Agent] ${text.slice(0, 150)}`);
          },
          onError: (err: Error) => {
            console.error(`[Gemini ERR] ${callSid}: ${err.message}`);
          },
          onClose: () => {
            console.log(`[Gemini] Closed: ${callSid}`);
            activeCalls.delete(callSid);
          },
        });

        await geminiSession.connect();
        activeCalls.set(callSid, {
          gemini: geminiSession,
          streamSid,
          startedAt: Date.now(),
        });
        break;
      }

      case "media": {
        if (geminiSession && msg.media?.payload) {
          const geminiAudio = twilioToGemini(msg.media.payload);
          geminiSession.sendAudio(geminiAudio);
        }
        break;
      }

      case "stop":
        console.log(`[WS] Stopped: ${streamSid}`);
        if (geminiSession) {
          await geminiSession.close();
          geminiSession = null;
        }
        activeCalls.delete(callSid);
        break;
    }
  });

  ws.on("close", async () => {
    if (geminiSession) {
      await geminiSession.close();
      geminiSession = null;
    }
    if (callSid) activeCalls.delete(callSid);
  });

  ws.on("error", (err) => {
    console.error("[WS] Error:", err.message);
  });
}

export function getActiveCalls() {
  const calls = Array.from(activeCalls.entries()).map(
    ([callSid, { streamSid, startedAt }]) => ({
      callSid,
      streamSid,
      durationSec: Math.floor((Date.now() - startedAt) / 1000),
    })
  );
  return { count: calls.length, calls };
}

function getWebSocketUrl(req: Request): string {
  if (config.ngrokUrl) {
    const wsUrl = config.ngrokUrl.replace(/^https?:\/\//, "wss://");
    return `${wsUrl}/twilio/media-stream`;
  }
  const host = req.headers.host || `localhost:${config.port}`;
  const protocol = req.secure ? "wss" : "ws";
  return `${protocol}://${host}/twilio/media-stream`;
}
