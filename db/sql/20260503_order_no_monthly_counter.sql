create table if not exists public.order_no_counters (
  period_ym text primary key,
  last_seq integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint order_no_counters_period_ym_check check (period_ym ~ '^[0-9]{6}$'),
  constraint order_no_counters_last_seq_check check (last_seq >= 0)
);

create or replace function public.next_order_no_monthly(
  p_prefix text default 'JIB',
  p_now timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := coalesce(nullif(btrim(p_prefix), ''), 'JIB');
  v_now_bkk timestamp := timezone('Asia/Bangkok', p_now);
  v_period_ym text := to_char(v_now_bkk, 'YYYYMM');
  v_period_ymd text := to_char(v_now_bkk, 'YYYYMMDD');
  v_seq integer;
begin
  insert into public.order_no_counters (period_ym, last_seq)
  values (v_period_ym, 1)
  on conflict (period_ym)
  do update
    set last_seq = public.order_no_counters.last_seq + 1,
        updated_at = now()
  returning last_seq into v_seq;

  return v_prefix || '-' || v_period_ymd || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

revoke all on table public.order_no_counters from public;
grant all on table public.order_no_counters to service_role;

revoke all on function public.next_order_no_monthly(text, timestamptz) from public;
grant execute on function public.next_order_no_monthly(text, timestamptz)
  to authenticated, service_role;
