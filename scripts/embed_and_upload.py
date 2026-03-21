"""
Embed maintenance records via Gemini Embedding 2 and upload to Supabase.
Usage: python scripts/embed_and_upload.py [FILE]
"""

import json
import os
import sys
import time
from pathlib import Path

from google import genai
from supabase import create_client

# Load .env
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not all([GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    print("ERROR: Missing GEMINI_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

client = genai.Client(api_key=GEMINI_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

PROPERTY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
UNIT_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901"
MODEL = "gemini-embedding-2-preview"

input_file = sys.argv[1] if len(sys.argv) > 1 else "scripts/seed_maintenance.json"
with open(input_file, "r") as f:
    records = json.load(f)

print(f"Embedding {len(records)} records with {MODEL} (3072d)")
print()

failed = []
for i, record in enumerate(records):
    embed_text = f"""Category: {record['category']} - {record.get('subcategory', 'general')}
Date: {record['reported_at']}
Severity: {record.get('severity', 'medium')}
Issue: {record['description']}
Resolution: {record.get('resolution', 'Pending')}
Vendor: {record.get('vendor_name', 'Unassigned')}
Cost: ${record.get('cost', 0)}
Notes: {record.get('notes', '')}"""

    try:
        result = client.models.embed_content(
            model=MODEL,
            contents=embed_text,
            config={"task_type": "RETRIEVAL_DOCUMENT"}
        )
        embedding = result.embeddings[0].values

        data = {
            "property_id": PROPERTY_ID,
            "unit_id": UNIT_ID,
            "category": record["category"],
            "subcategory": record.get("subcategory"),
            "description": record["description"],
            "resolution": record.get("resolution"),
            "vendor_name": record.get("vendor_name"),
            "vendor_phone": record.get("vendor_phone"),
            "cost": record.get("cost"),
            "reported_at": record["reported_at"],
            "resolved_at": record.get("resolved_at"),
            "severity": record.get("severity", "medium"),
            "photos": record.get("photos", []),
            "notes": record.get("notes", ""),
            "embedding": embedding
        }

        supabase.table("maintenance_logs").insert(data).execute()
        print(f"  [{i+1}/{len(records)}] {record['category']}: {record.get('subcategory', '')} — done")

    except Exception as e:
        print(f"  [{i+1}/{len(records)}] FAILED: {e}")
        failed.append((i, str(e)))
        time.sleep(2)

    if (i + 1) % 10 == 0:
        time.sleep(0.5)

print()
print(f"Done! {len(records) - len(failed)}/{len(records)} embedded and uploaded.")
if failed:
    print(f"Failed: {[f[0] for f in failed]}")
