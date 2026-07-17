-- Queue table for LINE flex notifications.
-- Apply this SQL in Supabase SQL Editor.

create table if not exists public.notification_jobs (
  id bigserial primary key,
  event_type text not null,
  customer_id uuid not null,
  order_id uuid not null,
  line_user_id text not null,
  payload jsonb not null,
  dedupe_key text null,
  status text not null default 'pending',
  attempts int not null default 0,
  max_attempts int not null default 5,
  last_error text null,
  next_retry_at timestamptz not null default now(),
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_jobs_status_check check (status in ('pending', 'processing', 'failed', 'sent', 'dead'))
);

create unique index if not exists notification_jobs_event_dedupe_uniq
  on public.notification_jobs(event_type, dedupe_key)
  where dedupe_key is not null;

create index if not exists notification_jobs_status_retry_idx
  on public.notification_jobs(status, next_retry_at, created_at);

create index if not exists notification_jobs_order_idx
  on public.notification_jobs(order_id, created_at desc);

create index if not exists notification_jobs_customer_idx
  on public.notification_jobs(customer_id, created_at desc);

alter table public.notification_jobs enable row level security;

revoke all on public.notification_jobs from public;
grant all on public.notification_jobs to service_role;
