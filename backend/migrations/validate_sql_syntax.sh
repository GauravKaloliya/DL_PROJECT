#!/bin/bash
# Simple SQL syntax validator
# Checks for common issues without needing a running database

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== SQL Syntax Validation ===${NC}"
echo ""

# Check if files exist
if [ ! -f "../schema.sql" ]; then
    echo -e "${RED}✗ schema.sql not found${NC}"
    exit 1
fi

if [ ! -f "001_pragmatic_schema_fixes.sql" ]; then
    echo -e "${RED}✗ 001_pragmatic_schema_fixes.sql not found${NC}"
    exit 1
fi

# Function to check SQL file for common issues
validate_file() {
    local file=$1
    local errors=0
    
    echo -e "${YELLOW}Checking $file...${NC}"
    
    # Check for BEGIN/COMMIT balance
    begin_count=$(grep -c "^BEGIN;" "$file" || true)
    commit_count=$(grep -c "^COMMIT;" "$file" || true)
    
    if [ "$begin_count" -ne "$commit_count" ]; then
        echo -e "${RED}✗ Unbalanced BEGIN/COMMIT (BEGIN: $begin_count, COMMIT: $commit_count)${NC}"
        errors=$((errors + 1))
    else
        echo -e "${GREEN}✓ Transaction blocks balanced${NC}"
    fi
    
    # Check for obvious syntax errors
    if grep -q "CREAT TABLE" "$file"; then
        echo -e "${RED}✗ Found typo: CREAT TABLE (should be CREATE TABLE)${NC}"
        errors=$((errors + 1))
    fi
    
    if grep -q "PRIMERY KEY" "$file"; then
        echo -e "${RED}✗ Found typo: PRIMERY KEY (should be PRIMARY KEY)${NC}"
        errors=$((errors + 1))
    fi
    
    if grep -q "FORIEGN KEY" "$file"; then
        echo -e "${RED}✗ Found typo: FORIEGN KEY (should be FOREIGN KEY)${NC}"
        errors=$((errors + 1))
    fi
    
    # Check for unclosed quotes
    single_quotes=$(grep -o "'" "$file" | wc -l)
    if [ $((single_quotes % 2)) -ne 0 ]; then
        echo -e "${YELLOW}⚠ Odd number of single quotes (might be intentional)${NC}"
    fi
    
    # Check for common PostgreSQL-specific syntax
    if grep -q "IF NOT EXISTS" "$file"; then
        echo -e "${GREEN}✓ Uses IF NOT EXISTS (idempotent)${NC}"
    fi
    
    # Check for proper constraint syntax
    if grep -q "CHECK (" "$file"; then
        echo -e "${GREEN}✓ Contains CHECK constraints${NC}"
    fi
    
    # Check for indexes
    index_count=$(grep -c "CREATE INDEX" "$file" || true)
    if [ "$index_count" -gt 0 ]; then
        echo -e "${GREEN}✓ Contains $index_count indexes${NC}"
    fi
    
    return $errors
}

# Validate main schema
echo "=== Validating schema.sql ==="
validate_file "../schema.sql"
schema_errors=$?

echo ""
echo "=== Validating migration script ==="
validate_file "001_pragmatic_schema_fixes.sql"
migration_errors=$?

echo ""
echo "=== Additional Migration Checks ==="

# Check that migration has proper structure
if grep -q "Step 1:" "001_pragmatic_schema_fixes.sql"; then
    echo -e "${GREEN}✓ Migration is well-documented${NC}"
fi

if grep -q "Fix 1:" "001_pragmatic_schema_fixes.sql"; then
    echo -e "${GREEN}✓ Migration has clear fix sections${NC}"
fi

if grep -q "BEGIN;" "001_pragmatic_schema_fixes.sql" && grep -q "COMMIT;" "001_pragmatic_schema_fixes.sql"; then
    echo -e "${GREEN}✓ Migration is wrapped in transaction${NC}"
fi

# Count the changes
alter_count=$(grep -c "^ALTER TABLE" "001_pragmatic_schema_fixes.sql" || true)
index_count=$(grep -c "^CREATE INDEX" "001_pragmatic_schema_fixes.sql" || true)
comment_count=$(grep -c "^COMMENT ON" "001_pragmatic_schema_fixes.sql" || true)

echo ""
echo -e "${YELLOW}Migration Statistics:${NC}"
echo "  - ALTER TABLE statements: $alter_count"
echo "  - CREATE INDEX statements: $index_count"
echo "  - COMMENT ON statements: $comment_count"

echo ""
echo "=== Checking schema version consistency ==="

# Check version in schema.sql
schema_version=$(grep "Version:" "../schema.sql" | head -1 | grep -oP '\d+\.\d+\.\d+' || echo "unknown")
echo "schema.sql version: $schema_version"

# Check version in migration
migration_version=$(grep "Version:" "001_pragmatic_schema_fixes.sql" | head -1 | grep -oP '\d+\.\d+\.\d+' || echo "unknown")
echo "migration version: $migration_version"

if [ "$schema_version" == "$migration_version" ]; then
    echo -e "${GREEN}✓ Versions match${NC}"
else
    echo -e "${YELLOW}⚠ Versions differ (migration: $migration_version, schema: $schema_version)${NC}"
fi

# Check if metadata update is present
if grep -q "INSERT INTO database_metadata" "001_pragmatic_schema_fixes.sql"; then
    echo -e "${GREEN}✓ Migration updates database_metadata${NC}"
fi

echo ""
if [ $schema_errors -eq 0 ] && [ $migration_errors -eq 0 ]; then
    echo -e "${GREEN}=== All Syntax Checks Passed ===${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test migration in staging: ./test_migration.sh"
    echo "2. Review migration output carefully"
    echo "3. Backup production database"
    echo "4. Apply migration to production"
    exit 0
else
    echo -e "${RED}=== Some Issues Found ===${NC}"
    echo "Total errors: $((schema_errors + migration_errors))"
    exit 1
fi
