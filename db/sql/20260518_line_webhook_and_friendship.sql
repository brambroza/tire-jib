alter table if exists public.customes
  add column if not exists line_is_friend boolean not null default false,
  add column if not exists line_friendship_checked_at timestamptz,
  add column if not exists line_followed_at timestamptz,
  add column if not exists line_unfollowed_at timestamptz;

create table if not exists public.line_webhook_events (
  id bigserial primary key,
  webhook_event_id text,
  event_type text not null,
  mode text,
  timestamp_ms bigint,
  line_user_id text,
  source_type text,
  source_group_id text,
  source_room_id text,
  message_id text,
  message_type text,
  message_text text,
  message_payload jsonb,
  raw_event jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists line_webhook_events_webhook_event_id_uidx
  on public.line_webhook_events (webhook_event_id)
  where webhook_event_id is not null;

create index if not exists line_webhook_events_line_user_id_idx
  on public.line_webhook_events (line_user_id, created_at desc);

create index if not exists line_webhook_events_message_id_idx
  on public.line_webhook_events (message_id)
  where message_id is not null;

create table if not exists public.line_webhook_media (
  id bigserial primary key,
  webhook_event_id bigint not null references public.line_webhook_events(id) on delete cascade,
  message_id text not null,
  line_user_id text,
  media_type text not null,
  content_type text,
  storage_bucket text,
  storage_path text,
  file_size_bytes bigint,
  file_name text,
  sticker_package_id text,
  sticker_id text,
  sticker_keywords jsonb,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists line_webhook_media_message_id_uidx
  on public.line_webhook_media (message_id);

create index if not exists line_webhook_media_line_user_id_idx
  on public.line_webhook_media (line_user_id, created_at desc);
