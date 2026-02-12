#!/usr/bin/env python3
"""
Database initialization script for C.O.G.N.I.T. PostgreSQL database
This script should be run once to set up the database schema on Neon or other PostgreSQL instances.

Usage:
  python init_db.py                    # Initialize with DATABASE_URL from environment
  python init_db.py <connection-url>   # Initialize with provided connection URL

Environment Variables:
  DATABASE_URL or POSTGRES_URL - PostgreSQL connection string
"""

import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

def get_database_url():
    """Get database URL from environment or command line"""
    if len(sys.argv) > 1:
        return sys.argv[1]
    
    # Try multiple environment variable names (Neon uses different names)
    url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or os.getenv("POSTGRES_PRISMA_URL")
    
    if not url:
        print("Error: No database URL provided!")
        print("Usage:")
        print("  python init_db.py <connection-url>")
        print("  OR set DATABASE_URL environment variable")
        sys.exit(1)
    
    # Fix for SQLAlchemy (some providers use postgres:// instead of postgresql://)
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    
    return url

def read_schema():
    """Read the schema.sql file"""
    script_dir = Path(__file__).resolve().parent
    schema_path = script_dir / "schema.sql"
    
    if not schema_path.exists():
        print(f"Error: schema.sql not found at {schema_path}")
        sys.exit(1)
    
    with open(schema_path, 'r', encoding='utf-8') as f:
        return f.read()

def execute_schema(engine, schema_sql):
    """Execute the schema SQL statements"""
    print("Executing schema...")
    
    # Split by semicolon and execute each statement
    statements = schema_sql.split(';')
    
    with engine.connect() as conn:
        executed = 0
        failed = 0
        
        for statement in statements:
            statement = statement.strip()
            
            # Skip empty statements and comments
            if not statement or statement.startswith('--'):
                continue
            
            try:
                conn.execute(text(statement))
                executed += 1
                
                # Print first few words to show progress
                first_line = statement.split('\n')[0][:60]
                print(f"✓ {first_line}...")
                
            except Exception as e:
                # Some errors are expected (e.g., "relation already exists")
                error_msg = str(e).lower()
                if any(expected in error_msg for expected in ['already exists', 'duplicate']):
                    print(f"⚠ {first_line}... (already exists)")
                else:
                    print(f"✗ {first_line}...")
                    print(f"  Error: {e}")
                    failed += 1
        
        conn.commit()
        
    print(f"\nExecution complete:")
    print(f"  ✓ Executed: {executed}")
    if failed > 0:
        print(f"  ✗ Failed: {failed}")
    
    return failed == 0

def verify_database(engine):
    """Verify that the database was initialized correctly"""
    print("\nVerifying database...")
    
    required_tables = [
        'participants',
        'consent_records',
        'submissions',
        'images',
        'audit_log',
        'performance_metrics'
    ]
    
    with engine.connect() as conn:
        for table_name in required_tables:
            result = conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :table_name)"
            ), {"table_name": table_name})
            
            exists = result.scalar()
            if exists:
                print(f"✓ Table '{table_name}' exists")
            else:
                print(f"✗ Table '{table_name}' NOT found")
                return False
    
    print("\n✓ Database verification passed!")
    return True

def main():
    """Main initialization function"""
    print("=" * 60)
    print("C.O.G.N.I.T. Database Initialization")
    print("=" * 60)
    
    # Get database URL
    database_url = get_database_url()
    print(f"\nConnecting to database...")
    print(f"URL: {database_url.split('@')[0]}@***")  # Hide password in output
    
    # Create engine
    try:
        engine = create_engine(
            database_url,
            pool_pre_ping=True,
            echo=False
        )
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✓ Connected to: {version.split(',')[0]}")
        
    except Exception as e:
        print(f"✗ Failed to connect to database: {e}")
        sys.exit(1)
    
    # Read schema
    print(f"\nReading schema.sql...")
    schema_sql = read_schema()
    print(f"✓ Schema loaded ({len(schema_sql)} characters)")
    
    # Execute schema
    print(f"\nInitializing database schema...")
    success = execute_schema(engine, schema_sql)
    
    if not success:
        print("\n⚠ Some statements failed. This may be normal if the database already exists.")
        print("  Proceeding with verification...")
    
    # Verify database
    if verify_database(engine):
        print("\n" + "=" * 60)
        print("✓ Database initialization completed successfully!")
        print("=" * 60)
        return 0
    else:
        print("\n" + "=" * 60)
        print("✗ Database initialization failed verification")
        print("=" * 60)
        return 1

if __name__ == "__main__":
    sys.exit(main())
