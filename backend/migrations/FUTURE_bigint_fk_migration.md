# Future Migration: Switch to BIGINT Foreign Keys

## Overview

This document outlines the plan for migrating from using `participants.participant_id` (VARCHAR) as foreign keys to using `participants.id` (BIGINT) throughout the database schema.

## Current State

**Problem**: All foreign key relationships currently reference `participants.participant_id` (VARCHAR(100)), which is:
- ❌ Less efficient for joins (string comparison vs integer)
- ❌ Larger index size (100 bytes vs 8 bytes per entry)
- ❌ Not following standard database design patterns
- ❌ Requires string manipulation for uniqueness

**Affected Tables**:
- `payments` (participant_id VARCHAR(100) → FK)
- `attention_stats` (participant_id VARCHAR(100) → PK & FK)
- `submissions` (participant_id VARCHAR(100) → FK)
- `consent_records` (participant_id VARCHAR(100) → FK)
- `participant_stats` (participant_id VARCHAR(100) → PK & FK)
- `reward_winners` (participant_id VARCHAR(100) → FK)
- `audit_log` (participant_id VARCHAR(100) → for logging only, not FK)

## Ideal State

**Goal**: Use `participants.id` (BIGINT) for all foreign key relationships:
- ✅ Faster joins and lookups
- ✅ Smaller indexes and better cache utilization
- ✅ Standard database design pattern
- ✅ Easier to work with in code (numeric IDs)

**Keep** `participants.participant_id` as:
- Alternate/business key for human-readable identification
- Used in API responses where appropriate
- Indexed with UNIQUE constraint

## Migration Complexity

### Database Changes Required

1. **Add new BIGINT FK columns** to all dependent tables
2. **Populate** new columns via JOIN with participants table
3. **Update triggers** to log BIGINT IDs (convert to VARCHAR for audit_log)
4. **Add new foreign key constraints** on BIGINT columns
5. **Drop old foreign key constraints** on VARCHAR columns
6. **Rename columns** (old participant_id → participant_business_id, new participant_fk → participant_id)
7. **Update indexes** to use new BIGINT columns
8. **Update primary keys** where participant_id was PK (attention_stats, participant_stats)

### Application Code Changes Required

All SQL queries in `backend/app.py` that reference `participant_id` need review:

**Examples of queries that need updating**:

```python
# BEFORE (current)
result = db.execute(text('''
    SELECT reward_amount, status FROM reward_winners WHERE participant_id = :participant_id
'''), {"participant_id": participant_id_string})

# AFTER (post-migration)
# Option 1: Lookup numeric ID first
participant = db.execute(text('''
    SELECT id FROM participants WHERE participant_id = :participant_id
'''), {"participant_id": participant_id_string}).fetchone()
participant_numeric_id = participant[0]

result = db.execute(text('''
    SELECT reward_amount, status FROM reward_winners WHERE participant_id = :participant_id
'''), {"participant_id": participant_numeric_id})

# Option 2: JOIN to convert
result = db.execute(text('''
    SELECT rw.reward_amount, rw.status 
    FROM reward_winners rw
    JOIN participants p ON rw.participant_id = p.id
    WHERE p.participant_id = :participant_id
'''), {"participant_id": participant_id_string})
```

**Affected Endpoints** (non-exhaustive):
- `/api/participants` (POST, GET)
- `/api/consent` (POST, GET)
- `/api/payment/*` (all payment endpoints)
- `/api/submit` (POST)
- `/api/images/random` (GET)
- `/api/reward/*` (all reward endpoints)

### API Contract Changes

Decision needed: Should API endpoints continue to accept/return string `participant_id`, or switch to numeric IDs?

**Option A: Keep string IDs in API** (Recommended)
- ✅ No breaking changes for frontend
- ✅ More user-friendly (strings are readable)
- ⚠️ Requires lookup/conversion in backend
- Backend does: `participant_id_string → participants.id (BIGINT) → use in queries`

**Option B: Switch to numeric IDs in API**
- ✅ Cleaner backend code (no conversion needed)
- ❌ Breaking change for all API consumers
- ❌ Frontend must be updated simultaneously
- ❌ Less user-friendly (numeric IDs not readable)

### Frontend Changes

If Option A chosen: **No changes required** ✅

If Option B chosen: All API calls must be updated to use numeric IDs instead of strings.

## Migration Steps

### Phase 1: Preparation (No Downtime)

1. Run the database migration script to add new BIGINT columns
2. Backfill data (populate new columns)
3. Add new indexes (build concurrently to avoid locks)
4. Test thoroughly in staging environment

### Phase 2: Application Update (Brief Downtime)

1. Deploy new backend code that uses BIGINT IDs internally
2. Verify all endpoints work correctly
3. Monitor for errors

### Phase 3: Cleanup (No Downtime)

1. Drop old VARCHAR foreign key columns (now named `participant_business_id`)
2. Drop old indexes
3. Vacuum tables to reclaim space

## Estimated Impact

### Performance Improvements

- **Index size reduction**: ~92% smaller (VARCHAR(100) vs BIGINT)
- **Join performance**: ~3-5x faster (integer comparison vs string)
- **Memory usage**: Less cache pressure, more rows fit in cache

### Development Effort

- **Database migration**: 4-8 hours (write + test + verify)
- **Backend code changes**: 16-24 hours (update all queries + test)
- **Frontend changes** (if Option B): 8-16 hours
- **QA/Testing**: 8-16 hours
- **Total**: 36-64 hours

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Data loss during migration | HIGH | Full database backup + test in staging |
| Application downtime | MEDIUM | Blue-green deployment, rollback plan |
| Bugs in updated queries | HIGH | Comprehensive testing, gradual rollout |
| Performance regression | LOW | Benchmark before/after |
| Frontend breaking | HIGH (Option B) | Use Option A or coordinate releases |

## Recommendation

**Current recommendation**: **DEFER** this migration until:

1. The application is more stable and mature
2. Performance issues are actually observed
3. There's a dedicated maintenance window
4. The team has capacity for thorough testing

**Pragmatic approach**: The schema fixes applied in migration `001_pragmatic_schema_fixes.sql` address the most critical issues WITHOUT requiring application changes. The VARCHAR → BIGINT migration can be done later when the benefits justify the effort.

## Alternative: Hybrid Approach

Keep using `participant_id` (VARCHAR) as FK, but optimize it:

- ✅ Already done: Reduced TEXT to VARCHAR(100) for consistency
- ✅ Already done: Added proper indexes
- ✅ Consider: Use HASH indexes for equality lookups (PostgreSQL 10+)
- ✅ Consider: Implement caching layer to reduce DB lookups

This approach gives ~80% of the benefit with ~5% of the effort.

## References

- Original schema: `backend/schema.sql` (version 3.5.0)
- Fixed schema: `backend/schema.sql` (version 3.7.0)
- Pragmatic fixes: `backend/migrations/001_pragmatic_schema_fixes.sql`
- Full BIGINT migration: `backend/migrations/001_fix_schema_issues.sql` (reference only, not for production use)
