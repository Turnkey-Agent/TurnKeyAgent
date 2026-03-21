"""
Turnkey Agent — Database Enrichment Script
1. Import real SF plumbers from Kaggle CSV into vendors table
2. Link photos to all 413 maintenance records
3. Generate invoices for all maintenance records with cost > 0
4. Link vendor_id on maintenance_logs
"""

import os
import csv
import json
import random
from pathlib import Path
from datetime import datetime, timedelta
from decimal import Decimal

# Load env
env_path = Path('C:/Users/ayush/Desktop/Hackathons/TurnKeyAgent/.env')
for line in env_path.read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        key, _, val = line.partition('=')
        os.environ.setdefault(key.strip(), val.strip())

from supabase import create_client

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

# ============================================
# STEP 2: Import real SF plumbers
# ============================================
print("=" * 60)
print("STEP 2: Importing real SF plumbers from Kaggle CSV...")
print("=" * 60)

csv_path = Path('C:/Users/ayush/Desktop/Hackathons/TurnKeyAgent/datasets/sf-plumbers/plumbers_san_francisco_free_example.csv')

# Category mapping from CSV categories to our specialty format
def map_categories(categories_str):
    cats = [c.strip().lower() for c in categories_str.split(',')]
    specialties = set()
    for c in cats:
        if 'plumb' in c:
            specialties.add('plumbing')
        if 'sewer' in c or 'drain' in c:
            specialties.add('sewer')
        if 'water heater' in c:
            specialties.add('water heaters')
        if 'water damage' in c:
            specialties.add('water damage')
        if 'grease trap' in c:
            specialties.add('grease traps')
        if 'electric' in c:
            specialties.add('electrical')
        if 'air condition' in c or 'hvac' in c or 'mechanical' in c:
            specialties.add('HVAC')
        if 'general contractor' in c or 'building contractor' in c:
            specialties.add('general contracting')
        if 'handyman' in c or 'home repair' in c:
            specialties.add('handyman')
        if 'home improvement' in c or 'remodel' in c:
            specialties.add('home improvement')
        if 'appliance' in c:
            specialties.add('appliances')
        if 'fire' in c:
            specialties.add('fire restoration')
    if not specialties:
        specialties.add('plumbing')
    return list(specialties)

def parse_payment_methods(pm_str):
    if not pm_str or not pm_str.strip():
        return None
    methods = [m.strip() for m in pm_str.split(',') if m.strip()]
    return methods if methods else None

def clean_working_hours(wh_str):
    if not wh_str or not wh_str.strip():
        return None
    # Deduplicate repeated working hours
    parts = [p.strip() for p in wh_str.split(',')]
    seen = set()
    unique = []
    for p in parts:
        if p not in seen:
            seen.add(p)
            unique.append(p)
    return ', '.join(unique[:3])  # Keep at most 3 unique entries

vendors_inserted = 0
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        name = row['name'].strip()
        phones_raw = row.get('phones', '').strip()
        phone = phones_raw.split(',')[0].strip() if phones_raw else '(415) 000-0000'
        street = row.get('street', '').strip()
        city = row.get('city', '').strip()
        state = row.get('state', '').strip()
        zipcode = row.get('zipcode', '').strip()
        address = f"{street}, {city}, {state} {zipcode}".strip(', ')
        if not address or address == ', ,':
            address = f"{city}, {state} {zipcode}".strip(', ')

        categories = row.get('categories', 'Plumbers').strip()
        email = row.get('email', '').strip() or None
        website = row.get('website', '').strip() or None
        working_hours = clean_working_hours(row.get('working_hours', ''))
        payment_methods = parse_payment_methods(row.get('payment_methods', ''))

        specialties = map_categories(categories)

        # Generate realistic rates based on specialty
        base_rate = random.uniform(75, 140)
        rating = round(random.uniform(3.8, 5.0), 2)
        total_jobs = random.randint(2, 25)
        avg_response = round(random.uniform(2.0, 24.0), 1)

        # Generate a fake CA license number
        license_number = f"C-{random.randint(10, 99)}-{random.randint(100000, 999999)}"

        vendor_data = {
            'name': name,
            'phone': phone,
            'specialty': specialties,
            'hourly_rate': round(base_rate, 2),
            'rating': rating,
            'total_jobs': total_jobs,
            'avg_response_time_hours': avg_response,
            'notes': f"Real SF vendor. Categories: {categories}",
            'is_preferred': False,
            'email': email,
            'website': website,
            'address': address,
            'license_number': license_number,
            'working_hours': working_hours,
            'payment_methods': payment_methods,
        }

        try:
            result = supabase.table('vendors').insert(vendor_data).execute()
            vendors_inserted += 1
            print(f"  Inserted vendor: {name}")
        except Exception as e:
            print(f"  WARN: Failed to insert {name}: {e}")

