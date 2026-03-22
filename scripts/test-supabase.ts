#!/usr/bin/env tsx
/**
 * Test script to verify Supabase connection and table access
 *
 * Usage: npx tsx scripts/test-supabase.ts
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log("🔍 Testing Supabase connection...");
  console.log(`   URL: ${supabaseUrl}\n`);

  // Test 0: Verify which project we're connected to
  console.log("0️⃣ Verifying Supabase project...");
  const { data: projectInfo, error: projectError } = await supabase.rpc('version');
  if (projectError) {
    console.log(`   ℹ️  Could not get version (this is normal): ${projectError.message}`);
  } else {
    console.log(`   ℹ️  Version:`, projectInfo);
  }
  
  // Try to get current database name
  const { data: dbInfo, error: dbError } = await supabase
    .from('information_schema.schemata')
    .select('catalog_name')
    .eq('schema_name', 'public')
    .single();
  if (dbError) {
    console.log(`   ℹ️  Could not get DB name: ${dbError.message}`);
  } else {
    console.log(`   ℹ️  Database: ${dbInfo?.catalog_name}`);
  }
  console.log("");

  // Test 1: Try a simple insert (will fail if table doesn't exist or missing columns)
  console.log("1️⃣ Testing minimal call_logs insert...");
  const { data: testLog, error: testError } = await supabase
    .from("call_logs")
    .insert({
      direction: "outbound",
      participant_type: "test",
    })
    .select("id")
    .single();

  if (testError) {
    if (testError.message?.includes("Could not find")) {
      console.error("❌ Table or column missing:", testError.message);
      console.log("\n📝 You need to run the SQL migration:");
      console.log("   1. Go to https://blpidunyxhyazyhvunta.supabase.co/project/default/editor");
      console.log("   2. Open: sql/005_add_missing_columns.sql");
      console.log("   3. Run the SQL");
    } else if (testError.code === "42P01") {
      console.error("❌ Table 'call_logs' does not exist");
      console.log("\n📝 Run the full migration:");
      console.log("   sql/004_create_all_tables.sql");
    } else {
      console.error("❌ Unexpected error:", testError);
    }
    return;
  }

  // Clean up test record
  if (testLog) {
    await supabase.from("call_logs").delete().eq("id", testLog.id);
    console.log("✅ call_logs table exists and is writable\n");
  }

  // Test 2: Full insert with all fields
  console.log("2️⃣ Testing full call_logs insert...");
  const insertData: any = {
    direction: "outbound",
    participant_type: "test",
    participant_phone: "+15555555555",
    twilio_call_sid: "test_" + Date.now(),
    status: "active",
    transcript: "Test transcript",
  };

  const { data: callLog, error: callLogError } = await supabase
    .from("call_logs")
    .insert(insertData)
    .select("id")
    .single();

  if (callLogError) {
    console.error("❌ Failed to insert call_log:", callLogError);
    console.log("\n⚠️  Your table may be missing some columns.");
    console.log("   Run: sql/005_add_missing_columns.sql");
    return;
  }
  console.log(`✅ Inserted call_log: ${callLog.id}\n`);

  // Test 3: Check if twilio_call_logs table exists
  console.log("3️⃣ Testing twilio_call_logs table...");
  const { data: twilioTest, error: twilioTestError } = await supabase
    .from("twilio_call_logs")
    .insert({
      twilio_call_sid: "test_twilio_" + Date.now(),
      call_log_id: callLog.id,
    })
    .select("id")
    .single();

  if (twilioTestError) {
    if (twilioTestError.code === "42P01") {
      console.log("⚠️  twilio_call_logs table does not exist yet");
      console.log("   Run: sql/003_twilio_call_logs.sql or sql/004_create_all_tables.sql");
    } else {
      console.error("❌ twilio_call_logs error:", twilioTestError.message);
    }
    // Continue anyway, clean up call_log
    await supabase.from("call_logs").delete().eq("id", callLog.id);
    console.log("");
    return;
  }

  const twilioLog = twilioTest;
  console.log(`✅ twilio_call_logs exists: ${twilioLog.id}\n`);

  // Test 4: Check gemini_activity
  console.log("4️⃣ Testing gemini_activity table...");
  const { data: activity, error: activityError } = await supabase
    .from("gemini_activity")
    .insert({
      model: "test-model",
      label: "Test activity",
      status: "active",
      result: "Test result",
    })
    .select("id")
    .single();

  if (activityError) {
    if (activityError.code === "42P01") {
      console.log("⚠️  gemini_activity table does not exist yet");
      console.log("   Run: sql/004_create_all_tables.sql");
    } else {
      console.error("❌ gemini_activity error:", activityError.message);
    }
    // Clean up
    if (twilioLog) {
      await supabase.from("twilio_call_logs").delete().eq("id", twilioLog.id);
    }
    await supabase.from("call_logs").delete().eq("id", callLog.id);
    console.log("");
    return;
  }

  console.log(`✅ gemini_activity exists: ${activity.id}\n`);

  // Clean up test data
  console.log("5️⃣ Cleaning up test data...");
  await supabase.from("gemini_activity").delete().eq("id", activity.id);
  if (twilioLog) {
    await supabase.from("twilio_call_logs").delete().eq("id", twilioLog.id);
  }
  await supabase.from("call_logs").delete().eq("id", callLog.id);
  console.log("✅ Cleaned up test data\n");

  console.log("🎉 All core tables exist and are working!");
}

testConnection().catch(console.error);
