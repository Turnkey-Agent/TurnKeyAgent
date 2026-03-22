-- ============================================
-- COMPLETE DATABASE SETUP - Run this if you have no tables
-- Creates ALL tables needed for Turnkey Agent
-- ============================================

-- Enable extensions
create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- Properties
create table if not exists properties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text not null,
  unit_count int default 1,
  owner_id uuid,
  guest_access_code text,
  vendor_access_code text,
  created_at timestamptz default now()
);

-- Units
create table if not exists units (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id),
  unit_number text not null,
  bedrooms int,
  status text default 'occupied',
  current_guest_name text,
  current_guest_phone text
);

-- Vendors
create table if not exists vendors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text not null,
  email text,
  website text,
  address text,
  license_number text,
  working_hours text,
  payment_methods text[],
  specialty text[],
  hourly_rate decimal(10,2),
  rating decimal(3,2),
  total_jobs int default 0,
  avg_response_time_hours decimal(5,1),
  notes text,
  is_preferred boolean default false
);

-- Maintenance Logs (5 years of history)
create table if not exists maintenance_logs (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id),
  unit_id uuid references units(id),
  vendor_id uuid references vendors(id),
  category text not null,
  subcategory text,
  description text not null,
  resolution text,
  vendor_name text,
  vendor_phone text,
  photo_url text,
  cost decimal(10,2),
  reported_at timestamptz not null,
  resolved_at timestamptz,
  severity text default 'medium',
  photos text[],
  notes text,
  embedding vector(3072)
);

-- Incidents (active issues)
create table if not exists incidents (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id),
  unit_id uuid references units(id),
  status text default 'new',
  category text,
  description text,
  guest_phone text,
  urgency text default 'medium',
  related_maintenance_ids uuid[],
  quotes jsonb default '[]',
  selected_vendor_id uuid,
  approved_by text,
  approved_at timestamptz,
  scheduled_at timestamptz,
  resolved_at timestamptz,
  timeline jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Call Logs (AI call tracking)
create table if not exists call_logs (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid references incidents(id),
  direction text not null,
  participant_type text not null,
  participant_name text,
  participant_phone text,
  twilio_call_sid text,
  duration_seconds int,
  transcript text,
  summary text,
  sentiment text,
  status text default 'active',
  created_at timestamptz default now(),
  started_at timestamptz,
  ended_at timestamptz
);

-- Twilio Call Logs (raw Twilio API data)
create table if not exists twilio_call_logs (
  id uuid primary key default uuid_generate_v4(),
  call_log_id uuid references call_logs(id) on delete cascade,
  twilio_call_sid text not null unique,
  twilio_account_sid text,
  from_number text,
  to_number text,
  status text,
  direction text,
  start_time timestamptz,
  end_time timestamptz,
  duration_seconds int,
  price decimal(10,4),
  price_unit text default 'USD',
  uri text,
  recording_sid text,
  recording_url text,
  recording_duration_seconds int,
  raw_twilio_response jsonb,
  fetched_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Gemini Activity (AI actions log)
create table if not exists gemini_activity (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid references incidents(id),
  model text not null,
  label text not null,
  status text default 'active',
  result text,
  created_at timestamptz default now()
);

-- Invoices
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  maintenance_log_id uuid references maintenance_logs(id),
  incident_id uuid references incidents(id),
  vendor_id uuid references vendors(id),
  invoice_number text not null,
  amount decimal(10,2) not null,
  tax decimal(10,2) default 0,
  total decimal(10,2) not null,
  status text default 'paid',
  payment_method text default 'bank_transfer',
  issued_at timestamptz not null,
  paid_at timestamptz,
  line_items jsonb default '[]',
  notes text,
  photo_url text,
  created_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================

create index if not exists idx_properties_owner on properties(owner_id);
create index if not exists idx_units_property on units(property_id);
create index if not exists idx_maintenance_logs_property on maintenance_logs(property_id);
create index if not exists idx_maintenance_logs_category on maintenance_logs(category);
create index if not exists idx_maintenance_logs_vendor on maintenance_logs(vendor_id);
create index if not exists idx_vendors_specialty on vendors using gin(specialty);
create index if not exists idx_incidents_status on incidents(status);
create index if not exists idx_incidents_property on incidents(property_id);
create index if not exists idx_call_logs_incident on call_logs(incident_id);
create index if not exists idx_call_logs_status on call_logs(status);
create index if not exists idx_twilio_call_logs_call_sid on twilio_call_logs(twilio_call_sid);
create index if not exists idx_twilio_call_logs_call_log_id on twilio_call_logs(call_log_id);
create index if not exists idx_gemini_activity_incident on gemini_activity(incident_id);
create index if not exists idx_invoices_maintenance on invoices(maintenance_log_id);
create index if not exists idx_invoices_incident on invoices(incident_id);
create index if not exists idx_invoices_vendor on invoices(vendor_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Vector similarity search for maintenance logs
create or replace function match_maintenance_logs(
  query_embedding vector(3072),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_property_id uuid default null
)
returns table (
  id uuid,
  description text,
  resolution text,
  vendor_name text,
  cost decimal,
  reported_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    ml.id,
    ml.description,
    ml.resolution,
    ml.vendor_name,
    ml.cost,
    ml.reported_at,
    1 - (ml.embedding <=> query_embedding) as similarity
  from maintenance_logs ml
  where
    1 - (ml.embedding <=> query_embedding) > match_threshold
    and (filter_property_id is null or ml.property_id = filter_property_id)
  order by ml.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show all created tables
select 
  table_name,
  (select count(*) from information_schema.columns c where c.table_name = t.table_name) as column_count
from information_schema.tables t
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;
