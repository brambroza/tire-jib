alter table if exists public.carts
  add column if not exists datetrans text,
  add column if not exists timetrans text;

alter table if exists public.orders
  add column if not exists datetrans text,
  add column if not exists timetrans text;

alter table if exists public.carts
  drop constraint if exists carts_datetrans_format_check;
alter table if exists public.carts
  add constraint carts_datetrans_format_check
  check (datetrans is null or datetrans ~ '^\\d{4}-\\d{2}-\\d{2}$');

alter table if exists public.orders
  drop constraint if exists orders_datetrans_format_check;
alter table if exists public.orders
  add constraint orders_datetrans_format_check
  check (datetrans is null or datetrans ~ '^\\d{4}-\\d{2}-\\d{2}$');
