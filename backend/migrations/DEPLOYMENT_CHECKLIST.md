# Deployment Checklist for Schema Fixes (v3.7.0)

## Pre-Deployment

### 1. Review and Understand Changes
- [ ] Read `SCHEMA_FIXES.md` in project root
- [ ] Review `backend/migrations/CHANGES_SUMMARY.md`
- [ ] Understand all changes in `001_pragmatic_schema_fixes.sql`
- [ ] Confirm no breaking changes for application

### 2. Backup Strategy
- [ ] Full database backup before migration
  ```bash
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] Verify backup can be restored
  ```bash
  # Test in separate database
  createdb test_restore
  psql test_restore < backup_YYYYMMDD_HHMMSS.sql
  dropdb test_restore
  ```
- [ ] Store backup securely (off-server)
- [ ] Document backup location and timestamp

### 3. Test in Staging
- [ ] Apply migration to staging database:
  ```bash
  psql $STAGING_DATABASE_URL -f backend/migrations/001_pragmatic_schema_fixes.sql
  ```
- [ ] Run validation queries (see below)
- [ ] Test application functionality:
  - [ ] Create participant
  - [ ] Record consent
  - [ ] Submit responses
  - [ ] Check reward eligibility
  - [ ] View admin stats
- [ ] Run performance tests (if applicable)
- [ ] Check application logs for errors
- [ ] Verify no constraint violations

### 4. Validate Syntax (Optional)
- [ ] Run syntax validator:
  ```bash
  cd backend/migrations
  ./validate_sql_syntax.sh
  ```

### 5. Schedule Downtime (if needed)
- [ ] Determine if downtime is necessary (usually NO for this migration)
- [ ] Notify stakeholders if downtime planned
- [ ] Choose low-traffic time window
- [ ] Prepare rollback communications

---

## Deployment Steps

### Step 1: Final Checks
- [ ] Verify production database connection:
  ```bash
  psql $DATABASE_URL -c "SELECT version();"
  ```
- [ ] Check current schema version:
  ```bash
  psql $DATABASE_URL -c "SELECT value FROM database_metadata WHERE key = 'version';"
  ```
- [ ] Verify no active long-running queries:
  ```sql
  SELECT pid, state, query_start, query 
  FROM pg_stat_activity 
  WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%';
  ```

### Step 2: Create Backup
- [ ] Create pre-migration backup:
  ```bash
  pg_dump $DATABASE_URL > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] Note backup size and time taken
- [ ] Verify backup file is not empty:
  ```bash
  ls -lh backup_pre_migration_*.sql
  ```

### Step 3: Apply Migration
- [ ] Apply migration script:
  ```bash
  psql $DATABASE_URL -f backend/migrations/001_pragmatic_schema_fixes.sql
  ```
- [ ] Monitor output for errors
- [ ] Note any warnings
- [ ] Record start and end time
- [ ] Check exit code (should be 0):
  ```bash
  echo $?
  ```

### Step 4: Validate Migration
- [ ] Check schema version updated:
  ```sql
  SELECT value FROM database_metadata WHERE key = 'version';
  -- Should return: 3.7.0
  ```

- [ ] Verify type fixes:
  ```sql
  SELECT table_name, column_name, data_type, character_maximum_length
  FROM information_schema.columns 
  WHERE table_name IN ('attention_checks', 'images') AND column_name = 'image_id';
  -- Both should be: character varying | 200
  ```

- [ ] Check constraints added:
  ```sql
  SELECT COUNT(*) FROM information_schema.check_constraints 
  WHERE constraint_name LIKE '%score%';
  -- Should be >= 4
  ```

- [ ] Verify partial indexes:
  ```sql
  SELECT COUNT(*) FROM pg_indexes WHERE indexdef LIKE '%WHERE%';
  -- Should be >= 9
  ```

- [ ] Check for invalid data (should return 0):
  ```sql
  SELECT COUNT(*) FROM attention_stats 
  WHERE attention_score < 0 OR attention_score > 1;
  
  SELECT COUNT(*) FROM submissions 
  WHERE quality_score IS NOT NULL AND (quality_score < 0 OR quality_score > 1);
  
  SELECT COUNT(*) FROM submissions 
  WHERE ai_suspected = TRUE AND quality_score IS NULL;
  ```

### Step 5: Test Application
- [ ] Restart application (if needed)
- [ ] Test critical paths:
  - [ ] Homepage loads
  - [ ] Participant registration
  - [ ] Consent form
  - [ ] Survey submissions
  - [ ] Admin dashboard
- [ ] Check application logs for errors
- [ ] Monitor database connection pool
- [ ] Verify query performance (should be same or better)

---

## Post-Deployment

### Immediate (First Hour)
- [ ] Monitor application logs for errors
- [ ] Check database error logs:
  ```sql
  SELECT * FROM pg_stat_database WHERE datname = 'cognit';
  ```
- [ ] Monitor response times
- [ ] Verify no constraint violations in production:
  ```sql
  SELECT constraint_name, table_name 
  FROM information_schema.table_constraints 
  WHERE constraint_type = 'CHECK';
  ```
- [ ] Test several user flows end-to-end

### Short-term (First 24 Hours)
- [ ] Monitor for any performance regressions
- [ ] Check index usage:
  ```sql
  SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
  ORDER BY idx_scan DESC;
  ```
- [ ] Verify partial indexes are being used:
  ```sql
  SELECT indexname, idx_scan 
  FROM pg_stat_user_indexes 
  WHERE indexname LIKE '%_true' OR indexname LIKE '%_paid' OR indexname LIKE '%_pending'
  ORDER BY idx_scan DESC;
  ```