print(f"\nInserted {vendors_inserted} real SF plumber vendors.")

# ============================================
# Get all vendors for later use
# ============================================
print("\nFetching all vendors...")
all_vendors = supabase.table('vendors').select('id, name').execute().data
vendor_name_to_id = {v['name']: v['id'] for v in all_vendors}
print(f"Total vendors in database: {len(all_vendors)}")

# ============================================
# STEP 3: Link photos to maintenance records
# ============================================
print("\n" + "=" * 60)
print("STEP 3: Linking photos to maintenance records...")
print("=" * 60)

# Categorize photos
photos_dir = Path('C:/Users/ayush/Desktop/Hackathons/TurnKeyAgent/public/photos')
all_photos = sorted([f.name for f in photos_dir.iterdir() if f.suffix in ('.jpg', '.png')])

photo_categories = {
    'plumbing': [],
    'electrical': [],
    'hvac': [],
    'appliance': [],
    'structural': [],
    'general': [],
}

for photo in all_photos:
    name_lower = photo.lower()
    if name_lower.startswith('plumbing_') or name_lower in ('pipe_leak.jpg', 'bathroom_sink.jpg', 'kitchen_sink.jpg', 'toilet_repair.jpg', 'plumber_tools.jpg', 'water_damage.jpg', 'water_heater.jpg', 'garbage_disposal.jpg'):
        photo_categories['plumbing'].append(photo)
    elif name_lower.startswith('electrical_') or name_lower in ('light_switch.jpg', 'outlet_repair.jpg', 'smoke_detector.jpg'):
        photo_categories['electrical'].append(photo)
    elif name_lower.startswith('hvac_') or name_lower in ('ac_unit.jpg', 'thermostat.jpg'):
        photo_categories['hvac'].append(photo)
    elif name_lower.startswith('appliance_') or name_lower in ('dishwasher.jpg',):
        photo_categories['appliance'].append(photo)
    elif name_lower.startswith('structural_') or name_lower in ('door_lock.jpg', 'ceiling_stain.jpg', 'drywall_damage.jpg', 'window_condensation.jpg'):
        photo_categories['structural'].append(photo)
    elif name_lower.startswith('general_'):
        photo_categories['general'].append(photo)

for cat, photos in photo_categories.items():
    print(f"  {cat}: {len(photos)} photos")

# Category mapping from maintenance_logs categories to photo categories
category_to_photo = {
    'plumbing': 'plumbing',
    'electrical': 'electrical',
    'hvac': 'hvac',
    'appliance': 'appliance',
    'structural': 'structural',
    'general': 'general',
    'pest_control': 'general',
    'safety': 'general',
    'exterior': 'structural',
    'interior': 'general',
    'landscaping': 'general',
    'cleaning': 'general',
}

# Fetch all maintenance records
print("\nFetching maintenance records...")
all_maintenance = []
offset = 0
while True:
    batch = supabase.table('maintenance_logs').select('id, category').range(offset, offset + 999).execute().data
    if not batch:
        break
    all_maintenance.extend(batch)
    offset += 1000
    if len(batch) < 1000:
        break

print(f"Total maintenance records: {len(all_maintenance)}")

# Update each maintenance record with a photo
photos_linked = 0
batch_updates = []
for record in all_maintenance:
    cat = record.get('category', 'general')
    if cat:
        cat = cat.lower().strip()
    photo_cat = category_to_photo.get(cat, 'general')
    available_photos = photo_categories.get(photo_cat, photo_categories['general'])
    if not available_photos:
        available_photos = photo_categories['general']

    photo = random.choice(available_photos)
    photo_url = f'/photos/{photo}'
    batch_updates.append({'id': record['id'], 'photo_url': photo_url})

# Update in batches
print("Updating maintenance records with photo URLs...")
for i in range(0, len(batch_updates), 50):
    batch = batch_updates[i:i+50]
    for item in batch:
        try:
            supabase.table('maintenance_logs').update({'photo_url': item['photo_url']}).eq('id', item['id']).execute()
            photos_linked += 1
        except Exception as e:
            print(f"  WARN: Failed to update {item['id']}: {e}")
    if (i + 50) % 200 == 0 or i + 50 >= len(batch_updates):
        print(f"  Updated {min(i + 50, len(batch_updates))}/{len(batch_updates)} records...")

