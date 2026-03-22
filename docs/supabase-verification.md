# Supabase Schema Verification Report

## Tables and Column Mappings

### 1. `call_logs` table

**SQL Schema:**
```sql
create table call_logs (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid references incidents(id),          -- nullable FK
  direction text not null,                            -- required
  participant_type text not null,                     -- required
  participant_name text,                                -- nullable
  participant_phone text,                             -- nullable
  twilio_call_sid text,                               -- nullable
  duration_seconds int,                               -- nullable
  transcript text,                                    -- nullable
  summary text,                                       -- nullable
  sentiment text,                                     -- nullable
  status text default 'active',                         -- has default
  created_at timestamptz default now(),                 -- auto-generated
  started_at timestamptz,                             -- nullable
  ended_at timestamptz                                -- nullable
);
```

**Code Usage:**
- ✅ `tools.ts:logCallEvent()` - Inserts with all required fields
- ✅ `twilio-handler.ts` - Inserts on call start, updates on end

---

### 2. `twilio_call_logs` table

**SQL Schema:**
```sql
create table twilio_call_logs (
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
```

**Code Usage:**
- ✅ `workflow.ts:saveTwilioCallDetails()` - Inserts all fields from Twilio API

---

### 3. `gemini_activity` table

**SQL Schema:**
```sql
create table gemini_activity (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid references incidents(id),
  model text not null,
  label text not null,
  status text default 'active',
  result text,
  created_at timestamptz default now()    -- ✅ CORRECT column name
);
```

**Code Usage:**
- ✅ `tools.ts:logActivity()` - Correctly uses no timestamp (auto-generated)
- ✅ `realtime-hooks.ts:logGeminiActivity()` - **FIXED** - Removed `timestamp` column

**Issue Found & Fixed:**
- ❌ `timestamp: new Date().toISOString()` → ✅ removed (uses `created_at` default)

---

### 4. `incidents` table

**SQL Schema:**
```sql
create table incidents (
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
```

**Code Usage:**
- ✅ `workflow.ts:startWorkflow()` - Creates with required fields
- ✅ `workflow.ts:onGuestCallEnd()` - Updates status and timeline
- ✅ `workflow.ts:onVendorCallEnd()` - Updates status and timeline
- ✅ `workflow.ts:approveVendor()` - Updates status and timeline
- ✅ `workflow.ts:onScheduleCallEnd()` - Updates status and timeline

---

### 5. Other Tables (for reference)

| Table | Status |
|-------|--------|
| `properties` | ✅ Used in workflow |
| `units` | ✅ Referenced |
| `vendors` | ✅ Used for quotes |
| `maintenance_logs` | ✅ Used for vector search |
| `invoices` | ✅ Used in realtime-hooks |

---

## Issues Found and Fixed

### Issue #1: `gemini_activity.timestamp` (FIXED)
**Location:** `bridge/src/realtime-hooks.ts:35`
**Problem:** Code tried to insert `timestamp` column
**Solution:** Removed the line - `created_at` is auto-generated

### Issue #2: `logCallEvent` missing explicit fields (FIXED)
**Location:** `bridge/src/tools.ts:39-46`
**Problem:** Didn't explicitly set `status` and `transcript`
**Solution:** Added explicit values

---

## Testing Checklist

After running `004_create_all_tables.sql` in Supabase, verify:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('call_logs', 'twilio_call_logs', 'gemini_activity', 'incidents', 'properties', 'units', 'vendors', 'maintenance_logs', 'invoices')
ORDER BY table_name;

-- Should return 9 rows
```

Then test by:
1. Start the bridge server
2. Make a test call
3. Check logs show: `[WS] Created call_log with ID: xxx`
4. Verify data in Supabase Table Editor
