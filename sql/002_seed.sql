-- ============================================
-- Turnkey Agent — Seed Data
-- Property, Unit, and Vendor records for demo
-- ============================================

-- ============================================
-- Property: Lemon Property
-- ============================================
insert into properties (id, name, address, unit_count, guest_access_code, vendor_access_code)
values (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Lemon Property',
  '742 Evergreen Terrace, San Francisco, CA 94110',
  1,
  '1234',
  '4729'
)
on conflict (id) do update set
  name = excluded.name,
  address = excluded.address,
  unit_count = excluded.unit_count,
  guest_access_code = excluded.guest_access_code,
  vendor_access_code = excluded.vendor_access_code;

-- ============================================
-- Unit: 3B
-- ============================================
insert into units (id, property_id, unit_number, bedrooms, status, current_guest_name, current_guest_phone)
values (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '3B',
  2,
  'occupied',
  'Karen Mitchell',
  '(415) 555-0199'
)
on conflict (id) do update set
  property_id = excluded.property_id,
  unit_number = excluded.unit_number,
  bedrooms = excluded.bedrooms,
  status = excluded.status,
  current_guest_name = excluded.current_guest_name,
  current_guest_phone = excluded.current_guest_phone;

-- ============================================
-- Vendors
-- ============================================

-- Mike's Rapid Plumbing
insert into vendors (id, name, phone, specialty, hourly_rate, rating, total_jobs, avg_response_time_hours, notes, is_preferred)
values (
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'Mike''s Rapid Plumbing',
  '(415) 555-0147',
  ARRAY['plumbing', 'water heaters'],
  95.00,
  4.90,
  14,
  3.0,
  'Reliable, fast, fair pricing. Has done 12+ jobs at Lemon Property. Knows the property''s quirks. Has a "frequent fixer card" for this property.',
  true
)
on conflict (id) do update set
  name = excluded.name,
  phone = excluded.phone,
  specialty = excluded.specialty,
  hourly_rate = excluded.hourly_rate,
  rating = excluded.rating,
  total_jobs = excluded.total_jobs,
  avg_response_time_hours = excluded.avg_response_time_hours,
  notes = excluded.notes,
  is_preferred = excluded.is_preferred;

-- Bay Area Premier Plumbing
insert into vendors (id, name, phone, specialty, hourly_rate, rating, total_jobs, avg_response_time_hours, notes, is_preferred)
values (
  'd4e5f6a7-b8c9-0123-defa-234567890123',
  'Bay Area Premier Plumbing',
  '(415) 555-0298',
  ARRAY['plumbing', 'sewer'],
  175.00,
  4.20,
  4,
  18.0,
  'Expensive, slow, but technically excellent for complex jobs. Always tries to upsell bigger jobs.',
  false
)
on conflict (id) do update set
  name = excluded.name,
  phone = excluded.phone,
  specialty = excluded.specialty,
  hourly_rate = excluded.hourly_rate,
  rating = excluded.rating,
  total_jobs = excluded.total_jobs,
  avg_response_time_hours = excluded.avg_response_time_hours,
  notes = excluded.notes,
  is_preferred = excluded.is_preferred;

-- Sparky's Electric
insert into vendors (id, name, phone, specialty, hourly_rate, rating, total_jobs, avg_response_time_hours, notes, is_preferred)
values (
  'e5f6a7b8-c9d0-1234-efab-345678901234',
  'Sparky''s Electric',
  '(415) 555-0364',
  ARRAY['electrical', 'GFCI', 'panels'],
  110.00,
  4.70,
  7,
  6.0,
  'Excellent electrician. Discovered the building''s wiring is "creative" at best.',
  false
)
on conflict (id) do update set
  name = excluded.name,
  phone = excluded.phone,
  specialty = excluded.specialty,
  hourly_rate = excluded.hourly_rate,
  rating = excluded.rating,
  total_jobs = excluded.total_jobs,
  avg_response_time_hours = excluded.avg_response_time_hours,
  notes = excluded.notes,
  is_preferred = excluded.is_preferred;

-- CoolBreeze HVAC
insert into vendors (id, name, phone, specialty, hourly_rate, rating, total_jobs, avg_response_time_hours, notes, is_preferred)
values (
  'f6a7b8c9-d0e1-2345-fabc-456789012345',
  'CoolBreeze HVAC',
  '(415) 555-0421',
  ARRAY['HVAC', 'thermostats'],
  120.00,
  4.50,
  5,
  12.0,
  'Solid HVAC tech. Has replaced the same AC capacitor 3 times.',
  false
)
on conflict (id) do update set
  name = excluded.name,
  phone = excluded.phone,
  specialty = excluded.specialty,
  hourly_rate = excluded.hourly_rate,
  rating = excluded.rating,
  total_jobs = excluded.total_jobs,
  avg_response_time_hours = excluded.avg_response_time_hours,
  notes = excluded.notes,
  is_preferred = excluded.is_preferred;
