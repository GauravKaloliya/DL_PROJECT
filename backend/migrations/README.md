# Database Migrations

This directory contains database migration scripts and documentation for the C.O.G.N.I.T. research platform.

## Overview

The schema has been designed to balance:
- ✅ **Pragmatism**: Don't break existing code
- ✅ **Best practices**: Fix issues that don't require code changes
- ✅ **Future-proofing**: Document ideal state for future refactoring

## Files

### Applied Migrations

- **`001_pragmatic_schema_fixes.sql`**: Safe, non-breaking fixes
  - ✅ Fixed type mismatch (attention_checks.image_id)
  - ✅ Added score range constraints (0-1)
  - ✅ Improved portability (char_length vs length)
  - ✅ Added partial indexes for performance
  - ✅ Standardized TEXT to VARCHAR where appropriate
  - **Status**: Ready to apply to existing databases
  - **Downtime**: None (runs in transaction)
  - **Rollback**: Wrapped in BEGIN/COMMIT, rolls back on error

### Future Migrations (Deferred)

- **`FUTURE_bigint_fk_migration.md`**: Plan for switching FKs to BIGINT
  - ⏸️ Deferred: Requires extensive application code changes
  - Estimated effort: 36-64 hours
  - Benefits: ~3-5x faster joins, 92% smaller indexes
  - When: When performance becomes an issue

- **`FUTURE_submissions_partitioning.md`**: Plan for table partitioning
  - ⏸️ Deferred: Not needed until > 50M rows
  - Estimated effort: 8-16 hours
  - Benefits: Faster queries, easier archival
  - When: When table size or query performance becomes problematic

## Migration Status

| Migration | Version | Status | Applied Date | Breaking Changes |
|-----------|---------|--------|--------------|------------------|
| Initial schema | 3.6.0 | ✅ Deployed | (Initial) | N/A |
| Pragmatic fixes | 3.7.0 | 📋 Ready | Pending | No |
| BIGINT FKs | 4.0.0 | ⏸️ Planned | TBD | Yes (app code) |
| Partitioning | 4.1.0 | ⏸️ Planned | TBD | No (if done right) |

## How to Apply Migrations

### For New Installations

Simply run the main schema file:

```bash
psql $DATABASE_URL -f backend/schema.sql
```

This includes all pragmatic fixes (version 3.7.0).

### For Existing Databases

1. **Backup first** (ALWAYS):
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Check current version**:
   ```sql
   SELECT value FROM database_metadata WHERE key = 'version';
   ```

3. **Apply migration 001** (if on version < 3.7.0):
   ```bash
   psql $DATABASE_URL -f backend/migrations/001_pragmatic_schema_fixes.sql
   ```

4. **Verify**:
   ```sql
   -- Check version updated
   SELECT * FROM database_metadata WHERE key LIKE 'version' OR key LIKE 'migration%';
   
   -- Run validation queries (see migration file)
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'attention_checks' AND column_name = 'image_id';
   ```

### Rollback

If migration fails:

```bash
# Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

Migration 001 is wrapped in a transaction, so it will automatically rollback on error.

## Schema Issues Addressed

### ✅ Fixed in v3.7.0

| Issue | Severity | Fix |
|-------|----------|-----|
| Type mismatch (attention_checks.image_id) | ⭐⭐⭐ | Changed TEXT → VARCHAR(200) |
| Missing score constraints | ⭐⭐⭐ | Added CHECK (0-1) on all scores |
| Non-portable length() | ⭐⭐ | Changed to char_length() |
| Missing partial indexes | ⭐⭐ | Added for common filters |
| TEXT vs VARCHAR inconsistency | ⭐⭐ | Standardized to VARCHAR |

### ⏸️ Deferred (Future Work)

| Issue | Severity | Why Deferred |
|-------|----------|--------------|
| VARCHAR FK instead of BIGINT | ⭐⭐⭐⭐ | Requires app code rewrite |
| consent_records duplication | ⭐⭐ | Business logic decision needed |
| No partitioning strategy | ⭐⭐ | Not needed yet (< 50M rows) |
| reward_winners UNIQUE constraint | ⭐ | Business rule clarification needed |

## Best Practices

### Before Migrating

- [ ] Read the migration SQL file completely
- [ ] Understand what changes will be made
- [ ] Check for any custom modifications to your schema
- [ ] Backup database
- [ ] Test in staging environment first
- [ ] Plan for rollback if needed

### During Migration

- [ ] Monitor for errors
- [ ] Check transaction status
- [ ] Verify constraint additions don't fail on existing data
- [ ] Note any warnings

### After Migration

- [ ] Run validation queries
- [ ] Check application functionality
- [ ] Monitor performance metrics
- [ ] Update documentation if needed
- [ ] Keep backup for 30 days

## Troubleshooting

### Migration Fails with Constraint Violation

If migration fails because existing data violates new constraints:

```sql
-- Find violating records
SELECT * FROM attention_stats WHERE attention_score < 0 OR attention_score > 1;
SELECT * FROM submissions WHERE quality_score IS NOT NULL AND (quality_score < 0 OR quality_score > 1);
SELECT * FROM submissions WHERE ai_suspected = TRUE AND quality_score IS NULL;

-- Fix data before re-running migration
UPDATE attention_stats SET attention_score = 1.0 WHERE attention_score > 1;
UPDATE attention_stats SET attention_score = 0.0 WHERE attention_score < 0;
-- etc.
```

### Migration Hangs

If migration appears to hang (rare, but possible with indexes):

1. Check for locks:
   ```sql
   SELECT * FROM pg_stat_activity WHERE state != 'idle';
   ```

2. Check index creation progress:
   ```sql
   SELECT * FROM pg_stat_progress_create_index;
   ```

3. If truly stuck, can cancel (in separate session):
   ```sql
   SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE query LIKE 'CREATE INDEX%';
   ```

### Performance Degradation After Migration

If queries are slower after adding indexes (unlikely, but possible):

1. Run ANALYZE to update statistics:
   ```sql
   ANALYZE VERBOSE;
   ```

2. Check query plans:
   ```sql
   EXPLAIN ANALYZE SELECT ...;
   ```

3. If a specific index is problematic:
   ```sql
   DROP INDEX index_name;
   ```

## Monitoring

### Check Database Version

```sql
SELECT key, value, updated_at 
FROM database_metadata 
WHERE key IN ('version', 'schema_updated', 'migration_001');
```

### Check Table Sizes

```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Monitor for When to Partition

```sql
-- Check submissions table size and growth
SELECT 
    COUNT(*) as row_count,
    pg_size_pretty(pg_total_relation_size('submissions')) as total_size,
    MIN(created_at) as oldest_submission,
    MAX(created_at) as newest_submission,
    MAX(created_at) - MIN(created_at) as date_range,
    COUNT(*) / EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 86400 as avg_rows_per_day
FROM submissions;
```

Consider partitioning when:
- row_count > 50,000,000
- total_size > 50 GB
- Query performance degrades

## Contact

For questions about migrations:
1. Read the migration SQL file (heavily commented)
2. Check the FUTURE_*.md docs for context
3. Test in staging environment
4. Consult PostgreSQL documentation

## References

- Main schema: `backend/schema.sql`
- PostgreSQL docs: https://www.postgresql.org/docs/current/
- SQLAlchemy docs: https://docs.sqlalchemy.org/
