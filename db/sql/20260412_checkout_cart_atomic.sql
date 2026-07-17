-- Atomic checkout RPC for Supabase/Postgres
-- Apply this SQL in Supabase SQL Editor before using /api/cart/checkout.

create table if not exists public.checkout_idempotency (
  id bigserial primary key,
  customer_id uuid not null,
  idempotency_key text not null,
  status text not null default 'processing',
  order_id uuid null,
  order_no text null,
  items_total numeric null,
  service_fee numeric null,
  shipping_fee numeric null,
  grand_total numeric null,
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkout_idempotency_customer_key_uniq unique (customer_id, idempotency_key)
);

create or replace function public.checkout_cart_atomic(
  p_customer_id uuid,
  p_fulfillment_type text,
  p_scheduled_at timestamptz,
  p_slip_path text,
  p_address text default null,
  p_province text default null,
  p_location_lat double precision default null,
  p_location_lon double precision default null,
  p_order_no text default null,
  p_idempotency_key text default null,
  p_site_code text default 'car_retail',
  p_group_code text default 'general'
)
returns table(
  order_id uuid,
  order_no text,
  items_total numeric,
  service_fee numeric,
  shipping_fee numeric,
  grand_total numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cart_id uuid;
  v_site_id uuid;
  v_group_id uuid;
  v_order_id uuid;
  v_order_no text;
  v_items_total numeric := 0;
  v_total_quantity int := 0;
  v_service_fee numeric := 0;
  v_province_shipping_fee numeric := 0;
  v_extra_fee numeric := 0;
  v_shipping_fee numeric := 0;
  v_grand_total numeric := 0;
  v_updated int := 0;
  v_inserted_idem boolean := false;
  v_idem record;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'missing_idempotency_key';
  end if;

  if p_fulfillment_type not in ('install', 'delivery') then
    raise exception 'invalid_fulfillment_type';
  end if;

  if p_fulfillment_type = 'install' and p_scheduled_at is null then
    raise exception 'invalid_scheduled_at';
  end if;

  if p_slip_path is null or btrim(p_slip_path) = '' then
    raise exception 'invalid_slip_path';
  end if;

  if p_fulfillment_type = 'delivery' then
    if p_address is null or btrim(p_address) = '' then
      raise exception 'invalid_delivery_location';
    end if;
  end if;

  insert into checkout_idempotency (customer_id, idempotency_key, status)
  values (p_customer_id, btrim(p_idempotency_key), 'processing')
  on conflict (customer_id, idempotency_key) do nothing;

  get diagnostics v_updated = row_count;
  v_inserted_idem := v_updated = 1;

  if not v_inserted_idem then
    select *
      into v_idem
    from checkout_idempotency
    where customer_id = p_customer_id
      and idempotency_key = btrim(p_idempotency_key)
    for update;

    if v_idem.status = 'completed' and v_idem.order_id is not null then
      order_id := v_idem.order_id;
      order_no := v_idem.order_no;
      items_total := coalesce(v_idem.items_total, 0);
      service_fee := coalesce(v_idem.service_fee, 0);
      shipping_fee := coalesce(v_idem.shipping_fee, 0);
      grand_total := coalesce(v_idem.grand_total, 0);
      return next;
      return;
    elsif v_idem.status = 'processing' then
      raise exception 'idempotency_in_progress';
    else
      update checkout_idempotency
      set status = 'processing',
          error = null,
          updated_at = now()
      where customer_id = p_customer_id
        and idempotency_key = btrim(p_idempotency_key);
    end if;
  end if;

  select c.id
    into v_cart_id
  from carts c
  where c.customer_id = p_customer_id
    and c.status = 'active'
  order by c.created_at desc nulls last
  limit 1
  for update;

  if v_cart_id is null then
    raise exception 'cart_not_found';
  end if;

  select s.id
    into v_site_id
  from sites s
  where s.code::text = coalesce(nullif(p_site_code, ''), 'car_retail')
  limit 1;

  if v_site_id is null then
    select p.site_id
      into v_site_id
    from cart_items ci
    join skus sku on sku.id = ci.sku_id
    join products p on p.id = sku.product_id
    where ci.cart_id = v_cart_id
      and p.site_id is not null
    limit 1;
  end if;

  if v_site_id is null then
    raise exception 'site_not_configured';
  end if;

  if p_fulfillment_type = 'delivery'
     and exists (
       select 1
       from site_shipping_provinces ssp
       where ssp.site_id = v_site_id
         and ssp.active = true
     )
     and (p_province is null or btrim(p_province) = '') then
    raise exception 'invalid_delivery_province';
  end if;

  select cg.id
    into v_group_id
  from customer_groups cg
  where cg.code::text = coalesce(nullif(p_group_code, ''), 'general')
  limit 1;

  if v_group_id is null then
    raise exception 'group_not_configured';
  end if;

  if exists (
    select 1
    from cart_items ci
    where ci.cart_id = v_cart_id
      and (ci.quantity is null or ci.quantity < 1 or ci.quantity > 99)
  ) then
    raise exception 'invalid_item_quantity';
  end if;

  if exists (
    select 1
    from cart_items ci
    join skus sku on sku.id = ci.sku_id
    join products p on p.id = sku.product_id
    where ci.cart_id = v_cart_id
      and coalesce(p.active, true) = false
  ) then
    raise exception 'inactive_product_in_cart';
  end if;

  if exists (
    select 1
    from cart_items ci
    join skus sku on sku.id = ci.sku_id
    left join inventory inv on inv.sku_id = sku.id
    where ci.cart_id = v_cart_id
      and coalesce(inv.qty_on_hand, 0) < ci.quantity
  ) then
    raise exception 'insufficient_stock';
  end if;

  if exists (
    select 1
    from cart_items ci
    join skus sku on sku.id = ci.sku_id
    left join lateral (
      select pr.price
      from prices pr
      where pr.sku_id = sku.id
        and (v_group_id is null or pr.group_id = v_group_id)
      order by case when pr.group_id = v_group_id then 0 else 1 end
      limit 1
    ) pp on true
    where ci.cart_id = v_cart_id
      and pp.price is null
  ) then
    raise exception 'invalid_item_price';
  end if;

  select coalesce(sum(ci.quantity * pp.price), 0)
    into v_items_total
  from cart_items ci
  join skus sku on sku.id = ci.sku_id
  left join lateral (
    select pr.price
    from prices pr
    where pr.sku_id = sku.id
      and (v_group_id is null or pr.group_id = v_group_id)
    order by case when pr.group_id = v_group_id then 0 else 1 end
    limit 1
  ) pp on true
  where ci.cart_id = v_cart_id;

  if v_items_total <= 0 then
    raise exception 'empty_cart';
  end if;

  select coalesce(sum(ci.quantity), 0)
    into v_total_quantity
  from cart_items ci
  where ci.cart_id = v_cart_id;

  v_service_fee := case when p_fulfillment_type = 'install' then 500 else 0 end;
  if p_fulfillment_type = 'delivery' then
    select ssp.shipping_fee
      into v_province_shipping_fee
    from site_shipping_provinces ssp
    where ssp.site_id = v_site_id
      and ssp.active = true
      and ssp.province = btrim(p_province)
    limit 1;

    select coalesce(sum(sec.extra_fee), 0)
      into v_extra_fee
    from site_extra_fee_configs sec
    where sec.site_id = v_site_id
      and sec.active = true
      and (
        (sec.condition_type = 'min_item_qty' and coalesce(v_total_quantity, 0) < sec.threshold_value)
        or
        (sec.condition_type = 'min_subtotal' and coalesce(v_items_total, 0) < sec.threshold_value)
      );

    v_shipping_fee := coalesce(v_province_shipping_fee, 0) + coalesce(v_extra_fee, 0);
  else
    v_shipping_fee := 0;
  end if;
  v_grand_total := v_items_total + v_service_fee + v_shipping_fee;

  v_order_no := coalesce(
    nullif(btrim(p_order_no), ''),
    'JIB-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6))
  );

  update carts
  set
    status = 'waitingconfirm',
    fulfillment_type = p_fulfillment_type::fulfillment_type,
    scheduled_at = p_scheduled_at,
    service_fee = v_service_fee,
    shipping_fee = v_shipping_fee,
    slip_url = p_slip_path,
    address = p_address,
    location_lat = p_location_lat,
    location_lon = p_location_lon
  where id = v_cart_id
    and status = 'active';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'cart_status_conflict';
  end if;

  insert into orders (
    site_id,
    customer_id,
    order_no,
    status,
    payment_status,
    total_amount
  )
  values (
    v_site_id,
    p_customer_id,
    v_order_no,
    'pending',
    'awaiting_verification',
    v_grand_total
  )
  returning id, orders.order_no into v_order_id, v_order_no;

  begin
    insert into order_items (order_id, sku_id, quantity, unit_price, line_total)
    select
      v_order_id,
      ci.sku_id,
      ci.quantity,
      pp.price,
      ci.quantity * pp.price
    from cart_items ci
    join skus sku on sku.id = ci.sku_id
    left join lateral (
      select pr.price
      from prices pr
      where pr.sku_id = sku.id
        and (v_group_id is null or pr.group_id = v_group_id)
      order by case when pr.group_id = v_group_id then 0 else 1 end
      limit 1
    ) pp on true
    where ci.cart_id = v_cart_id;
  exception
    when undefined_column then
      begin
        insert into order_items (order_id, sku_id, quantity, price, total)
        select
          v_order_id,
          ci.sku_id,
          ci.quantity,
          pp.price,
          ci.quantity * pp.price
        from cart_items ci
        join skus sku on sku.id = ci.sku_id
        left join lateral (
          select pr.price
          from prices pr
          where pr.sku_id = sku.id
            and (v_group_id is null or pr.group_id = v_group_id)
          order by case when pr.group_id = v_group_id then 0 else 1 end
          limit 1
        ) pp on true
        where ci.cart_id = v_cart_id;
      exception
        when undefined_column then
          insert into order_items (order_id, sku_id, quantity)
          select
            v_order_id,
            ci.sku_id,
            ci.quantity
          from cart_items ci
          where ci.cart_id = v_cart_id;
      end;
  end;

  if p_fulfillment_type = 'install' then
    begin
      insert into install_appointments (
        order_id,
        scheduled_at,
        status,
        address,
        location_lat,
        location_lon
      )
      values (
        v_order_id,
        p_scheduled_at,
        'pending',
        p_address,
        p_location_lat,
        p_location_lon
      );
    exception
      when undefined_column then
        begin
          insert into install_appointments (
            order_id,
            scheduled_at,
            status
          )
          values (
            v_order_id,
            p_scheduled_at,
            'pending'
          );
        exception
          when undefined_column then
            insert into install_appointments (
              order_id,
              scheduled_at
            )
            values (
              v_order_id,
              p_scheduled_at
            );
        end;
    end;
  end if;

  update checkout_idempotency
  set
    status = 'completed',
    order_id = v_order_id,
    order_no = v_order_no,
    items_total = v_items_total,
    service_fee = v_service_fee,
    shipping_fee = v_shipping_fee,
    grand_total = v_grand_total,
    error = null,
    updated_at = now()
  where customer_id = p_customer_id
    and idempotency_key = btrim(p_idempotency_key);

  order_id := v_order_id;
  order_no := v_order_no;
  items_total := v_items_total;
  service_fee := v_service_fee;
  shipping_fee := v_shipping_fee;
  grand_total := v_grand_total;
  return next;

exception
  when others then
    if p_customer_id is not null and p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
      update checkout_idempotency
      set
        status = 'failed',
        error = sqlerrm,
        updated_at = now()
      where customer_id = p_customer_id
        and idempotency_key = btrim(p_idempotency_key)
        and status = 'processing';
    end if;
    raise;
end;
$$;

revoke all on function public.checkout_cart_atomic(
  uuid,
  text,
  timestamptz,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.checkout_cart_atomic(
  uuid,
  text,
  timestamptz,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  text,
  text
) to authenticated, service_role;
