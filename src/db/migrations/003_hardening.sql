-- src/db/migrations/003_hardening.sql
-- Clean any leftover test rows that violate constraints before applying
 
-- 1. Audit trail: keep users undeletable, add context, block TRUNCATE
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS actor_role VARCHAR(50),
  ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

CREATE OR REPLACE FUNCTION prevent_audit_log_modification() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or truncated';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
 
-- 2. Users: valid roles; Branch Lead must have a branch; branches cannot vanish
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_branch;
ALTER TABLE users ADD CONSTRAINT fk_users_branch
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN
  ('SUPER_ADMIN','FINANCE_REVIEWER','CONTENT_EDITOR','BRANCH_LEAD','HR_LEAD'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_branch_lead;
ALTER TABLE users ADD CONSTRAINT chk_users_branch_lead
  CHECK (role <> 'BRANCH_LEAD' OR branch_id IS NOT NULL);
 
-- 3. Status constraints
ALTER TABLE branches DROP CONSTRAINT IF EXISTS chk_branches_status;
ALTER TABLE branches ADD CONSTRAINT chk_branches_status
  CHECK (status IN ('FORMING','ACTIVE','PAUSED','CLOSED'));

ALTER TABLE volunteer_applications DROP CONSTRAINT IF EXISTS chk_app_status;
ALTER TABLE volunteer_applications ADD CONSTRAINT chk_app_status
  CHECK (status IN ('APPLIED','ACCEPTED','DECLINED'));

ALTER TABLE members DROP CONSTRAINT IF EXISTS chk_member_status;
ALTER TABLE members ADD CONSTRAINT chk_member_status
  CHECK (status IN ('ACTIVE','INACTIVE'));

ALTER TABLE weekly_reports DROP CONSTRAINT IF EXISTS chk_report_status;
ALTER TABLE weekly_reports ADD CONSTRAINT chk_report_status CHECK (status IN
  ('DRAFT','SUBMITTED','RETURNED','RESUBMITTED','APPROVED','LOCKED'));

ALTER TABLE content_items DROP CONSTRAINT IF EXISTS chk_content_status;
ALTER TABLE content_items ADD CONSTRAINT chk_content_status
  CHECK (status IN ('DRAFT','PUBLISHED'));

ALTER TABLE content_items DROP CONSTRAINT IF EXISTS chk_content_category;
ALTER TABLE content_items ADD CONSTRAINT chk_content_category
  CHECK (category IN ('ANNOUNCEMENT','NEWS','PROGRAM','EVENT','PAGE'));
 
-- 4. Applications: decline reason, review time, duplicate protection
ALTER TABLE volunteer_applications
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_pending_email
  ON volunteer_applications (lower(email)) WHERE status = 'APPLIED';
CREATE INDEX IF NOT EXISTS idx_app_status_created ON volunteer_applications(status, created_at DESC);
 
-- 5. Members: duplicate protection and search indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_members_email_active
  ON members (lower(email)) WHERE status = 'ACTIVE';
DROP INDEX IF EXISTS idx_members_code;
CREATE INDEX IF NOT EXISTS idx_members_name ON members (lower(full_name) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_members_team ON members(team);
CREATE INDEX IF NOT EXISTS idx_members_role ON members(role);
 
-- 6. Collections: NOT NULL flags, transfer and lock metadata, lock enforced in DB
UPDATE collections SET is_locked = FALSE WHERE is_locked IS NULL;
UPDATE collections SET is_sent_to_main_account = FALSE WHERE is_sent_to_main_account IS NULL;

ALTER TABLE collections
  ALTER COLUMN is_locked SET NOT NULL,
  ALTER COLUMN is_sent_to_main_account SET NOT NULL,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transferred_by UUID REFERENCES users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_collections_branch_date ON collections(branch_id, collection_date);
CREATE INDEX IF NOT EXISTS idx_collections_unrouted ON collections(collection_date)
  WHERE is_sent_to_main_account = FALSE;

CREATE OR REPLACE FUNCTION enforce_collection_lock() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked AND (NEW.amount_paisa <> OLD.amount_paisa
     OR NEW.collection_date <> OLD.collection_date OR NEW.branch_id <> OLD.branch_id) THEN
    RAISE EXCEPTION 'Locked collections cannot be modified';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_collection_lock ON collections;
CREATE TRIGGER trg_collection_lock BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION enforce_collection_lock();
 
-- 7. Weekly reports: Monday-to-Sunday, timestamps, approved rows immutable
-- 7. Weekly reports: Monday-to-Sunday, timestamps, approved rows immutable
ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at    TIMESTAMPTZ;

-- Normalize existing rows that violate the Monday-to-Sunday boundary
UPDATE weekly_reports
SET 
  week_start_date = week_start_date - (EXTRACT(ISODOW FROM week_start_date)::integer - 1),
  week_end_date = (week_start_date - (EXTRACT(ISODOW FROM week_start_date)::integer - 1)) + 6
WHERE 
  EXTRACT(ISODOW FROM week_start_date) <> 1 
  OR week_end_date <> week_start_date + 6;

-- Delete any duplicate reports created by the date normalization before applying constraints
DELETE FROM weekly_reports a USING weekly_reports b
WHERE a.id > b.id 
  AND a.branch_id = b.branch_id 
  AND a.week_start_date = b.week_start_date;

ALTER TABLE weekly_reports DROP CONSTRAINT IF EXISTS chk_report_week;
ALTER TABLE weekly_reports ADD CONSTRAINT chk_report_week
  CHECK (EXTRACT(ISODOW FROM week_start_date) = 1 AND week_end_date = week_start_date + 6);

ALTER TABLE weekly_reports DROP CONSTRAINT IF EXISTS chk_report_total;
ALTER TABLE weekly_reports ADD CONSTRAINT chk_report_total CHECK (total_amount_paisa >= 0);

CREATE INDEX IF NOT EXISTS idx_reports_status ON weekly_reports(status);

CREATE OR REPLACE FUNCTION enforce_report_immutability() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('APPROVED','LOCKED') THEN
    RAISE EXCEPTION 'Approved reports are immutable';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_report_immutable ON weekly_reports;
CREATE TRIGGER trg_report_immutable BEFORE UPDATE ON weekly_reports
  FOR EACH ROW EXECUTE FUNCTION enforce_report_immutability();
 
-- 8. Content: Urdu versions and event fields
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS title_ur   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS summary_ur TEXT,
  ADD COLUMN IF NOT EXISTS body_ur    TEXT,
  ADD COLUMN IF NOT EXISTS event_date DATE,
  ADD COLUMN IF NOT EXISTS location   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS location_ur VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_content_cat_status ON content_items(category, status, published_at DESC);
 
-- 9. Contact form storage table
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
