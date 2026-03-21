import { GoogleGenAI, type Session, type LiveServerMessage } from "@google/genai";
import { config } from "./config.js";
import { toolDeclarations, handleToolCall } from "./tools.js";

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

export interface GeminiSessionOptions {
  systemPrompt: string;
  incidentId?: string;
  callType?: string;
  onAudio: (base64Pcm: string) => void;
  onText?: (text: string) => void;
  onCallEnd?: () => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export class GeminiLiveSession {
  private session: Session | null = null;
  private options: GeminiSessionOptions;
  private retryCount = 0;
  private maxRetries = 2;
  private closed = false;
  private audioChunksSent = 0;
  private audioChunksReceived = 0;

  constructor(options: GeminiSessionOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    try {
      this.session = await ai.live.connect({
        model: config.geminiLiveModel,
        config: {
          systemInstruction: this.options.systemPrompt,
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Aoede" },
            },
          },
          tools: [{ functionDeclarations: toolDeclarations }],
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              prefixPaddingMs: 50,
              silenceDurationMs: 400,
            },
          },
        },
        callbacks: {
          onopen: () => {
            console.log("[Gemini] Live session connected");
            this.retryCount = 0;
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
          onerror: (err: ErrorEvent) => {
            console.error("[Gemini] Error:", err.message);
            this.options.onError?.(new Error(err.message));
          },
          onclose: (ev: CloseEvent) => {
            console.log("[Gemini] Closed:", ev.reason?.slice(0, 100));
            if (!this.closed && this.retryCount < this.maxRetries) {
              this.retryCount++;
              console.log(`[Gemini] Reconnecting (${this.retryCount}/${this.maxRetries})...`);
              setTimeout(() => this.connect(), 1000 * this.retryCount);
            } else {
              this.options.onClose?.();
              this.options.onCallEnd?.();
            }
          },
        },
      });
    } catch (err) {
      console.error("[Gemini] Connect failed:", err);
      throw err;
    }
  }

  private async handleMessage(msg: LiveServerMessage): Promise<void> {
    // Handle audio/text output from Gemini
    const parts = msg.serverContent?.modelTurn?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          this.audioChunksReceived++;
          if (this.audioChunksReceived <= 3 || this.audioChunksReceived % 50 === 0) {
            console.log(`[Audio] Gemini -> caller: chunk #${this.audioChunksReceived}, ${part.inlineData.data.length} b64 chars`);
          }
          this.options.onAudio(part.inlineData.data);
        }
        if (part.text) {
          this.options.onText?.(part.text);
        }
      }
    } else if (msg.serverContent) {
      // Log input transcription (what Gemini heard from the caller)
      const sc = msg.serverContent as Record<string, unknown>;
      if (sc.inputTranscription) {
        const transcript = sc.inputTranscription as Record<string, string>;
        if (transcript.text) {
          console.log(`[Caller said] "${transcript.text}"`);
          this.options.onText?.(`[Caller] ${transcript.text}`);
        }
      }
      if (sc.outputTranscription) {
        const transcript = sc.outputTranscription as Record<string, string>;
        if (transcript.text) {
          console.log(`[Agent said] "${transcript.text}"`);
        }
      }
      // Log other unexpected content types for debugging
      const keys = Object.keys(msg.serverContent);
      const knownKeys = ["modelTurn", "turnComplete", "interrupted", "inputTranscription", "outputTranscription"];
      const unknownKeys = keys.filter(k => !knownKeys.includes(k));
      if (unknownKeys.length > 0) {
        console.log(`[Gemini] serverContent keys: ${keys.join(", ")}`);
      }
    }

    // Handle tool calls
    const toolCall = msg.toolCall;
    if (toolCall?.functionCalls) {
      const responses = await Promise.all(
        toolCall.functionCalls.map(async (fc) => {
          console.log(`[Tool] ${fc.name}(${JSON.stringify(fc.args).slice(0, 100)})`);
          try {
            const result = await handleToolCall(fc.name, fc.args as Record<string, unknown>);
            return { id: fc.id, name: fc.name, response: { result } };
          } catch (err) {
            console.error(`[Tool ERR] ${fc.name}:`, err);
            return { id: fc.id, name: fc.name, response: { error: String(err) } };
          }
        })
      );
      if (this.session) {
        this.session.sendToolResponse({ functionResponses: responses });
      }
    }
  }

  /** Rewire audio output — used by pre-warming to attach to the actual WebSocket */
  setAudioHandler(handler: (base64Pcm: string) => void): void {
    this.options.onAudio = handler;
  }

  /** Rewire text output — used by pre-warming to attach transcript capture */
  setTextHandler(handler: (text: string) => void): void {
    this.options.onText = handler;
  }

  /** Send a text message to Gemini to trigger a response (used to kick off speech) */
  sendText(text: string): void {
    if (!this.session) return;
    this.session.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
  }

  sendAudio(base64Pcm: string): void {
    if (!this.session) return;
    this.audioChunksSent++;
    if (this.audioChunksSent <= 5 || this.audioChunksSent % 100 === 0) {
      console.log(`[Audio] Caller -> Gemini: chunk #${this.audioChunksSent}, ${base64Pcm.length} b64 chars`);
    }
    this.session.sendRealtimeInput({
      audio: { data: base64Pcm, mimeType: "audio/pcm;rate=8000" },
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }
}

// ──────────────────────────────────────────────────────────────
// SYSTEM PROMPTS — 742 Evergreen Terrace (matches seed data)
// ──────────────────────────────────────────────────────────────
const VOICE_RULES = `CONVERSATION RULES:
- Start speaking IMMEDIATELY when connected. Do NOT wait for "hello."
- Keep each response to 1-2 sentences. This is a quick phone call.
- LISTEN to what the other person says and respond to it. This is a real-time conversation, not a recording.
- If you need a moment, say "One moment..." or "Let me check on that..."
- Be warm, professional, and concise.
- Adapt your responses based on what the caller says — do NOT follow a fixed script.
- If the other person asks a question, answer it before moving on.
- If they seem confused, clarify. If they interrupt, let them speak and respond to what they said.`;

export const SYSTEM_PROMPTS = {
  guestOutbound: (situation: string) =>
    `You are Turnkey Agent, an AI property manager for Lemon Property at 742 Evergreen Terrace, San Francisco. You are calling a guest who reported a maintenance issue.

Reported situation: ${situation}

YOUR GOALS for this call (in order of priority):
1. Introduce yourself briefly and reference the issue they reported.
2. Confirm the current status — ask if the problem is still active (e.g., "Is water still flowing?" for plumbing).
3. Listen to their answer and ask any follow-up questions based on what they say.
4. Reassure them that you are dispatching vendors and will call back with an ETA.
5. Wrap up the call politely.

IMPORTANT: This is a two-way conversation. The guest may have questions, provide additional details, or express concern. Listen and respond naturally. Do not recite a script.

${VOICE_RULES}`,

  vendorOutbound: (situation: string) =>
    `You are Turnkey Agent, an AI property management service. You are calling a plumbing vendor about an emergency repair job.

Issue details: ${situation}
Property: 742 Evergreen Terrace, Unit 3B, San Francisco

YOUR GOALS for this call:
1. Introduce yourself and describe the emergency job.
2. Ask for a price quote and earliest availability.
3. Listen to their response — they may ask questions about the job, access, location, or scope. Answer what you can.
4. Once you have a quote and timeframe, confirm you'll check with the property owner and call back.

IMPORTANT: The vendor will likely ask questions. Answer them naturally:
- Location: 742 Evergreen Terrace, Unit 3B, second floor, under the bathroom sink
- Access: You can provide an access code once confirmed
- Scope: Based on the reported issue description above
- If you don't know something, say so honestly.

${VOICE_RULES}`,

  landlordOutbound: (situation: string, quotes: string) =>
    `You are Turnkey Agent, an AI property management service. You are calling Ben, the property owner of Lemon Property at 742 Evergreen Terrace.

Issue: ${situation}
Vendor quotes collected: ${quotes}

YOUR GOALS for this call:
1. Briefly explain the emergency situation.
2. Present the vendor quotes you collected.
3. Give your recommendation (usually the best value considering price and availability).
4. Ask if Ben wants to approve and schedule the repair.
5. Listen to his decision and any questions he has.

IMPORTANT: Ben may ask about the damage severity, insurance, costs, or other options. Answer based on what you know. If he wants to discuss or pushes back, engage naturally. Do not just recite quotes — have a conversation about them.

${VOICE_RULES}`,

  vendorSchedule: (situation: string) =>
    `You are Turnkey Agent, an AI property management service. You are calling a vendor back to confirm and schedule a repair that the property owner has approved.

Issue: ${situation}
Property: 742 Evergreen Terrace, Unit 3B, San Francisco

YOUR GOALS for this call:
1. Let them know the property owner approved their quote.
2. Coordinate a time — suggest tomorrow morning if possible.
3. Provide the access details: vendor access code 4729, Unit 3B, second floor, under the bathroom sink.
4. Confirm the appointment and wrap up.

IMPORTANT: The vendor may suggest a different time, ask about parking, access, or other logistics. Be flexible and answer their questions naturally.

${VOICE_RULES}`,
};
