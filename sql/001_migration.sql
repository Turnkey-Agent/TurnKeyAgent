-- ============================================
-- Turnkey Agent — Database Migration
-- Creates all tables, indexes, and functions
-- ============================================

-- Extensions
create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- ============================================
-- Tables
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

-- Maintenance Logs (5 years of generated data)
create table if not exists maintenance_logs (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id),
  unit_id uuid references units(id),
  category text not null,
  subcategory text,
  description text not null,
  resolution text,
  vendor_name text,
  vendor_phone text,
  cost decimal(10,2),
  reported_at timestamptz not null,
  resolved_at timestamptz,
  severity text default 'medium',
  photos text[],
  notes text,
  embedding vector(3072)
);

-- Vendors
create table if not exists vendors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text not null,
  specialty text[],
  hourly_rate decimal(10,2),
  rating decimal(3,2),
  total_jobs int default 0,
  avg_response_time_hours decimal(5,1),
  notes text,
  is_preferred boolean default false
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

-- Call Logs
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
  created_at timestamptz default now()
);

-- ============================================
-- Indexes
-- ============================================

-- Maintenance logs: property lookup
create index if not exists idx_maintenance_logs_property
  on maintenance_logs(property_id);

-- Maintenance logs: category lookup
create index if not exists idx_maintenance_logs_category
  on maintenance_logs(category);

-- Maintenance logs: vector similarity search (IVFFlat)
-- Using ivfflat with cosine distance for pgvector
-- Note: IVFFlat index requires data to exist first; we create it here
-- but it will be most effective after seed data is loaded.
-- For small datasets (<1000 rows), sequential scan is fine.
-- create index if not exists idx_maintenance_logs_embedding
--   on maintenance_logs using ivfflat (embedding vector_cosine_ops) with (lists = 10);

-- Incidents: status lookup
create index if not exists idx_incidents_status
  on incidents(status);

-- Incidents: property lookup
create index if not exists idx_incidents_property
  on incidents(property_id);

-- Call logs: incident lookup
create index if not exists idx_call_logs_incident
  on call_logs(incident_id);

-- Vendors: specialty lookup (GIN for array)
create index if not exists idx_vendors_specialty
  on vendors using gin(specialty);

-- ============================================
-- Functions
-- ============================================

-- Similarity search for maintenance logs
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
