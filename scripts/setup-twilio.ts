/**
 * Configure Twilio phone number webhooks to point at your ngrok URL.
 *
 * Usage: npx tsx scripts/setup-twilio.ts <ngrok-url>
 * Example: npx tsx scripts/setup-twilio.ts https://abc123.ngrok.io
 */

import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(new URL(".", import.meta.url).pathname, "../.env") });

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER!;

const ngrokUrl = process.argv[2];

if (!ngrokUrl) {
  console.error("Usage: npx tsx scripts/setup-twilio.ts <ngrok-url>");
  console.error("Example: npx tsx scripts/setup-twilio.ts https://abc123.ngrok.io");
  process.exit(1);
}

async function setup() {
  const authHeader = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
  ).toString("base64");

  // Find the phone number SID
  const listRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(TWILIO_PHONE_NUMBER)}`,
    { headers: { Authorization: `Basic ${authHeader}` } }
  );
  const listData = await listRes.json();
  const phoneSid = listData.incoming_phone_numbers?.[0]?.sid;

  if (!phoneSid) {
    console.error(`Phone number ${TWILIO_PHONE_NUMBER} not found on account`);
    process.exit(1);
  }

  // Update the voice webhook URL
  const voiceUrl = `${ngrokUrl}/twilio/voice`;
  const updateRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${phoneSid}.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        VoiceUrl: voiceUrl,
        VoiceMethod: "POST",
      }),
    }
  );

  if (updateRes.ok) {
    console.log(`Twilio webhook configured:`);
    console.log(`  Phone: ${TWILIO_PHONE_NUMBER}`);
    console.log(`  Voice URL: ${voiceUrl}`);
    console.log(`\nReady! Call ${TWILIO_PHONE_NUMBER} to test.`);
  } else {
    const err = await updateRes.json();
    console.error("Failed to update webhook:", err);
    process.exit(1);
  }
}

setup().catch(console.error);
