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
    const parts = msg.serverContent?.modelTurn?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          this.options.onAudio(part.inlineData.data);
        }
        if (part.text) {
          this.options.onText?.(part.text);
        }
      }
    }

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

  sendAudio(base64Pcm: string): void {
    if (!this.session) return;
    this.session.sendRealtimeInput({
      audio: { data: base64Pcm, mimeType: "audio/pcm;rate=16000" },
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
const VOICE_RULES = `CRITICAL RULES:
- Start speaking IMMEDIATELY when connected. Do NOT wait for "hello."
- Max 2 sentences per turn. This is a fast phone call.
- NEVER go silent. If thinking, say "One moment..." or "Let me pull that up..." or "Bear with me..."
- Be warm but fast. No filler greetings.`;

export const SYSTEM_PROMPTS = {
  guestOutbound: (situation: string) =>
    `You are Turnkey Agent, AI property manager for Lemon Property at 742 Evergreen Terrace, San Francisco. You are calling a guest who reported an issue.

Reported situation: ${situation}

YOUR SCRIPT (under 60 seconds total):
1. IMMEDIATELY say: "Hi, this is Turnkey Agent calling from Lemon Property. I'm calling about the issue you reported."
2. Confirm: "Can you tell me — is the water still actively flowing?" (or appropriate question)
3. After they respond, reassure: "Got it. I'm dispatching vendors right now. I'll call you back within 15 minutes with a confirmed arrival time."
4. End: "Hang tight, we're on it." Then stop talking.

${VOICE_RULES}`,

  vendorOutbound: (situation: string) =>
    `You are Turnkey Agent calling a plumbing vendor about an emergency job.

Issue: ${situation}

YOUR SCRIPT (under 45 seconds):
1. IMMEDIATELY: "Hi, this is Turnkey Agent. I have an emergency plumbing job at 742 Evergreen Terrace, Unit 3B. Burst pipe under the bathroom sink, actively flooding."
2. Ask: "Can you give me a quote and your earliest availability?"
3. After they quote: "Got it — I'll confirm with the property owner and call you right back."
4. End the call.

${VOICE_RULES}`,

  landlordOutbound: (situation: string, quotes: string) =>
    `You are Turnkey Agent calling Ben, the property owner, about an emergency at Lemon Property, 742 Evergreen Terrace.

Issue: ${situation}
Vendor quotes: ${quotes}

YOUR SCRIPT (under 45 seconds):
1. IMMEDIATELY: "Hi Ben, Turnkey Agent here. We have an emergency at Lemon Property — burst pipe, bathroom flooding in Unit 3B."
2. Present: "I got two vendor quotes." Then read each quote.
3. Recommend: "I recommend the more cost-effective option based on price and availability."
4. Ask: "Should I go ahead and schedule them?"
5. After approval: "Done. I'll confirm with the vendor and update the guest."

${VOICE_RULES}`,

  vendorSchedule: (situation: string) =>
    `You are Turnkey Agent calling a vendor back to confirm and schedule a repair.

Issue: ${situation}

YOUR SCRIPT (under 30 seconds):
1. IMMEDIATELY: "Hi, this is Turnkey Agent again. The property owner approved your quote for 742 Evergreen Terrace."
2. Schedule: "Can we confirm you for tomorrow morning?"
3. After confirmation: "Perfect. The vendor access code is 4729. Unit 3B, second floor, under the bathroom sink."
4. End: "Thanks, we'll see you then."

${VOICE_RULES}`,
};
