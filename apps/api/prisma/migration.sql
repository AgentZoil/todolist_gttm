-- Migration: Create all tables for Supabase project
-- Run this on Supabase SQL Editor for NEW projects
-- For EXISTING projects, see ALTER TABLE section at the bottom

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  auth_user_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  department_id TEXT REFERENCES departments(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  CREATE TYPE "TaskPriority" AS ENUM ('URGENT', 'NORMAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TaskApprovalStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'NEEDS_REVISION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TaskOfficialStatus" AS ENUM ('CANCELLED', 'IN_PROGRESS', 'INCOMPLETE', 'COMPLETED_EARLY', 'COMPLETED_ON_TIME', 'COMPLETED_LATE', 'NO_EVALUATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TaskFeedbackType" AS ENUM ('DIRECTIVE', 'REVIEW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TaskFeedbackDecision" AS ENUM ('APPROVED', 'NEEDS_REVISION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  assigned_date TIMESTAMPTZ NOT NULL,
  assigned_by TEXT NOT NULL,
  priority "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  document_number TEXT,
  coordinating_units TEXT,
  owner_department_id TEXT NOT NULL REFERENCES departments(id),
  required_completion_date TIMESTAMPTZ,
  actual_completion_date TIMESTAMPTZ,
  completion_evidence TEXT,
  incomplete_reason TEXT,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  approval_status "TaskApprovalStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  approved_status "TaskOfficialStatus",
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  finalized_at TIMESTAMPTZ,
  finalized_by TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_owner_department_id ON tasks(owner_department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_required_completion_date ON tasks(required_completion_date);
CREATE INDEX IF NOT EXISTS idx_tasks_actual_completion_date ON tasks(actual_completion_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_cancelled ON tasks(is_cancelled);
CREATE INDEX IF NOT EXISTS idx_tasks_is_finalized ON tasks(is_finalized);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_dept_req_date ON tasks(owner_department_id, required_completion_date);

-- Task Coordinating Departments
CREATE TABLE IF NOT EXISTS task_coordinating_departments (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, department_id)
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_feedbacks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type "TaskFeedbackType" NOT NULL,
  decision "TaskFeedbackDecision",
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_feedbacks_task_created_at ON task_feedbacks(task_id, created_at);

CREATE TABLE IF NOT EXISTS task_feedback_reads (
  feedback_id TEXT NOT NULL REFERENCES task_feedbacks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (feedback_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_feedback_reads_user_read_at ON task_feedback_reads(user_id, read_at);

-- Only department representatives are associated with a department.
UPDATE users
SET department_id = NULL
WHERE role_id IN (SELECT id FROM roles WHERE name <> 'DEPARTMENT_EDITOR');

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Period Locks
CREATE TABLE IF NOT EXISTS period_locks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL,
  locked_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);


-- ============================================================
-- FOR EXISTING DATABASES: Run these ALTER TABLE statements
-- to bring your schema up to date with the current Prisma schema
-- ============================================================

-- 1. Add missing columns to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS coordinating_units TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS incomplete_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority "TaskPriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_status "TaskApprovalStatus" NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_status "TaskOfficialStatus";
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- 2. Make users.department_id nullable (Admin users may not belong to any department)
-- First drop the FK, alter column, then re-add FK with SET NULL on delete
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_department_id_fkey;
ALTER TABLE users ALTER COLUMN department_id DROP NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Update tasks.updated_by FK to SET NULL on delete (instead of RESTRICT)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_updated_by_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Backfill title for existing tasks that have NULL title
-- (Set a default value based on task_code or content)
UPDATE tasks SET title = content WHERE title IS NULL;
