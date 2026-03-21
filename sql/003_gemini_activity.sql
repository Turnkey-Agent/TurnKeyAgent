-- ============================================
-- Turnkey Agent — Gemini Activity Table
-- Tracks Gemini model invocations per incident
-- ============================================

CREATE TABLE IF NOT EXISTS gemini_activity (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id uuid REFERENCES incidents(id),
  model text NOT NULL,
  status text DEFAULT 'idle',
  label text NOT NULL,
  result text,
  timestamp timestamptz DEFAULT now()
);

-- Index for incident lookup
CREATE INDEX IF NOT EXISTS idx_gemini_activity_incident
  ON gemini_activity(incident_id);

-- Index for recent activity queries
CREATE INDEX IF NOT EXISTS idx_gemini_activity_timestamp
  ON gemini_activity(timestamp DESC);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE gemini_activity;
