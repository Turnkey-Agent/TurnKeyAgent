import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env"), override: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  // Gemini
  geminiApiKey: required("GEMINI_API_KEY"),
  geminiLiveModel: "gemini-2.5-flash-native-audio-latest",
  geminiReasoningModel: "gemini-2.0-flash",

  // Twilio
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "+16282370507",

  // Supabase
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),

  // Server
  port: parseInt(process.env.BRIDGE_PORT || "3456", 10),
  ngrokUrl: process.env.NGROK_URL || "",
};
