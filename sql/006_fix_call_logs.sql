-- ============================================
-- FIX: Recreate call_logs with all columns
-- This forces PostgREST to refresh its schema cache
-- ============================================

-- Step 1: Save existing data (if any)
CREATE TABLE IF NOT EXISTS call_logs_backup AS SELECT * FROM call_logs;

-- Step 2: Drop the old table
DROP TABLE IF EXISTS call_logs CASCADE;

-- Step 3: Recreate with ALL columns
CREATE TABLE call_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL,
  direction text NOT NULL,
  participant_type text NOT NULL,
  participant_name text,
  participant_phone text,
  twilio_call_sid text,
  duration_seconds int,
  transcript text,
  summary text,
  sentiment text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz
);

-- Step 4: Restore data (if any was backed up)
INSERT INTO call_logs (
  id, incident_id, direction, participant_type, participant_name, 
  participant_phone, twilio_call_sid, duration_seconds, transcript, 
  summary, sentiment, status, created_at
)
SELECT 
  id, incident_id, direction, participant_type, participant_name,
  participant_phone, twilio_call_sid, duration_seconds, transcript,
  summary, sentiment, COALESCE(status, 'active'), created_at
FROM call_logs_backup
ON CONFLICT (id) DO NOTHING;

-- Step 5: Drop backup
DROP TABLE IF EXISTS call_logs_backup;

-- Step 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_call_logs_incident ON call_logs(incident_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_twilio_sid ON call_logs(twilio_call_sid);

-- Step 7: Verify
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'call_logs' AND table_schema = 'public'
ORDER BY ordinal_position;
