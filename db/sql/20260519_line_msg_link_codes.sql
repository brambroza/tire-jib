create table if not exists public.line_msg_link_codes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  line_login_user_id text,
  code text not null,
  status text not null default 'pending',
  line_msg_user_id text,
  expires_at timestamptz not null,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint line_msg_link_codes_status_check check (status in ('pending', 'linked', 'expired'))
);

create unique index if not exists line_msg_link_codes_code_uidx
  on public.line_msg_link_codes(code);

create index if not exists line_msg_link_codes_customer_idx
  on public.line_msg_link_codes(customer_id, status, created_at desc);

create trigger line_msg_link_codes_set_updated_at
before update on public.line_msg_link_codes
for each row
execute function set_updated_at();
