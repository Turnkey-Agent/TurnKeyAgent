"""
Test vector search against Supabase maintenance_logs.
Usage: python scripts/test_vector_search.py
"""

import os
import json
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

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

PROPERTY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
MODEL = "gemini-embedding-2-preview"

test_queries = [
    "bathroom pipe leak under sink",
    "toilet won't stop running",
    "AC not working during summer heatwave",
    "grinding noise from garbage disposal",
    "electrical outlet sparking",
]

for query in test_queries:
    print(f"Query: \"{query}\"")
    print("-" * 60)

    result = client.models.embed_content(
        model=MODEL,
        contents=query,
        config={"task_type": "RETRIEVAL_QUERY"}
    )
    embedding = result.embeddings[0].values

    response = supabase.rpc("match_maintenance_logs", {
        "query_embedding": embedding,
        "match_threshold": 0.5,
        "match_count": 3,
        "filter_property_id": PROPERTY_ID
    }).execute()

    if response.data:
        for j, match in enumerate(response.data):
            print(f"  #{j+1} (similarity: {match['similarity']:.4f})")
            print(f"      {match['description'][:100]}...")
            print(f"      Vendor: {match['vendor_name']} | Cost: ${match['cost']} | Date: {match['reported_at'][:10]}")
    else:
        print("  No matches found!")
    print()