print(f"\nLinked photos to {photos_linked} maintenance records.")

# ============================================
# STEP 4: Link vendor_id on maintenance_logs
# ============================================
print("\n" + "=" * 60)
print("STEP 4: Linking vendor_id on maintenance_logs...")
print("=" * 60)

# Fetch all records with vendor_name
all_maintenance_full = []
offset = 0
while True:
    batch = supabase.table('maintenance_logs').select('id, vendor_name').range(offset, offset + 999).execute().data
    if not batch:
        break
    all_maintenance_full.extend(batch)
    offset += 1000
    if len(batch) < 1000:
        break

vendor_linked = 0
for record in all_maintenance_full:
    vname = record.get('vendor_name')
    if vname and vname in vendor_name_to_id:
        vid = vendor_name_to_id[vname]
        try:
            supabase.table('maintenance_logs').update({'vendor_id': vid}).eq('id', record['id']).execute()
            vendor_linked += 1
        except Exception as e:
            print(f"  WARN: Failed to link vendor for {record['id']}: {e}")

    if vendor_linked % 100 == 0 and vendor_linked > 0:
        print(f"  Linked {vendor_linked} records...")

print(f"\nLinked vendor_id on {vendor_linked} maintenance records.")

# ============================================
# STEP 5: Load construction costs for line items
# ============================================
print("\n" + "=" * 60)
print("STEP 5: Loading construction cost data for realistic line items...")
print("=" * 60)

