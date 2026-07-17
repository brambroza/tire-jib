create or replace function public.add_to_cart_atomic(
  p_customer_id uuid,
  p_sku_id uuid,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quantity integer := coalesce(p_quantity, 1);
  v_cart_id uuid;
  v_product_active boolean := false;
  v_qty_on_hand integer := 0;
  v_existing_item_id uuid;
  v_existing_qty integer := 0;
  v_next_qty integer := 0;
begin
  if p_customer_id is null then
    raise exception 'unauthorized_customer';
  end if;

  if p_sku_id is null then
    raise exception 'invalid_sku_id';
  end if;

  if v_quantity < 1 or v_quantity > 99 then
    raise exception 'invalid_quantity';
  end if;

  select
    coalesce(p.active, true) as product_active,
    coalesce(inv.qty_on_hand, 0) as qty_on_hand
  into v_product_active, v_qty_on_hand
  from skus sku
  join products p on p.id = sku.product_id
  left join inventory inv on inv.sku_id = sku.id
  where sku.id = p_sku_id
  limit 1;

  if not found or v_product_active = false then
    raise exception 'sku_not_available';
  end if;

  if v_qty_on_hand <= 0 then
    raise exception 'out_of_stock';
  end if;

  select id
    into v_cart_id
  from carts
  where customer_id = p_customer_id
    and status = 'active'
  order by created_at desc nulls last
  limit 1
  for update;

  if v_cart_id is null then
    insert into carts (customer_id, status)
    values (p_customer_id, 'active')
    returning id into v_cart_id;
  end if;

  select id, quantity
    into v_existing_item_id, v_existing_qty
  from cart_items
  where cart_id = v_cart_id
    and sku_id = p_sku_id
  limit 1
  for update;

  if v_existing_item_id is null then
    if v_quantity > v_qty_on_hand then
      raise exception 'insufficient_stock';
    end if;

    insert into cart_items (cart_id, sku_id, quantity)
    values (v_cart_id, p_sku_id, v_quantity);

    return jsonb_build_object(
      'ok', true,
      'cart_id', v_cart_id,
      'quantity', v_quantity
    );
  end if;

  v_next_qty := v_existing_qty + v_quantity;

  if v_next_qty > 99 then
    raise exception 'quantity_limit_exceeded';
  end if;

  if v_next_qty > v_qty_on_hand then
    raise exception 'insufficient_stock';
  end if;

  update cart_items
  set quantity = v_next_qty
  where id = v_existing_item_id;

  return jsonb_build_object(
    'ok', true,
    'cart_id', v_cart_id,
    'quantity', v_next_qty
  );
end;
$$;

revoke all on function public.add_to_cart_atomic(uuid, uuid, integer) from public;
grant execute on function public.add_to_cart_atomic(uuid, uuid, integer)
  to authenticated, service_role;
