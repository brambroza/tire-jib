-- Move featured product filtering into the RPC query.
-- Apply in Supabase SQL Editor.

create or replace function public.get_featured_products(
  p_site_id uuid,
  p_group_id uuid,
  p_brand text default null,
  p_car_make text default null,
  p_car_model text default null,
  p_year integer default null,
  p_width_mm integer default null,
  p_aspect_ratio integer default null,
  p_rim_inch integer default null
)
returns table (
  id uuid,
  size_label text,
  width_mm integer,
  aspect_ratio integer,
  rim_inch integer,
  product_id uuid,
  brand text,
  product_name text,
  car_year_from integer,
  car_year_to integer,
  site_id uuid,
  is_hot boolean,
  is_new boolean,
  is_promotion boolean,
  total_sold integer,
  car_brand_id uuid,
  car_brand_name text,
  car_model_id uuid,
  car_model_name text,
  qty_on_hand integer,
  image_url text,
  price numeric,
  old_price numeric,
  group_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.size_label,
    s.width_mm,
    s.aspect_ratio,
    s.rim_inch,

    p.id as product_id,
    p.brand,
    p.name as product_name,
    p.car_year_from,
    p.car_year_to,
    p.site_id,

    p.is_hot,
    p.is_new,
    p.is_promotion,
    p.total_sold,

    cb.id as car_brand_id,
    cb.name as car_brand_name,

    cm.id as car_model_id,
    cm.name as car_model_name,

    i.qty_on_hand,
    sie.image_url,

    pr.price,
    pr.old_price,
    pr.group_id

  from public.skus s
  inner join public.products p
    on p.id = s.product_id

  left join public.product_car_models pcm
    on pcm.product_id = p.id

  left join public.car_brands cb
    on cb.id = pcm.car_brand_id

  left join public.car_models cm
    on cm.id = pcm.car_model_id

  left join public.inventory i
    on i.sku_id = s.id

  left join public.sku_image_embeddings sie
    on sie.sku_id = s.id

  left join public.prices pr
    on pr.sku_id = s.id

  where p.site_id = p_site_id
    and pr.group_id = p_group_id
    and (nullif(trim(p_brand), '') is null or p.brand ilike '%' || trim(p_brand) || '%')
    and (nullif(trim(p_car_make), '') is null or cb.name ilike '%' || trim(p_car_make) || '%')
    and (nullif(trim(p_car_model), '') is null or cm.name ilike '%' || trim(p_car_model) || '%')
    and (p_year is null or (p.car_year_from <= p_year and p.car_year_to >= p_year))
    and (p_width_mm is null or s.width_mm = p_width_mm)
    and (p_aspect_ratio is null or s.aspect_ratio = p_aspect_ratio)
    and (p_rim_inch is null or s.rim_inch = p_rim_inch);
$$;

revoke all on function public.get_featured_products(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer
) from public;

grant execute on function public.get_featured_products(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer
) to authenticated, anon, service_role;
