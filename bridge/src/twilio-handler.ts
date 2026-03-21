import type { Request, Response } from "express";
import type { WebSocket as WS } from "ws";
import { config } from "./config.js";
import { GeminiLiveSession, SYSTEM_PROMPTS } from "./gemini-session.js";
import { twilioToGemini, geminiToTwilio } from "./audio-utils.js";

// Track active calls
const activeCalls = new Map<
  string,
  { gemini: GeminiLiveSession; streamSid: string }
>();

/**
 * POST /twilio/voice — Inbound call webhook.
 * Returns TwiML that connects to our WebSocket for Media Streams.
 */
export function handleIncomingCall(req: Request, res: Response): void {
  const callSid = req.body?.CallSid || "unknown";
  const from = req.body?.From || "unknown";
  console.log(`[Twilio] Inbound call from ${from} (CallSid: ${callSid})`);

  // Determine the WebSocket URL for Media Streams
  const wsUrl = getWebSocketUrl(req);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="callSid" value="${callSid}" />
      <Parameter name="callerNumber" value="${from}" />
    </Stream>
  </Connect>
</Response>`;

  res.type("text/xml").send(twiml);
}

/**
 * POST /twilio/voice/outbound — Outbound call webhook (called by Twilio when call connects).
 */
export function handleOutboundCall(req: Request, res: Response): void {
  const callSid = req.body?.CallSid || "unknown";
  console.log(`[Twilio] Outbound call connected (CallSid: ${callSid})`);

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
        console.log("[Twilio WS] Connected");
        break;

      case "start": {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        const params = msg.start.customParameters || {};
        const callerNumber = params.callerNumber || "";
        const direction = params.direction || "inbound";

        console.log(
          `[Twilio WS] Stream started: ${streamSid} | Call: ${callSid} | From: ${callerNumber} | Direction: ${direction}`
        );

        // Choose system prompt based on call direction
        const systemPrompt =
          direction === "outbound"
            ? SYSTEM_PROMPTS.vendorOutbound
            : SYSTEM_PROMPTS.guestInbound;

        // Create Gemini Live session
        geminiSession = new GeminiLiveSession({
          systemPrompt,
          onAudio: (base64Pcm: string) => {
            // Convert Gemini audio → Twilio μ-law and send back
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
            console.log(`[Gemini → Text] ${text}`);
          },
          onError: (err: Error) => {
            console.error(`[Gemini] Error for call ${callSid}:`, err.message);
          },
          onClose: () => {
            console.log(`[Gemini] Session closed for call ${callSid}`);
            activeCalls.delete(callSid);
          },
        });

        await geminiSession.connect();
        activeCalls.set(callSid, { gemini: geminiSession, streamSid });
        break;
      }

      case "media": {
        // Forward audio from Twilio to Gemini
        if (geminiSession && msg.media?.payload) {
          const geminiAudio = twilioToGemini(msg.media.payload);
          geminiSession.sendAudio(geminiAudio);
        }
        break;
      }

      case "stop":
        console.log(`[Twilio WS] Stream stopped: ${streamSid}`);
        if (geminiSession) {
          await geminiSession.close();
          geminiSession = null;
        }
        activeCalls.delete(callSid);
        break;

      default:
        break;
    }
  });

  ws.on("close", async () => {
    console.log(`[Twilio WS] WebSocket closed for stream: ${streamSid}`);
    if (geminiSession) {
      await geminiSession.close();
      geminiSession = null;
    }
    if (callSid) activeCalls.delete(callSid);
  });

  ws.on("error", (err) => {
    console.error("[Twilio WS] WebSocket error:", err.message);
  });
}

/**
 * Get the number of active calls.
 */
export function getActiveCalls(): {
  count: number;
  calls: Array<{ callSid: string; streamSid: string }>;
} {
  const calls = Array.from(activeCalls.entries()).map(
    ([callSid, { streamSid }]) => ({
      callSid,
      streamSid,
    })
  );
  return { count: calls.length, calls };
}

function getWebSocketUrl(req: Request): string {
  // Use ngrok URL if configured, otherwise derive from request
  if (config.ngrokUrl) {
    const wsUrl = config.ngrokUrl.replace(/^https?:\/\//, "wss://");
    return `${wsUrl}/twilio/media-stream`;
  }
  const host = req.headers.host || `localhost:${config.port}`;
  const protocol = req.secure ? "wss" : "ws";
  return `${protocol}://${host}/twilio/media-stream`;
}
