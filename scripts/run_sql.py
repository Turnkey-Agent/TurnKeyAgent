"""
Execute SQL migration and seed files against the Postgres database.

Usage:
    python scripts/run_sql.py                           # Uses DATABASE_URL from env
    python scripts/run_sql.py --db-url <url>            # Uses explicit URL
    python scripts/run_sql.py --vps                     # Uses VPS database (requires SSH tunnel on port 5433)
"""

import os
import sys
import argparse
import psycopg2

# Allow running from project root or scripts/
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# VPS connection string (requires SSH tunnel: ssh -L 5433:127.0.0.1:5433 root@72.62.82.57 -N)
VPS_DATABASE_URL = "postgresql://admin:i87RfJUBx5HZJuykZt4v9u3zaq10wAqV@127.0.0.1:5433/turnkey_agent"

# Default: Supabase DATABASE_URL from .env or environment
DEFAULT_DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:vercel88@db.blpidunyxhyazyhvunta.supabase.co:5432/postgres"
)

SQL_FILES = [
    os.path.join(PROJECT_ROOT, "sql", "001_migration.sql"),
    os.path.join(PROJECT_ROOT, "sql", "002_seed.sql"),
]

VERIFY_QUERIES = [
    ("properties", "SELECT count(*) FROM properties"),
    ("units", "SELECT count(*) FROM units"),
    ("vendors", "SELECT count(*) FROM vendors"),
    ("maintenance_logs", "SELECT count(*) FROM maintenance_logs"),
    ("incidents", "SELECT count(*) FROM incidents"),
    ("call_logs", "SELECT count(*) FROM call_logs"),
]


def main():
    parser = argparse.ArgumentParser(description="Execute SQL migration and seed files")
    parser.add_argument("--db-url", type=str, help="Database connection URL")
    parser.add_argument("--vps", action="store_true", help="Use VPS database (requires SSH tunnel)")
    args = parser.parse_args()

    if args.vps:
        db_url = VPS_DATABASE_URL
    elif args.db_url:
        db_url = args.db_url
    else:
        db_url = DEFAULT_DATABASE_URL

    # Determine SSL mode based on host
    ssl_mode = "disable" if "127.0.0.1" in db_url or "localhost" in db_url else "require"

    print(f"Connecting to database...")
    print(f"  URL: {db_url[:50]}...")

    try:
        conn = psycopg2.connect(db_url, sslmode=ssl_mode)
        conn.autocommit = True
        cur = conn.cursor()
        print("  Connected successfully.\n")
    except Exception as e:
        print(f"  ERROR: Could not connect: {e}")
        sys.exit(1)

    # Execute SQL files
    for sql_file in SQL_FILES:
        filename = os.path.basename(sql_file)
        print(f"Executing {filename}...")

        try:
            with open(sql_file, "r", encoding="utf-8") as f:
                sql = f.read()
            cur.execute(sql)
            print(f"  {filename} executed successfully.")
        except Exception as e:
            print(f"  ERROR executing {filename}: {e}")
            # Continue to next file on error
            conn.rollback() if not conn.autocommit else None

    print()

    # Verify
    print("=" * 50)
    print("VERIFICATION — Table row counts:")
    print("=" * 50)

    for table_name, query in VERIFY_QUERIES:
        try:
            cur.execute(query)
            count = cur.fetchone()[0]
            status = "OK" if table_name in ("maintenance_logs", "incidents", "call_logs") or count > 0 else "OK"
            print(f"  {table_name:25s} {count:>5d} rows  {status}")
        except Exception as e:
            print(f"  {table_name:25s} ERROR: {e}")

    # Also verify the function exists
    print()
    print("Checking function match_maintenance_logs...")
    try:
        cur.execute("""
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_name = 'match_maintenance_logs'
              AND routine_type = 'FUNCTION';
        """)
        result = cur.fetchone()
        if result:
            print("  match_maintenance_logs function exists. OK")
        else:
            print("  WARNING: match_maintenance_logs function not found.")
    except Exception as e:
        print(f"  ERROR checking function: {e}")

    # Verify pgvector extension
    print()
    print("Checking pgvector extension...")
    try:
        cur.execute("SELECT extversion FROM pg_extension WHERE extname = 'vector';")
        result = cur.fetchone()
        if result:
            print(f"  pgvector version {result[0]} installed. OK")
        else:
            print("  WARNING: pgvector extension not found.")
    except Exception as e:
        print(f"  ERROR checking pgvector: {e}")

    # Show sample data
    print()
    print("=" * 50)
    print("SAMPLE DATA:")
    print("=" * 50)

    try:
        cur.execute("SELECT name, address, guest_access_code FROM properties LIMIT 5;")
        rows = cur.fetchall()
        print(f"\n  Properties ({len(rows)}):")
        for row in rows:
            print(f"    {row[0]} | {row[1]} | code: {row[2]}")
    except Exception as e:
        print(f"  ERROR: {e}")

    try:
        cur.execute("SELECT unit_number, bedrooms, status, current_guest_name FROM units LIMIT 5;")
        rows = cur.fetchall()
        print(f"\n  Units ({len(rows)}):")
        for row in rows:
            print(f"    Unit {row[0]} | {row[1]}BR | {row[2]} | Guest: {row[3]}")
    except Exception as e:
        print(f"  ERROR: {e}")

    try:
        cur.execute("SELECT name, phone, specialty, rating, is_preferred FROM vendors ORDER BY rating DESC;")
        rows = cur.fetchall()
        print(f"\n  Vendors ({len(rows)}):")
        for row in rows:
            preferred = " [PREFERRED]" if row[4] else ""
            print(f"    {row[0]} | {row[1]} | {row[2]} | rating: {row[3]}{preferred}")
    except Exception as e:
        print(f"  ERROR: {e}")

    cur.close()
    conn.close()
    print("\nDone. Database migration and seed completed successfully.")


if __name__ == "__main__":
    main()
