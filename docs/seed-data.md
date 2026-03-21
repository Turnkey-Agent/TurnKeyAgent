# Seed Data Generation

> 3-Phase approach for generating 5-year maintenance history

## Strategy

Don't try to generate everything in one prompt. Break it into 3 passes:

1. **Phase 1:** Generate the structured maintenance history (JSON) — 60–80 records
2. **Phase 2:** Generate photo descriptions + filenames for Imagen/stock sourcing
3. **Phase 3:** Generate voice note transcripts + vendor personas for demo rehearsal

Run Phase 1 first — it's the foundation everything else references.

---

## Phase 1: Maintenance History

Paste this into Google AI Studio with Gemini 3.1 Pro:

```
You are a database seed generator for a property management software demo. Generate a comprehensive, realistic, and darkly comedic maintenance history for the worst rental property in America.

## THE PROPERTY

**Name:** Lemon Property — "The Bane of 742 Evergreen Terrace"
**Address:** 742 Evergreen Terrace, Unit 3B, San Francisco, CA 94110
**Type:** 2BR/1BA apartment in a 1960s building
**Owner:** Ben Shyong (absentee landlord, lives across town)
**Current Guest:** Karen Mitchell (Airbnb short-term rental, checked in 3 days ago)

## THE VENDORS

Generate exactly these 4 vendors (we need them for the live demo):

1. **Mike's Rapid Plumbing** — Mike Kowalski, (415) 555-0147
   - Reliable, fast, fair pricing. Has done 12+ jobs here. Knows the property's quirks.
   - Rating: 4.9/5. Avg response: 3 hours. Specialty: plumbing, water heaters
   - Running joke: he has a "frequent fixer card" for this property

2. **Bay Area Premier Plumbing** — Derek Lawson, (415) 555-0298
   - Expensive, slow, but technically excellent for complex jobs.
   - Rating: 4.2/5. Avg response: 18 hours. Specialty: plumbing, sewer
   - Always tries to upsell bigger jobs

3. **Sparky's Electric** — Rosa Martinez, (415) 555-0364
   - Excellent electrician. Discovered the building's wiring is "creative" at best.
   - Rating: 4.7/5. Avg response: 6 hours. Specialty: electrical, GFCI, panels

4. **CoolBreeze HVAC** — James Chen, (415) 555-0421
   - Solid HVAC tech. Has replaced the same AC capacitor 3 times.
   - Rating: 4.5/5. Avg response: 12 hours. Specialty: HVAC, thermostats

## GENERATION RULES

Generate EXACTLY 70 maintenance records spanning January 2021 to March 2026.

For EACH record, output a JSON object with these fields:
- `id`: sequential integer 1-70
- `category`: one of [plumbing, electrical, hvac, appliance, structural]
- `subcategory`: specific issue type
- `reported_at`: ISO timestamp (distribute realistically — more issues in winter)
- `resolved_at`: ISO timestamp (1 hour to 2 weeks after reported)
- `severity`: one of [low, medium, high, emergency]
- `description`: 2-3 sentences from the GUEST's perspective reporting the issue. Make these vivid, emotional, and progressively more exasperated for repeat issues.
- `resolution`: 2-3 sentences from the VENDOR's perspective describing what they found and fixed. Include technical details.
- `vendor_name`: which vendor handled it
- `vendor_phone`: their phone number
- `cost`: realistic dollar amount
- `photos`: array of 1-3 descriptive filenames like "3b_bathroom_pipe_leak_oct2024.jpg"
- `notes`: internal property manager notes, sometimes darkly funny

## REQUIRED RECURRING PATTERNS (these create the RAG search gold)

### The Toilet That Won't Die (6 incidents)
Unit 3B's toilet has broken SIX times. Each time it's a different part:
- Mar 2021: Flapper valve ($85)
- Oct 2021: Fill valve ($120)
- Apr 2022: Wax ring seal — water on floor ($250)
- Jan 2023: Flush handle + chain ($95)
- Aug 2023: Flapper valve AGAIN ($85) — vendor notes "I was literally just here for this"
- Nov 2024: Entire toilet replaced ($450) — "at this point it's cheaper to start fresh"

### Winter Pipe Nightmare (every winter)
Something freezes or bursts every December–February:
- Feb 2021: Kitchen pipe froze, minor crack ($180)
- Jan 2022: Bathroom sink PVC joint failed ($280) — Mike fixed it
- Dec 2022: Water heater pressure relief valve blew at 2am ($350)
- Jan 2024: Same bathroom PVC joint failed AGAIN ($280) — Mike: "I told you this whole section needs replacing"
- Oct 2024: Bathroom sink PVC joint — third time ($300) — Mike: "I'm giving you a loyalty discount at this point"
- **THIS IS THE ONE the demo will reference during the live guest call**

### The Haunted Garbage Disposal (4 incidents)
The disposal makes sounds that "cannot be explained by science":
- Jun 2021: Grinding noise. Found a spoon. ($0 — guest retrieved it)
- Mar 2022: Grinding noise. Nothing found. Replaced motor. ($200)
- Sep 2023: Grinding noise. STILL nothing found. "This disposal is haunted." ($0 — reset it)
- Feb 2025: Grinding noise + burning smell. Replaced entire unit. ($350)

### The AC Capacitor (3 incidents, every summer)
- Jul 2022: AC dies during heatwave. Capacitor. ($180)
- Aug 2023: AC dies during heatwave. Same capacitor. ($180)
- Jul 2025: AC dies during heatwave. James: "I'm going to start stockpiling these." ($180)

### Electrical Adventures (5+ incidents)
The building's 1960s wiring provides constant entertainment:
- Multiple GFCI trips in bathroom and kitchen
- One incident where outlet sparks when toaster and microwave run simultaneously
- Rosa's notes progressively more concerned about the panel

### Other Recurring
- Door lock jams at least twice
- Dishwasher breaks twice (once leaking onto downstairs neighbor)
- Window seal fails in bedroom — draft + condensation
- Smoke detector false alarms from cooking (3 times)
- Mysterious ceiling stain that keeps coming back

## DISTRIBUTION

- Plumbing: ~25 records (35%)
- Electrical: ~12 records (17%)
- HVAC: ~8 records (11%)
- Appliance: ~15 records (21%)
- Structural: ~10 records (14%)

## TONE

The descriptions should tell a STORY. Early records (2021) are matter-of-fact. By 2023, guests are writing things like "The toilet is broken AGAIN" and vendors are writing "Replaced the flapper valve. Again. We should just rename this unit 'The Flapper.'" By 2025, vendor notes reference past visits: "Third time on this PVC joint. I have a standing appointment with this pipe apparently."

## OUTPUT FORMAT

Output ONLY a valid JSON array. No markdown formatting, no explanation, no preamble.
Start with [ and end with ]
```