costs_path = Path('C:/Users/ayush/Desktop/Hackathons/TurnKeyAgent/datasets/construction-costs/pricing-items.csv')
cost_items = {}
with open(costs_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        trade = row.get('trade', '').strip()
        if trade not in cost_items:
            cost_items[trade] = []
        cost_items[trade].append({
            'item': row.get('item', ''),
            'unit': row.get('unit', ''),
            'low': float(row.get('low', 0)),
            'typical': float(row.get('typical', 0)),
            'high': float(row.get('high', 0)),
        })

# Map maintenance categories to cost trades
category_to_trades = {
    'plumbing': ['plumbing'],
    'electrical': ['electrical'],
    'hvac': ['hvac'],
    'appliance': ['kitchen-remodel', 'electrical'],
    'structural': ['drywall', 'doors', 'windows', 'paint'],
    'general': ['labor-general', 'paint'],
    'pest_control': ['labor-general'],
    'safety': ['electrical'],
    'exterior': ['paint', 'siding', 'roofing'],
    'interior': ['paint', 'flooring', 'drywall'],
    'landscaping': ['gravel', 'mulch', 'fence'],
    'cleaning': ['labor-general'],
}

def generate_line_items(category, total_cost):
    """Generate realistic line items that sum to approximately the total cost."""
    cat = category.lower().strip() if category else 'general'
    trades = category_to_trades.get(cat, ['labor-general'])

    # Collect relevant cost items
    relevant_items = []
    for trade in trades:
        relevant_items.extend(cost_items.get(trade, []))

    if not relevant_items:
        relevant_items = cost_items.get('labor-general', [])

    line_items = []
    remaining = float(total_cost)

    # Always add a labor line item
    labor_pct = random.uniform(0.45, 0.70)
    labor_amount = round(remaining * labor_pct, 2)
    hours = max(1, round(labor_amount / random.uniform(75, 130), 1))
    hourly_rate = round(labor_amount / hours, 2)

    line_items.append({
        'description': f"Labor - {cat.replace('_', ' ').title()} repair/service ({hours} hrs)",
        'quantity': hours,
        'unit_price': hourly_rate,
        'total': round(hours * hourly_rate, 2)
    })

    remaining -= labor_amount

    # Add 1-3 parts/materials items from the cost data
    num_parts = random.randint(1, min(3, len(relevant_items)))
    if remaining > 5 and relevant_items:
        sampled = random.sample(relevant_items, min(num_parts, len(relevant_items)))
        part_amounts = []
        for i in range(len(sampled)):
            if i == len(sampled) - 1:
                part_amounts.append(remaining - sum(part_amounts))
            else:
                part_amounts.append(round(remaining * random.uniform(0.2, 0.6), 2))

        for i, item in enumerate(sampled):
            amount = max(5.0, min(part_amounts[i], remaining))
            qty = random.randint(1, 3)
            unit_price = round(amount / qty, 2)
            actual_total = round(qty * unit_price, 2)

            # Shorten item description
            desc = item['item']
            if len(desc) > 60:
                desc = desc[:57] + '...'

            line_items.append({
                'description': f"Parts - {desc}",
                'quantity': qty,
                'unit_price': unit_price,
                'total': actual_total
            })

    return line_items


# ============================================
# STEP 4b: Generate invoices
# ============================================
print("\n" + "=" * 60)
print("STEP 4b: Generating invoices for all maintenance records...")
print("=" * 60)

# Fetch all maintenance records with cost and dates
all_maint_for_invoices = []
offset = 0
while True:
    batch = supabase.table('maintenance_logs').select(
        'id, category, cost, vendor_name, vendor_id, resolved_at, reported_at'
    ).range(offset, offset + 999).execute().data
    if not batch:
        break
    all_maint_for_invoices.extend(batch)
    offset += 1000
    if len(batch) < 1000:
        break

print(f"Total maintenance records: {len(all_maint_for_invoices)}")

payment_methods = ['bank_transfer', 'credit_card', 'check', 'cash']
SF_TAX_RATE = 0.08625

invoices_created = 0
invoice_seq = 0

# Group by year for invoice numbering
for record in sorted(all_maint_for_invoices, key=lambda r: r.get('resolved_at') or r.get('reported_at') or '2020-01-01'):
    cost = record.get('cost')
    if not cost or float(cost) <= 0:
        continue

    amount = float(cost)
    tax = round(amount * SF_TAX_RATE, 2)
    total = round(amount + tax, 2)

    resolved_at = record.get('resolved_at') or record.get('reported_at')
    if not resolved_at:
        continue

    # Parse the date for invoice numbering
    try:
        if 'T' in str(resolved_at):
            dt = datetime.fromisoformat(str(resolved_at).replace('Z', '+00:00'))
        else:
            dt = datetime.fromisoformat(str(resolved_at))
    except Exception:
        dt = datetime(2023, 1, 1)

    invoice_seq += 1
    invoice_number = f"INV-{dt.year}-{invoice_seq:04d}"

    # Payment date: 7-30 days after issued
    paid_delta = timedelta(days=random.randint(7, 30))
    paid_at = dt + paid_delta

    # Generate line items
    category = record.get('category', 'general')
    line_items = generate_line_items(category, amount)

    vendor_id = record.get('vendor_id')
    if not vendor_id and record.get('vendor_name'):
        vendor_id = vendor_name_to_id.get(record['vendor_name'])

    invoice_data = {
        'maintenance_log_id': record['id'],
        'vendor_id': vendor_id,
        'invoice_number': invoice_number,
        'amount': amount,
        'tax': tax,
        'total': total,
        'status': 'paid',
        'payment_method': random.choice(payment_methods),
        'issued_at': resolved_at,
        'paid_at': paid_at.isoformat(),
        'line_items': line_items,
        'notes': f"Service completed for {category} maintenance",
    }

    try:
        supabase.table('invoices').insert(invoice_data).execute()
        invoices_created += 1
    except Exception as e:
        print(f"  WARN: Failed to create invoice for {record['id']}: {e}")

    if invoices_created % 50 == 0 and invoices_created > 0:
        print(f"  Created {invoices_created} invoices...")

print(f"\nCreated {invoices_created} invoices.")

# ============================================
# Final Summary
# ============================================
print("\n" + "=" * 60)
print("FINAL SUMMARY")
print("=" * 60)

# Get final counts
final_vendors = supabase.table('vendors').select('id', count='exact').execute()
final_maintenance = supabase.table('maintenance_logs').select('id', count='exact').execute()
final_invoices = supabase.table('invoices').select('id', count='exact').execute()
final_photos = supabase.table('maintenance_logs').select('id', count='exact').neq('photo_url', 'null').execute()

print(f"Vendors total:        {final_vendors.count}")
print(f"  - New SF plumbers:  {vendors_inserted}")
print(f"Maintenance records:  {final_maintenance.count}")
print(f"  - Photos linked:    {photos_linked}")
print(f"  - Vendor ID linked: {vendor_linked}")
print(f"Invoices created:     {invoices_created}")
print("=" * 60)
print("Done!")
