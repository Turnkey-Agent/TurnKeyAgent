-- ============================================
-- Twilio Call Logs — Separate table for raw Twilio data
-- Tracks actual call metadata, pricing, and recordings from Twilio API
-- ============================================

-- Twilio Call Logs (raw data from Twilio API)
create table if not exists twilio_call_logs (
  id uuid primary key default uuid_generate_v4(),

  -- Link to our internal call log
  call_log_id uuid references call_logs(id) on delete cascade,

  -- Twilio identifiers
  twilio_call_sid text not null unique,
  twilio_account_sid text,

  -- Call metadata
  from_number text,
  to_number text,
  status text, -- queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
  direction text, -- inbound, outbound-api, outbound-dial

  -- Timing
  start_time timestamptz,
  end_time timestamptz,
  duration_seconds int,

  -- Pricing
  price decimal(10,4),
  price_unit text default 'USD',
  uri text, -- API endpoint for this call

  -- Recording info
  recording_sid text,
  recording_url text,
  recording_duration_seconds int,

  -- Raw response storage (for debugging/auditing)
  raw_twilio_response jsonb,

  -- Timestamps
  fetched_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Indexes
comment on table twilio_call_logs is 'Raw Twilio call data fetched from Twilio API after calls complete';
create index if not exists idx_twilio_call_logs_call_sid on twilio_call_logs(twilio_call_sid);
create index if not exists idx_twilio_call_logs_call_log_id on twilio_call_logs(call_log_id);
create index if not exists idx_twilio_call_logs_status on twilio_call_logs(status);
