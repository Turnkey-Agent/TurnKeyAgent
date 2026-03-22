# Database Setup Instructions

## If you have NO tables in Supabase

1. Go to https://blpidunyxhyazyhvunta.supabase.co/project/default/editor
2. Click **New Query**
3. Open `sql/004_create_all_tables.sql` and copy ALL the SQL
4. Paste into Supabase SQL Editor
5. Click **Run**

This creates all 9 tables at once.

## If you already have some tables

Run the individual migration files in order:
1. `001_migration.sql` - Core tables (properties, units, vendors, maintenance_logs, incidents, call_logs, invoices)
2. `003_twilio_call_logs.sql` - Twilio-specific call data
3. `004_create_all_tables.sql` - Skip this if you ran the others

## Tables Created

| Table | Purpose |
|-------|---------|
| `properties` | Rental properties |
| `units` | Individual units in each property |
| `vendors` | Service providers (plumbers, electricians, etc.) |
| `maintenance_logs` | 5-year history of all repairs |
| `incidents` | Active emergency issues |
| `call_logs` | AI voice call transcripts |
| `twilio_call_logs` | Raw Twilio API data (pricing, recordings) |
| `gemini_activity` | AI actions and tool calls |
| `invoices` | Billing records |

## Verify Tables Exist

Run this in Supabase SQL Editor:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;
```
