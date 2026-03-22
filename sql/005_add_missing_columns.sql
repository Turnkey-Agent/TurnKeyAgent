-- ============================================
-- Add missing columns to existing tables
-- Run this if you already created tables but need to add new columns
-- ============================================

-- ============================================
-- Fix call_logs table - add ALL missing columns
-- ============================================
ALTER TABLE call_logs 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS sentiment text,
  ADD COLUMN IF NOT EXISTS duration_seconds int,
  ADD COLUMN IF NOT EXISTS twilio_call_sid text,
  ADD COLUMN IF NOT EXISTS participant_phone text,
  ADD COLUMN IF NOT EXISTS participant_name text;

-- ============================================
-- Create twilio_call_logs table if missing
-- ============================================
CREATE TABLE IF NOT EXISTS twilio_call_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_log_id uuid REFERENCES call_logs(id) ON DELETE CASCADE,
  twilio_call_sid text NOT NULL UNIQUE,
  twilio_account_sid text,
  from_number text,
  to_number text,
  status text,
  direction text,
  start_time timestamptz,
  end_time timestamptz,
  duration_seconds int,
  price decimal(10,4),
  price_unit text DEFAULT 'USD',
  uri text,
  recording_sid text,
  recording_url text,
  recording_duration_seconds int,
  raw_twilio_response jsonb,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_sid ON twilio_call_logs(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_log_id ON twilio_call_logs(call_log_id);

-- ============================================
-- Create gemini_activity table if missing
-- ============================================
CREATE TABLE IF NOT EXISTS gemini_activity (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id uuid REFERENCES incidents(id),
  model text NOT NULL,
  label text NOT NULL,
  status text DEFAULT 'active',
  result text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gemini_activity_incident ON gemini_activity(incident_id);

-- ============================================
-- Add missing columns to incidents
-- ============================================
ALTER TABLE incidents 
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS quotes jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS timeline jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS selected_vendor_id uuid,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- ============================================
-- Verify call_logs columns
-- ============================================
SELECT 
  'call_logs columns:' as info,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'call_logs'
ORDER BY ordinal_position;
