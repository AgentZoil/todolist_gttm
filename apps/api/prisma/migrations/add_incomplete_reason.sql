-- Migration: Add incomplete_reason column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS incomplete_reason TEXT;
