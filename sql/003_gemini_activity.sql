-- Gemini Activity Feed — tracks all AI model actions for dashboard real-time display
CREATE TABLE IF NOT EXISTS gemini_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID REFERENCES incidents(id),
  call_sid TEXT,
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash-native-audio',
  status TEXT NOT NULL DEFAULT 'active',  -- active, done, error
  label TEXT NOT NULL,                     -- e.g. "Calling guest", "Searching maintenance history"
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gemini_activity_incident ON gemini_activity(incident_id);
CREATE INDEX idx_gemini_activity_created ON gemini_activity(created_at);

-- Enable Realtime on all needed tables
ALTER PUBLICATION supabase_realtime ADD TABLE gemini_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;
