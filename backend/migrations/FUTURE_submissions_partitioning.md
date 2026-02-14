# Future Enhancement: Submissions Table Partitioning

## Overview

As the research study runs, the `submissions` table will grow continuously. Each participant can submit multiple descriptions (surveys + main trials), and with thousands of participants, this table can reach millions of rows.

## When to Implement

**Trigger points**:
- ✅ When `submissions` table exceeds **50 million rows**
- ✅ When query performance degrades noticeably
- ✅ When backup/restore times become problematic
- ✅ When archival requirements are needed

**Current state**: Not needed yet (likely < 10K rows)

## Partitioning Strategy

### Recommended: RANGE Partitioning by created_at

PostgreSQL supports native table partitioning (version 10+). For submissions, the best strategy is RANGE partitioning on `created_at`:

```sql
-- Convert existing table to partitioned table
-- WARNING: This is a complex operation requiring downtime

-- 1. Rename existing table
ALTER TABLE submissions RENAME TO submissions_old;

-- 2. Create partitioned table
CREATE TABLE submissions (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    participant_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    image_id VARCHAR(200) NOT NULL,
    image_url VARCHAR(500),
    survey_index INTEGER NOT NULL,
    description TEXT NOT NULL CHECK (char_length(description) <= 10000 AND char_length(description) > 0),
    word_count INTEGER NOT NULL CHECK (word_count BETWEEN 0 AND 10000),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
    feedback TEXT NOT NULL CHECK (char_length(feedback) <= 2000),
    time_spent_seconds DOUBLE PRECISION CHECK (time_spent_seconds >= 0),
    is_survey BOOLEAN DEFAULT FALSE,
    is_attention BOOLEAN DEFAULT FALSE,
    attention_passed BOOLEAN,
    too_fast_flag BOOLEAN DEFAULT FALSE,
    attention_score_at_submission FLOAT CHECK (attention_score_at_submission IS NULL OR (attention_score_at_submission >= 0 AND attention_score_at_submission <= 1)),
    quality_score FLOAT CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)),
    ai_suspected BOOLEAN DEFAULT FALSE,
    user_agent VARCHAR(500),
    ip_hash CHAR(64),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    PRIMARY KEY (id, created_at)  -- created_at must be in PK for partitioning
) PARTITION BY RANGE (created_at);

-- 3. Create partitions (example: quarterly)
CREATE TABLE submissions_2026_q1 PARTITION OF submissions
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');

CREATE TABLE submissions_2026_q2 PARTITION OF submissions
    FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

CREATE TABLE submissions_2026_q3 PARTITION OF submissions
    FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');

CREATE TABLE submissions_2026_q4 PARTITION OF submissions
    FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

-- Create default partition for future data
CREATE TABLE submissions_default PARTITION OF submissions DEFAULT;

-- 4. Copy data from old table
INSERT INTO submissions SELECT * FROM submissions_old;

-- 5. Recreate indexes on partitioned table
CREATE INDEX ON submissions(participant_id);
CREATE INDEX ON submissions(session_id);
CREATE INDEX ON submissions(image_id);
CREATE INDEX ON submissions(participant_id, survey_index);
-- ... (recreate all indexes)

-- 6. Recreate foreign keys
ALTER TABLE submissions 
    ADD CONSTRAINT fk_participant
    FOREIGN KEY (participant_id)
    REFERENCES participants(participant_id)
    ON DELETE CASCADE;

ALTER TABLE submissions 
    ADD CONSTRAINT fk_image
    FOREIGN KEY (image_id)
    REFERENCES images(image_id);

-- 7. Drop old table after verification
DROP TABLE submissions_old;
```

### Partition Management

Once partitioned, you'll need procedures to:

1. **Create new partitions** before they're needed:

```sql
-- Run monthly/quarterly
CREATE TABLE submissions_2027_q1 PARTITION OF submissions
    FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');
```

2. **Archive old partitions**:

```sql
-- Detach partition (keeps data, but removes from main table)
ALTER TABLE submissions DETACH PARTITION submissions_2024_q1;

-- Archive to cold storage
pg_dump -t submissions_2024_q1 | gzip > submissions_2024_q1.sql.gz

-- Drop partition
DROP TABLE submissions_2024_q1;
```

3. **Monitor partition sizes**:

```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS bytes
FROM pg_tables
WHERE tablename LIKE 'submissions_%'
ORDER BY bytes DESC;
```

## Benefits

### Performance
- **Faster queries**: PostgreSQL only scans relevant partitions
- **Faster maintenance**: VACUUM, ANALYZE run per partition
- **Better cache utilization**: Hot data (recent partitions) stay in cache

