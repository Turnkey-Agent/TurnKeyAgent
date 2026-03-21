import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(new URL(".", import.meta.url).pathname, "../../.env"), override: true });

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
  twilioAccountSid: required("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: required("TWILIO_AUTH_TOKEN"),
  twilioPhoneNumber: required("TWILIO_PHONE_NUMBER"),

  // Supabase
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),

  // Server
  port: parseInt(process.env.BRIDGE_PORT || "3000", 10),
  ngrokUrl: process.env.NGROK_URL || "",
};
