-- Application tables are accessed through the API, never directly by Supabase clients.
-- Revoke table-wide rights, including TRUNCATE, from browser-facing roles.
REVOKE ALL PRIVILEGES ON TABLE
  public.roles,
  public.departments,
  public.users,
  public.user_registration_requests,
  public.user_password_reset_requests,
  public.pending_auth_deletions,
  public.tasks,
  public.task_feedbacks,
  public.task_feedback_reads,
  public.audit_logs,
  public.period_locks
FROM anon, authenticated;

-- Keep future application tables private by default as well.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