### Operational
- **Easy archival**: Simply detach old partitions
- **Faster backups**: Can backup recent partitions more frequently
- **Data retention**: Drop old partitions to meet retention policies

### Example Query Performance

```sql
-- Without partitioning
-- Scans entire table (100M rows)
SELECT * FROM submissions 
WHERE created_at >= '2026-12-01' AND created_at < '2027-01-01';
-- Cost: Full table scan (slow)

-- With partitioning
-- Only scans submissions_2026_q4 partition (~10M rows)
SELECT * FROM submissions 
WHERE created_at >= '2026-12-01' AND created_at < '2027-01-01';
-- Cost: Single partition scan (10x faster)
```

## Partition Sizing Guidelines

| Partition Period | Rows per Period* | Recommended When |
|------------------|------------------|------------------|
| Daily | ~100K | > 100M total rows, very high insert rate |
| Weekly | ~500K | > 50M total rows, high insert rate |
| Monthly | ~2M | > 20M total rows, medium insert rate |
| Quarterly | ~6M | 10-50M total rows, normal insert rate |
| Yearly | ~24M | < 10M total rows, low insert rate |

*Assuming 1000 submissions/day average

## Alternative: Time-Series Database

If submissions table becomes extremely large (> 1B rows) and queries are mostly time-based, consider:

- **TimescaleDB**: PostgreSQL extension optimized for time-series data
- **ClickHouse**: Column-oriented DB for analytics
- **Hybrid approach**: Keep recent data in PostgreSQL, move old data to data warehouse

## Implementation Checklist

Before implementing partitioning:

- [ ] Backup full database
- [ ] Test partitioning in staging environment
- [ ] Benchmark query performance (before/after)
- [ ] Update application code if needed (e.g., bulk inserts)
- [ ] Plan partition creation schedule (automated)
- [ ] Plan partition archival strategy
- [ ] Document operational procedures
- [ ] Set up monitoring for partition sizes
- [ ] Prepare rollback plan
- [ ] Schedule maintenance window (estimated 2-4 hours for 50M rows)

## Cost-Benefit Analysis

### When NOT to partition

- ❌ Total rows < 10M (partitioning overhead > benefit)
- ❌ Queries don't filter by date (partition pruning won't help)
- ❌ Team lacks PostgreSQL partitioning expertise
- ❌ No maintenance window available

### When TO partition

- ✅ Total rows > 50M and growing
- ✅ Most queries filter by date range
- ✅ Need to archive old data
- ✅ Experiencing slow query performance
- ✅ Backup/restore times are problematic

## Current Recommendation

**Status**: ⏸️ **NOT NEEDED YET**

The current schema is optimized with proper indexes. Monitor table size:

```sql
-- Check current table size
SELECT pg_size_pretty(pg_total_relation_size('submissions')) AS total_size,
       pg_size_pretty(pg_relation_size('submissions')) AS table_size,
       pg_size_pretty(pg_total_relation_size('submissions') - pg_relation_size('submissions')) AS indexes_size,
       (SELECT COUNT(*) FROM submissions) AS row_count;
```

**Re-evaluate when**:
- Row count exceeds 10 million
- Queries on recent data (last 30 days) slow down
- Backup times exceed acceptable limits

## References

- PostgreSQL Partitioning: https://www.postgresql.org/docs/current/ddl-partitioning.html
- Partition Pruning: https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-PRUNING
- Partition Management: https://www.postgresql.org/docs/current/sql-altertable.html

## Automated Partition Creation Example

Create a maintenance function:

```sql
CREATE OR REPLACE FUNCTION create_next_quarter_partition()
RETURNS void AS $$
DECLARE
    next_quarter_start DATE;
    next_quarter_end DATE;
    partition_name TEXT;
BEGIN
    -- Calculate next quarter
    next_quarter_start := date_trunc('quarter', CURRENT_DATE + interval '3 months');
    next_quarter_end := next_quarter_start + interval '3 months';
    
    -- Generate partition name
    partition_name := 'submissions_' || to_char(next_quarter_start, 'YYYY_q') || 
                     extract(quarter from next_quarter_start)::text;
    
    -- Create partition if it doesn't exist
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF submissions FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        next_quarter_start,
        next_quarter_end
    );
    
    RAISE NOTICE 'Created partition % for period % to %', 
                 partition_name, next_quarter_start, next_quarter_end;
END;
$$ LANGUAGE plpgsql;

-- Schedule via cron or pg_cron extension
-- Or call manually once per quarter
SELECT create_next_quarter_partition();
```
