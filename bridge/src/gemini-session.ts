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
          // Latency optimizations
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 200,
            thinkingConfig: { thinkingBudget: 0 },
          },
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: "START_OF_SPEECH_SENSITIVITY_HIGH",
              endOfSpeechSensitivity: "END_OF_SPEECH_SENSITIVITY_HIGH",
              prefixPaddingMs: 20,
              silenceDurationMs: 100,
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
    // Handle audio responses — forward immediately for lowest latency
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

    // Handle function calls — run in parallel for speed
    const toolCall = msg.toolCall;
    if (toolCall?.functionCalls) {
      const responses = await Promise.all(
        toolCall.functionCalls.map(async (fc) => {
          console.log(`[Gemini] Tool: ${fc.name}(${JSON.stringify(fc.args)})`);
          try {
            const result = await handleToolCall(fc.name, fc.args as Record<string, unknown>);
            console.log(`[Gemini] Tool OK: ${fc.name}`);
            return { id: fc.id, name: fc.name, response: { result } };
          } catch (err) {
            console.error(`[Gemini] Tool ERR: ${fc.name}:`, err);
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
      audio: {
        data: base64Pcm,
        mimeType: "audio/pcm;rate=8000",
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
 * System prompts — kept SHORT to reduce first-response latency.
 * Property: 123 Lemon Drive, San Francisco
 */
export const SYSTEM_PROMPTS = {
  guestOutbound: (situation: string) =>
    `You are Turnkey Agent, AI property manager for 123 Lemon Drive, San Francisco. You are CALLING a guest about a reported issue.

Situation: ${situation}

Be empathetic and professional. Confirm the issue details, ask clarifying questions (exact location, severity, when it started), reassure them help is coming. Keep responses SHORT — this is a phone call.

Tools: search_maintenance_history, create_incident, update_incident_status.`,

  guestInbound: `You are Turnkey Agent, AI property manager for 123 Lemon Drive, San Francisco. A guest is calling with a maintenance issue.

Be calm, empathetic, brief. Ask what's wrong, clarify details, search history, create incident, reassure help is coming. Keep responses SHORT.

Tools: search_maintenance_history, create_incident, update_incident_status.`,

  vendorOutbound: (situation: string) =>
    `You are Turnkey Agent calling a vendor for 123 Lemon Drive, San Francisco.

Issue: ${situation}

Be direct and efficient. Describe the emergency, mention relevant history, get a quote (cost + ETA). Keep it brief.

Tools: log_vendor_quote, update_incident_status.`,

  landlordOutbound: (situation: string, quotes: string) =>
    `You are Turnkey Agent calling the property owner about 123 Lemon Drive, San Francisco.

Issue: ${situation}
Quotes: ${quotes}

Present issue summary, both quotes side-by-side, your recommendation, ask for approval. Be concise.

Tools: update_incident_status, schedule_repair.`,

  vendorAccess: `You are Turnkey Agent. A vendor is calling for property access at 123 Lemon Drive.

Verify caller is a scheduled vendor, then give vendor access code. Never give guest code. Be brief.

Tools: get_vendor_access_code, update_incident_status.`,
};
