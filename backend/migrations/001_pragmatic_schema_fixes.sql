-- =====================================================
-- C.O.G.N.I.T. Pragmatic Schema Fixes Migration
-- Version: 3.7.0
-- Migration: 001_pragmatic_schema_fixes
-- =====================================================
-- 
-- This migration addresses schema issues that can be fixed
-- WITHOUT breaking the existing application code:
--
-- ✅ Fixed: Type mismatch in attention_checks.image_id
-- ✅ Fixed: Added range constraints on all score columns
-- ✅ Fixed: Changed length() to char_length() for portability
-- ✅ Fixed: Added partial indexes for performance
-- ✅ Fixed: Standardized TEXT to VARCHAR where appropriate
--
-- ⚠️  Deferred: Switching from participant_id VARCHAR to BIGINT id FKs
--     (Would require extensive application code changes)
--
-- IMPORTANT: Always backup your database before running migrations.
-- =====================================================

BEGIN;

-- =====================================================
-- Fix 1: Type Mismatch - attention_checks.image_id
-- =====================================================
-- Change from TEXT to VARCHAR(200) to match images.image_id

ALTER TABLE attention_checks 
    ALTER COLUMN image_id TYPE VARCHAR(200);

-- =====================================================
-- Fix 2: Standardize TEXT to VARCHAR in stats tables
-- =====================================================
-- These are participant_id references, should be VARCHAR(100)

ALTER TABLE attention_stats 
    ALTER COLUMN participant_id TYPE VARCHAR(100);

ALTER TABLE participant_stats 
    ALTER COLUMN participant_id TYPE VARCHAR(100);

ALTER TABLE reward_winners 
    ALTER COLUMN participant_id TYPE VARCHAR(100);

-- =====================================================
-- Fix 3: Add Range Constraints on Score Columns
-- =====================================================

-- attention_stats.attention_score
ALTER TABLE attention_stats 
    ADD CONSTRAINT check_attention_score_range 
    CHECK (attention_score >= 0 AND attention_score <= 1);

-- submissions.attention_score_at_submission
ALTER TABLE submissions 
    ADD CONSTRAINT check_attention_score_at_submission_range 
    CHECK (attention_score_at_submission IS NULL OR 
           (attention_score_at_submission >= 0 AND attention_score_at_submission <= 1));

-- submissions.quality_score
ALTER TABLE submissions 
    ADD CONSTRAINT check_quality_score_range 
    CHECK (quality_score IS NULL OR 
           (quality_score >= 0 AND quality_score <= 1));

-- participant_stats.attention_score
ALTER TABLE participant_stats 
    ADD CONSTRAINT check_participant_attention_score_range 
    CHECK (attention_score >= 0 AND attention_score <= 1);

-- Soft invariant: if ai_suspected is true, quality_score should exist
ALTER TABLE submissions 
    ADD CONSTRAINT check_ai_suspected_requires_quality_score 
    CHECK (ai_suspected = FALSE OR quality_score IS NOT NULL);

-- =====================================================
-- Fix 4: Improve CHECK Constraints for Portability
-- =====================================================

-- submissions.description - use char_length instead of length
ALTER TABLE submissions 
    DROP CONSTRAINT IF EXISTS submissions_description_check;

ALTER TABLE submissions 
    ADD CONSTRAINT check_description_length 
    CHECK (char_length(description) <= 10000 AND char_length(description) > 0);

-- submissions.feedback - use char_length instead of length
ALTER TABLE submissions 
    DROP CONSTRAINT IF EXISTS submissions_feedback_check;

ALTER TABLE submissions 
    ADD CONSTRAINT check_feedback_length 
    CHECK (char_length(feedback) <= 2000);

-- audit_log.details - use char_length instead of length
ALTER TABLE audit_log 
    DROP CONSTRAINT IF EXISTS audit_log_details_check;

ALTER TABLE audit_log 
    ADD CONSTRAINT check_audit_details_length 
    CHECK (details IS NULL OR char_length(details) <= 2000);

-- =====================================================
-- Fix 5: Add Partial Indexes for Performance
-- =====================================================
-- These indexes target frequently filtered states

-- Paid participants
CREATE INDEX IF NOT EXISTS idx_participants_payment_paid 
    ON participants(participant_id) 
    WHERE payment_status = 'paid';

