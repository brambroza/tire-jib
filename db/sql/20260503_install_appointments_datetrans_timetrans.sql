alter table if exists public.install_appointments
  add column if not exists datetrans text,
  add column if not exists timetrans text;

update public.install_appointments
set
  datetrans = coalesce(datetrans, to_char(timezone('Asia/Bangkok', scheduled_at), 'YYYY-MM-DD')),
  timetrans = coalesce(timetrans, to_char(timezone('Asia/Bangkok', scheduled_at), 'HH24:MI'))
where scheduled_at is not null;

alter table if exists public.install_appointments
  drop constraint if exists install_appointments_datetrans_format_check;
alter table if exists public.install_appointments
  add constraint install_appointments_datetrans_format_check
  check (datetrans is null or datetrans ~ '^\\d{4}-\\d{2}-\\d{2}$');

create index if not exists install_appointments_datetrans_timetrans_idx
  on public.install_appointments (datetrans, timetrans, status);

create index if not exists install_appointments_scheduled_at_idx
  on public.install_appointments (scheduled_at);
