-- ============================================
-- Turnkey Agent — Invoices & Enrichment Migration
-- Creates invoices table and enriches existing tables
-- ============================================

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  maintenance_log_id uuid REFERENCES maintenance_logs(id),
  incident_id uuid REFERENCES incidents(id),
  vendor_id uuid REFERENCES vendors(id),
  invoice_number text NOT NULL,
  amount decimal(10,2) NOT NULL,
  tax decimal(10,2) DEFAULT 0,
  total decimal(10,2) NOT NULL,
  status text DEFAULT 'paid',
  payment_method text DEFAULT 'bank_transfer',
  issued_at timestamptz NOT NULL,
  paid_at timestamptz,
  line_items jsonb DEFAULT '[]',
  notes text,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_maintenance ON invoices(maintenance_log_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_id);

-- Add vendor_id to maintenance_logs
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(id);

-- Add photo_url to maintenance_logs
ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS photo_url text;

-- Enrich vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS license_number text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS working_hours text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS payment_methods text[];