-- Pending payments
CREATE INDEX IF NOT EXISTS idx_participants_payment_pending 
    ON participants(participant_id) 
    WHERE payment_status = 'pending';

-- Flagged participants
CREATE INDEX IF NOT EXISTS idx_attention_stats_flagged_true 
    ON attention_stats(participant_id, attention_score) 
    WHERE is_flagged = TRUE;

-- AI suspected submissions
CREATE INDEX IF NOT EXISTS idx_submissions_ai_suspected_true 
    ON submissions(id, participant_id, created_at) 
    WHERE ai_suspected = TRUE;

-- Too fast submissions
CREATE INDEX IF NOT EXISTS idx_submissions_too_fast_true 
    ON submissions(id, participant_id, created_at) 
    WHERE too_fast_flag = TRUE;

-- Pending rewards
CREATE INDEX IF NOT EXISTS idx_reward_winners_pending 
    ON reward_winners(participant_id, selected_at) 
    WHERE status = 'pending';

-- Paid rewards
CREATE INDEX IF NOT EXISTS idx_reward_winners_paid 
    ON reward_winners(participant_id, paid_at) 
    WHERE status = 'paid';

-- Priority eligible participants
CREATE INDEX IF NOT EXISTS idx_participant_stats_priority_true 
    ON participant_stats(participant_id, attention_score) 
    WHERE priority_eligible = TRUE;

-- Active attention checks
CREATE INDEX IF NOT EXISTS idx_attention_checks_active_true 
    ON attention_checks(image_id) 
    WHERE is_active = TRUE;

-- =====================================================
-- Fix 6: Add Composite Indexes for Common Queries
-- =====================================================

-- For queries joining submissions with attention checks
CREATE INDEX IF NOT EXISTS idx_submissions_attention_check 
    ON submissions(image_id, is_attention, attention_passed) 
    WHERE is_attention = TRUE;

-- For queries finding recent submissions by participant
CREATE INDEX IF NOT EXISTS idx_submissions_participant_recent 
    ON submissions(participant_id, created_at DESC);

-- For reward eligibility queries
CREATE INDEX IF NOT EXISTS idx_participant_stats_reward_eligibility 
    ON participant_stats(participant_id, attention_score, last_reward_attempt_at);

-- =====================================================
-- Fix 7: Add Missing Constraints
-- =====================================================

-- Ensure total_words and total_submissions are non-negative
ALTER TABLE participant_stats 
    ADD CONSTRAINT check_total_words_nonnegative 
    CHECK (total_words >= 0);

ALTER TABLE participant_stats 
    ADD CONSTRAINT check_total_submissions_nonnegative 
    CHECK (total_submissions >= 0);

ALTER TABLE participant_stats 
    ADD CONSTRAINT check_survey_rounds_nonnegative 
    CHECK (survey_rounds >= 0);

-- Ensure word_count matches constraint
ALTER TABLE submissions 
    ADD CONSTRAINT check_word_count_positive 
    CHECK (word_count >= 0);

-- =====================================================
-- Fix 8: Improve Existing Indexes
-- =====================================================

-- Drop redundant index (participant_id is already indexed as part of unique constraint)
DROP INDEX IF EXISTS idx_participants_id;

-- Ensure participants.participant_id has a unique index (should exist, but explicit)
-- The UNIQUE constraint already creates an index, so this is a no-op
-- Just documenting that this index exists via the UNIQUE constraint

-- =====================================================
-- Fix 9: Add Comments for Documentation
-- =====================================================

COMMENT ON TABLE participants IS 'Core participants table. participant_id is the business key (VARCHAR), id is the surrogate PK (BIGINT).';
COMMENT ON COLUMN participants.participant_id IS 'Business/human-readable participant identifier (used as FK in other tables)';
COMMENT ON COLUMN participants.id IS 'Surrogate primary key (BIGINT). Future migrations should use this as FK.';

COMMENT ON TABLE consent_records IS 'Audit trail for consent events. May contain duplicate participant_id entries for history.';
COMMENT ON COLUMN consent_records.participant_id IS 'References participants.participant_id (not participants.id)';

