-- Migration: Create all tables for new Supabase project
-- Run this on Supabase SQL Editor

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
  department_id TEXT NOT NULL REFERENCES departments(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_code TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  assigned_date TIMESTAMPTZ NOT NULL,
  assigned_by TEXT NOT NULL,
  document_number TEXT,
  owner_department_id TEXT NOT NULL REFERENCES departments(id),
  required_completion_date TIMESTAMPTZ,
  actual_completion_date TIMESTAMPTZ,
  completion_evidence TEXT,
  incomplete_reason TEXT,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
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
