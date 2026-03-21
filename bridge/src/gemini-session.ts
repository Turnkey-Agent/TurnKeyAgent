import { GoogleGenAI, type Session, type LiveServerMessage } from "@google/genai";
import { config } from "./config.js";
import { toolDeclarations, handleToolCall } from "./tools.js";

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

export interface GeminiSessionOptions {
  systemPrompt: string;
  onAudio: (base64Pcm: string) => void;
  onText?: (text: string) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export class GeminiLiveSession {
  private session: Session | null = null;
  private options: GeminiSessionOptions;
  private retryCount = 0;
  private maxRetries = 3;
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
            console.error("[Gemini] Session error:", err.message);
            this.options.onError?.(new Error(err.message));
          },
          onclose: (ev: CloseEvent) => {
            console.log("[Gemini] Session closed:", ev.reason);
            if (!this.closed && this.retryCount < this.maxRetries) {
              this.retryCount++;
              console.log(
                `[Gemini] Reconnecting (attempt ${this.retryCount}/${this.maxRetries})...`
              );
              setTimeout(() => this.connect(), 1000 * this.retryCount);
            } else {
              this.options.onClose?.();
            }
          },
        },
      });
    } catch (err) {
      console.error("[Gemini] Failed to connect:", err);
      throw err;
    }
  }

  private async handleMessage(msg: LiveServerMessage): Promise<void> {
    // Handle audio responses
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

    // Handle function calls
    const toolCall = msg.toolCall;
    if (toolCall?.functionCalls) {
      const responses = [];
      for (const fc of toolCall.functionCalls) {
        console.log(`[Gemini] Tool call: ${fc.name}(${JSON.stringify(fc.args)})`);
        try {
          const result = await handleToolCall(fc.name, fc.args as Record<string, unknown>);
          responses.push({
            id: fc.id,
            name: fc.name,
            response: { result },
          });
          console.log(`[Gemini] Tool result for ${fc.name}:`, JSON.stringify(result).slice(0, 200));
        } catch (err) {
          console.error(`[Gemini] Tool error for ${fc.name}:`, err);
          responses.push({
            id: fc.id,
            name: fc.name,
            response: { error: String(err) },
          });
        }
      }

      // Send tool responses back to Gemini
      if (this.session) {
        this.session.sendToolResponse({
          functionResponses: responses,
        });
      }
    }
  }

  /**
   * Send audio data to Gemini (base64 PCM 16kHz)
   */
  sendAudio(base64Pcm: string): void {
    if (!this.session) return;
    this.session.sendRealtimeInput({
      audio: {
        data: base64Pcm,
        mimeType: "audio/pcm;rate=16000",
      },
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

/**
 * System prompts for different call scenarios
 */
export const SYSTEM_PROMPTS = {
  guestInbound: `You are the Turnkey Agent, an AI property management assistant for Lemon Property at 742 Evergreen Terrace, San Francisco.

You are receiving an inbound call from a guest. Be calm, empathetic, and professional.

Your job:
1. Listen to the guest's maintenance issue
2. Ask clarifying questions (location, severity, when it started)
3. Search the maintenance history for similar past issues
4. Reassure the guest that help is being dispatched
5. Create an incident in the system

Personality: Warm but efficient. Acknowledge frustration. Never be defensive. Use the guest's name if available.

You have access to these tools: search_maintenance_history, create_incident, update_incident_status.`,

  vendorOutbound: `You are the Turnkey Agent calling a vendor on behalf of Lemon Property at 742 Evergreen Terrace, San Francisco.

Be professional, efficient, and direct. Your goal:
1. Describe the emergency maintenance issue
2. Mention any relevant history (e.g. "this unit had a similar issue before")
3. Get a quote (cost and time estimate)
4. Log the quote

Personality: Business-like, respectful of the vendor's time.

You have access to these tools: log_vendor_quote, update_incident_status.`,

  landlordOutbound: `You are the Turnkey Agent calling the property owner about a maintenance emergency at Lemon Property, 742 Evergreen Terrace, San Francisco.

Be concise and data-driven. Present:
1. The issue summary
2. Both vendor quotes side by side
3. Your recommendation with reasoning
4. Ask for approval

Personality: Concise, respects the owner's time, presents clear data.

You have access to these tools: update_incident_status, schedule_repair.`,

  vendorAccess: `You are the Turnkey Agent. A vendor is calling for property access.

Verify the caller is a scheduled vendor, then provide the vendor access code.
Never give out the guest access code.

You have access to these tools: get_vendor_access_code, update_incident_status.`,
};
