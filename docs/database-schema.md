# Database Schema

> Supabase (Postgres + pgvector) — Unified data layer

## Extensions

```sql
create extension if not exists vector;
create extension if not exists "uuid-ossp";
```

---

## Tables

### Properties

```sql
create table properties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                    -- "Lemon Property"
  address text not null,
  unit_count int default 1,
  owner_id uuid,
  guest_access_code text,                -- "1234"
  vendor_access_code text,               -- "4729"
  created_at timestamptz default now()
);
```

### Units

```sql
create table units (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id),
  unit_number text not null,             -- "3B"
  bedrooms int,
  status text default 'occupied',        -- occupied, vacant, maintenance
  current_guest_name text,
  current_guest_phone text
);
```

### Maintenance History (5 years of generated data)

```sql
create table maintenance_logs (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id),
  unit_id uuid references units(id),
  category text not null,                -- plumbing, electrical, hvac, appliance, structural
  subcategory text,                      -- pipe_leak, faucet, toilet, water_heater
  description text not null,
  resolution text,
  vendor_name text,
  vendor_phone text,
  cost decimal(10,2),
  reported_at timestamptz not null,
  resolved_at timestamptz,
  severity text default 'medium',        -- low, medium, high, emergency
  photos text[],                         -- array of storage URLs
  notes text,
  embedding vector(3072)                 -- Gemini Embedding 2
);
```

### Vendors

```sql
create table vendors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text not null,
  specialty text[],                      -- ['plumbing', 'hvac']
  hourly_rate decimal(10,2),
  rating decimal(3,2),                   -- 4.85
  total_jobs int default 0,
  avg_response_time_hours decimal(5,1),
  notes text,
  is_preferred boolean default false
);
```

### Incidents (active issues)

```sql
create table incidents (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id),
  unit_id uuid references units(id),
  status text default 'new',             -- new, triaging, quoting, approved, scheduled, in_progress, resolved
  category text,
  description text,
  guest_phone text,
  urgency text default 'medium',
  related_maintenance_ids uuid[],        -- links to past similar issues
  quotes jsonb default '[]',             -- [{vendor_id, amount, eta_days, call_transcript}]
  selected_vendor_id uuid,
  approved_by text,
  approved_at timestamptz,
  scheduled_at timestamptz,
  resolved_at timestamptz,
  timeline jsonb default '[]',           -- [{timestamp, event, details}]
  created_at timestamptz default now()
);
```

### Call Logs

```sql
create table call_logs (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid references incidents(id),
  direction text not null,               -- inbound, outbound
  participant_type text not null,        -- guest, vendor, landlord
  participant_name text,
  participant_phone text,
  twilio_call_sid text,
  duration_seconds int,
  transcript text,
  summary text,
  sentiment text,                        -- positive, neutral, negative, angry
  created_at timestamptz default now()
);
```

---

## Functions

### Similarity Search

```sql
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
```
