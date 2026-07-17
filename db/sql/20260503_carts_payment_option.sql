alter table if exists public.carts
  add column if not exists payment_option text not null default 'full';

alter table if exists public.carts
  drop constraint if exists carts_payment_option_check;

alter table if exists public.carts
  add constraint carts_payment_option_check
  check (payment_option in ('full', 'deposit'));
