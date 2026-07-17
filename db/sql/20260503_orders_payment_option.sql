alter table if exists public.orders
  add column if not exists payment_option text not null default 'full',
  add column if not exists deposit_amount numeric(12,2) not null default 0,
  add column if not exists pay_now_amount numeric(12,2) not null default 0;

alter table if exists public.orders
  drop constraint if exists orders_payment_option_check;

alter table if exists public.orders
  add constraint orders_payment_option_check
  check (payment_option in ('full', 'deposit'));

alter table if exists public.orders
  drop constraint if exists orders_deposit_amount_check;

alter table if exists public.orders
  add constraint orders_deposit_amount_check
  check (deposit_amount >= 0);

alter table if exists public.orders
  drop constraint if exists orders_pay_now_amount_check;

alter table if exists public.orders
  add constraint orders_pay_now_amount_check
  check (pay_now_amount >= 0);