---

## Phase 2: Photo Descriptions

After Phase 1 completes, paste this:

```
Based on the maintenance history you just generated, create a photo manifest for the property.

For each maintenance record that has photos, generate a detailed image description that could be used to:
1. Find a stock photo, OR
2. Generate an image via Google Imagen 3

Output as a JSON array with:
- `filename`: matching the filename from the maintenance record
- `description`: 1-2 sentence visual description of what the photo shows
- `imagen_prompt`: an optimized Imagen 3 prompt to generate this image (realistic style, iPhone photo aesthetic)
- `category`: the maintenance category

Focus on making these look like REAL photos a frustrated tenant or busy plumber would take:
- Slightly off-angle
- Sometimes blurry
- Under harsh bathroom lighting
- Water damage stains
- Close-ups of broken parts
- The classic "pointing at the problem" shot
```

---

## Phase 3: Voice Note Transcripts + Demo Personas

See [demo-script.md](./demo-script.md) for the full call scripts.

---

## Phase 4: Embedding + Upload Script

After you have the JSON from Phase 1, run this locally:

```python
# embed_and_upload.py
import json
import os
from supabase import create_client
import google.generativeai as genai

# Config
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)

# Load seed data
with open("seed_maintenance.json", "r") as f:
    records = json.load(f)

# Property + Unit IDs (create these first in Supabase)
PROPERTY_ID = "your-property-uuid"
UNIT_ID = "your-unit-uuid"

print(f"Embedding {len(records)} maintenance records...")

for i, record in enumerate(records):
    # Create embedding text (combine description + resolution for richer search)
    embed_text = f"""
    Category: {record['category']} - {record['subcategory']}
    Date: {record['reported_at']}
    Issue: {record['description']}
    Resolution: {record['resolution']}
    Vendor: {record['vendor_name']}
    Cost: ${record['cost']}
    Notes: {record['notes']}
    """.strip()

    # Generate embedding via Gemini Embedding 2
    result = genai.embed_content(
        model="models/gemini-embedding-2-preview",
        content=embed_text,
        task_type="RETRIEVAL_DOCUMENT"
    )
    embedding = result['embedding']

    # Insert into Supabase
    data = {
        "property_id": PROPERTY_ID,
        "unit_id": UNIT_ID,
        "category": record["category"],
        "subcategory": record["subcategory"],
        "description": record["description"],
        "resolution": record["resolution"],
        "vendor_name": record["vendor_name"],
        "vendor_phone": record["vendor_phone"],
        "cost": record["cost"],
        "reported_at": record["reported_at"],
        "resolved_at": record["resolved_at"],
        "severity": record["severity"],
        "photos": record.get("photos", []),
        "notes": record.get("notes", ""),
        "embedding": embedding
    }

    result = supabase.table("maintenance_logs").insert(data).execute()
    print(f"  [{i+1}/{len(records)}] {record['category']}: {record['subcategory']} — embedded + uploaded")

print("\nDone! All records embedded and uploaded to Supabase.")
print(f"Vector dimensions: {len(embedding)}")
```

---

## Optimization Tips

### In Google AI Studio
- Use **Gemini 3.1 Pro** (not Flash) for Phase 1 — consistent JSON over 70 records
- Set temperature to **0.8** — creative enough for funny descriptions, structured enough for valid JSON
- Set max output tokens to **8192**
- If it truncates, ask: "Continue generating from record [last_id + 1] in the same JSON format"
- Validate JSON before proceeding — paste into jsonlint.com

### For Embedding Quality
- Combine description + resolution + notes into ONE embed string
- Use `task_type="RETRIEVAL_DOCUMENT"` for storage, `task_type="RETRIEVAL_QUERY"` at query time

### For Demo Impact
- Make sure the Oct 2024 PVC joint repair record has very specific details — this is what the agent finds during the live demo
- The description should mention: "PVC joint", "bathroom sink", "under the sink", "third time"
- The resolution should mention: "Mike recommended full section replacement but owner deferred"

### Time Estimate
| Phase | Time |
|---|---|
| Phase 1 (JSON generation) | ~5 min in AI Studio + 5 min validation |
| Phase 2 (Photo manifest) | ~3 min |
| Phase 3 (Call scripts) | ~5 min |
| Phase 4 (Embedding + upload) | ~10–15 min (API calls) |
| **Total** | **~30 minutes** |