COMMENT ON TABLE attention_checks IS 'Attention check configuration. Expected words for specific images.';
COMMENT ON COLUMN attention_checks.image_id IS 'Must match images.image_id type (VARCHAR(200))';

COMMENT ON TABLE reward_winners IS 'One reward per participant (enforced by UNIQUE constraint on participant_id)';

COMMENT ON CONSTRAINT check_ai_suspected_requires_quality_score ON submissions 
    IS 'Soft invariant: ai_suspected=TRUE requires quality_score to be set';

COMMENT ON INDEX idx_submissions_ai_suspected_true IS 'Partial index for quickly finding AI-suspected submissions';
COMMENT ON INDEX idx_attention_stats_flagged_true IS 'Partial index for quickly finding flagged participants';

-- =====================================================
-- Fix 10: Update Database Metadata
-- =====================================================

INSERT INTO database_metadata (key, value)
VALUES
    ('version', '3.7.0'),
    ('schema_updated', CURRENT_TIMESTAMP::text),
    ('migration_001', 'applied - pragmatic fixes'),
    ('description', 'C.O.G.N.I.T. Research Platform - Fixed type mismatches, added constraints and performance indexes')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP;

-- Add migration history
INSERT INTO database_metadata (key, value)
VALUES
    ('migration_001_date', CURRENT_TIMESTAMP::text),
    ('migration_001_description', 'Fixed attention_checks type, added score constraints, improved indexes')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;

-- =====================================================
-- Post-Migration Verification Queries
-- =====================================================
--
-- Run these queries after migration to verify success:
--
-- 1. Check type consistency:
--    SELECT column_name, data_type, character_maximum_length 
--    FROM information_schema.columns 
--    WHERE table_name IN ('attention_checks', 'images') 
--    AND column_name = 'image_id';
--
-- 2. Verify score constraints:
--    SELECT constraint_name, check_clause 
--    FROM information_schema.check_constraints 
--    WHERE constraint_name LIKE '%score%';
--
-- 3. List partial indexes:
--    SELECT indexname, indexdef 
--    FROM pg_indexes 
--    WHERE indexdef LIKE '%WHERE%';
--
-- 4. Check for invalid scores (should return 0 rows):
--    SELECT 'attention_stats' as table_name, COUNT(*) as invalid_count 
--    FROM attention_stats 
--    WHERE attention_score < 0 OR attention_score > 1
--    UNION ALL
--    SELECT 'submissions', COUNT(*) 
--    FROM submissions 
--    WHERE quality_score IS NOT NULL AND (quality_score < 0 OR quality_score > 1);
--
-- =====================================================

-- =====================================================
-- Future Recommendations (Deferred)
-- =====================================================
--
-- ISSUE #1: Use BIGINT ID as Foreign Key (NOT FIXED)
-- =====================================================
-- Current: All tables reference participants.participant_id (VARCHAR(100))
-- Ideal: All tables should reference participants.id (BIGINT)
-- 
-- Why deferred: Would require:
-- - Extensive application code changes (all SQL queries in app.py)
-- - Data migration for all dependent tables
-- - API contract changes (endpoints use participant_id strings)
-- - Frontend changes (all API calls pass participant_id)
--
-- To implement: See /backend/migrations/FUTURE_bigint_fk_migration.md
--
-- =====================================================
-- ISSUE #10: Consent Records Duplication (NOTED)
-- =====================================================
-- consent_records duplicates fields from participants table
-- 
-- Current approach: Keep both for audit history
-- Removed UNIQUE constraint to allow multiple consent records per participant
--
-- Alternative approaches:
-- 1. Drop consent_records table, use participants.consent_* fields only
-- 2. Keep consent_records as pure audit log (no redundant fields)
-- 3. Add consent_version tracking for regulatory compliance
--
-- =====================================================
-- ISSUE #8: Partitioning Strategy (NOT IMPLEMENTED)
-- =====================================================
-- submissions table can grow very large
--
-- Recommendation: Implement RANGE partitioning when > 50M rows
-- 
-- Example strategy:
-- - Partition by created_at (monthly or quarterly)
-- - Retain recent partitions, archive old ones
-- - Implement partition management procedures
--
-- To implement: See /backend/migrations/FUTURE_submissions_partitioning.md
--
-- =====================================================
