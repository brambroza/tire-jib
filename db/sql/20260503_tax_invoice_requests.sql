create table if not exists public.tax_invoice_requests (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null,
  request_type text not null default 'personal' check (request_type in ('personal', 'company')),
  tax_payer_name text not null,
  tax_id text not null,
  branch_no text null,
  address text not null,
  email text null,
  phone text null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'approved', 'rejected', 'cancelled')),
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_invoice_requests_order_customer_uniq unique (order_id, customer_id)
);

create index if not exists tax_invoice_requests_customer_idx
  on public.tax_invoice_requests (customer_id, created_at desc);

create index if not exists tax_invoice_requests_status_idx
  on public.tax_invoice_requests (status, created_at desc);
