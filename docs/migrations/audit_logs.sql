-- PHASE 1 §7.1 — Audit logging table
-- Apply this in the Supabase SQL editor before deploying Phase 1.
-- The audit util swallows write errors so the app stays up if the table is missing,
-- but logs will silently fail until this migration is applied.

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb default '{}'::jsonb,
  ip_address text,
  created_at timestamptz default now()
);

create index if not exists audit_logs_user_id_idx on audit_logs(user_id);
create index if not exists audit_logs_action_idx on audit_logs(action);
