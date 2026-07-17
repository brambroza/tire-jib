create table if not exists public.site_shipping_provinces (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites (id) on delete cascade,
  province text not null,
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, province)
);