- [ ] Check for any user-reported issues
- [ ] Monitor database size:
  ```sql
  SELECT pg_size_pretty(pg_database_size(current_database()));
  ```

### Long-term (First Week)
- [ ] Compare query performance metrics (before/after)
- [ ] Verify data quality improvements
- [ ] Document any observations
- [ ] Update runbooks if needed
- [ ] Archive backup (keep for 30 days minimum)

---

## Rollback Procedure

### If Migration Fails During Application
1. Migration is wrapped in transaction - will auto-rollback
2. Check error message in output
3. No manual rollback needed

### If Issues Discovered After Migration
1. **Assess severity**:
   - Critical: Rollback immediately
   - Minor: Document and fix forward

2. **Rollback steps**:
   ```bash
   # Stop application (optional, depends on issue)
   # systemctl stop cognit-backend
   
   # Restore from backup
   psql $DATABASE_URL < backup_pre_migration_YYYYMMDD_HHMMSS.sql
   
   # Verify restoration
   psql $DATABASE_URL -c "SELECT value FROM database_metadata WHERE key = 'version';"
   # Should return: 3.6.0 (or previous version)
   
   # Restart application
   # systemctl start cognit-backend
   ```

3. **Post-rollback**:
   - [ ] Verify application works
   - [ ] Document what went wrong
   - [ ] Investigate issue
   - [ ] Fix migration script if needed
   - [ ] Plan retry

---

## Validation Queries (Full Set)

### Quick Health Check
```sql
-- All should pass
SELECT 'Version' as check_name, 
       CASE WHEN value = '3.7.0' THEN 'PASS' ELSE 'FAIL' END as result
FROM database_metadata WHERE key = 'version'
UNION ALL
SELECT 'Type consistency',
       CASE WHEN COUNT(DISTINCT data_type) = 1 THEN 'PASS' ELSE 'FAIL' END
FROM information_schema.columns 
WHERE table_name IN ('attention_checks', 'images') AND column_name = 'image_id'
UNION ALL
SELECT 'Score constraints',
       CASE WHEN COUNT(*) >= 4 THEN 'PASS' ELSE 'FAIL' END
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%score%'
UNION ALL
SELECT 'Partial indexes',
       CASE WHEN COUNT(*) >= 9 THEN 'PASS' ELSE 'FAIL' END
FROM pg_indexes WHERE indexdef LIKE '%WHERE%';
```

### Data Integrity Check
```sql
-- All should return 0
SELECT 'Invalid attention_score' as issue, COUNT(*) as count
FROM attention_stats WHERE attention_score < 0 OR attention_score > 1
UNION ALL
SELECT 'Invalid quality_score', COUNT(*)
FROM submissions WHERE quality_score IS NOT NULL AND (quality_score < 0 OR quality_score > 1)
UNION ALL
SELECT 'AI suspected without quality_score', COUNT(*)
FROM submissions WHERE ai_suspected = TRUE AND quality_score IS NULL
UNION ALL
SELECT 'Orphaned payments', COUNT(*)
FROM payments p WHERE NOT EXISTS (SELECT 1 FROM participants WHERE participant_id = p.participant_id)
UNION ALL
SELECT 'Orphaned submissions', COUNT(*)
FROM submissions s WHERE NOT EXISTS (SELECT 1 FROM participants WHERE participant_id = s.participant_id);
```

### Index Health
```sql
SELECT 
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND (indexname LIKE '%_true' OR indexname LIKE '%_paid' OR indexname LIKE '%_pending')
ORDER BY idx_scan DESC;
```

---

## Troubleshooting

### Migration Fails with Constraint Violation

**Symptom**: ALTER TABLE fails with "violates check constraint"

**Solution**: Fix invalid data before retrying
```sql
-- Find problematic data
SELECT * FROM attention_stats WHERE attention_score < 0 OR attention_score > 1;

-- Fix it
UPDATE attention_stats SET attention_score = GREATEST(0, LEAST(1, attention_score));

-- Retry migration
```

### Application Can't Connect After Migration

**Symptom**: "Connection refused" or "Too many connections"

**Solution**: 
1. Check database is running: `systemctl status postgresql`
2. Check connection limits: `SELECT * FROM pg_stat_activity;`
3. Restart application if using connection pooling

### Queries Slower After Migration

**Symptom**: Response times increased

**Solution**:
1. Run ANALYZE: `ANALYZE VERBOSE;`
2. Check query plans: `EXPLAIN ANALYZE SELECT ...;`
3. Verify indexes are being used
4. If specific partial index is problematic, can drop it

---

## Success Criteria

Migration is successful when:
- ✅ Schema version is 3.7.0
- ✅ All validation queries pass
- ✅ Application functions normally
- ✅ No errors in logs
- ✅ Query performance is same or better
- ✅ Data integrity maintained

---

## Contact / Escalation

If issues arise:
1. Check this checklist first
2. Review migration script comments
3. Check `backend/migrations/README.md` for troubleshooting
4. Have backup ready for rollback
5. Document all issues for post-mortem

---

## Notes Section

Use this space to document your deployment:

**Date/Time of Deployment**: _______________

**Person Performing Deployment**: _______________

**Database Size Before**: _______________

**Database Size After**: _______________

**Migration Duration**: _______________

**Issues Encountered**: 


**Resolution**:


**Performance Notes**:


**Backup Location**: _______________

**Backup Size**: _______________
