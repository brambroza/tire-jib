import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isTrustedOrigin } from "@/lib/security/request-origin";

async function tryAddToCartAtomic(supabase, customerId, skuId, quantity) {
  const { data, error } = await supabase.rpc("add_to_cart_atomic", {
    p_customer_id: customerId,
    p_sku_id: skuId,
    p_quantity: quantity,
  });

  if (!error) {
    return { ok: true, data };
  }

  const message = String(error.message || "").toLowerCase();
  const missingFunction =
    message.includes("add_to_cart_atomic") &&
    (message.includes("function") || message.includes("schema cache"));

  if (missingFunction) {
    return { ok: false, fallback: true };
  }

  return { ok: false, fallback: false, error };
}

export async function POST(request) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const skuId = payload?.sku_id;
    const quantity = Number(payload?.quantity ?? 1);

    if (!skuId || !Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const auth = await getCustomerAuthContext();
    const customerId = auth.customerId;

    if (!customerId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase =
      auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();

    const atomic = await tryAddToCartAtomic(supabase, customerId, skuId, quantity);
    if (atomic.ok) {
      return NextResponse.json({ ok: true });
    }
    if (!atomic.fallback) {
      const detail = String(atomic.error?.message || "cart_add_failed");
      if (detail.includes("unauthorized_customer")) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      if (detail.includes("invalid_quantity")) {
        return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
      }
      if (detail.includes("sku_not_available")) {
        return NextResponse.json({ error: "sku_not_available" }, { status: 404 });
      }
      if (detail.includes("out_of_stock")) {
        return NextResponse.json({ error: "out_of_stock" }, { status: 400 });
      }
      if (detail.includes("quantity_limit_exceeded")) {
        return NextResponse.json({ error: "quantity_limit_exceeded" }, { status: 400 });
      }
      if (detail.includes("insufficient_stock")) {
        return NextResponse.json({ error: "insufficient_stock" }, { status: 400 });
      }
      return NextResponse.json({ error: "cart_add_failed", detail }, { status: 400 });
    }

    const { data: skuData, error: skuError } = await supabase
      .from("skus")
      .select(
        `
        id,
        product:products!inner(
          id,
          active
        ),
        inventory:inventory(
          qty_on_hand
        )
      `
      )
      .eq("id", skuId)
      .maybeSingle();

    if (skuError) {
      console.error("SKU fetch failed", skuError);
      return NextResponse.json(
        { error: "sku_lookup_failed", detail: skuError.message },
        { status: 500 }
      );
    }

    const isActiveSku = Boolean(skuData?.id) && skuData?.product?.active !== false;
    if (!isActiveSku) {
      return NextResponse.json({ error: "sku_not_available" }, { status: 404 });
    }

    const qtyOnHand = Number(skuData?.inventory?.qty_on_hand ?? 0);
    if (qtyOnHand <= 0) {
      return NextResponse.json({ error: "out_of_stock" }, { status: 400 });
    }

    const { data: cart } = await supabase
      .from("carts")
      .select("id")
      .eq("customer_id", customerId)
      .eq("status", "active")
      .maybeSingle();

    let cartId = cart?.id;
    if (!cartId) {
      const { data: newCart, error: cartError } = await supabase
        .from("carts")
        .insert({ customer_id: customerId, status: "active" })
        .select("id")
        .single();
      if (cartError) {
        console.error("Cart create failed", cartError);
        return NextResponse.json(
          { error: "cart_create_failed", detail: cartError.message },
          { status: 500 }
        );
      }
      cartId = newCart.id;
    }

    const { data: existingItem } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("sku_id", skuId)
      .maybeSingle();

    if (existingItem) {
      const nextQty = existingItem.quantity + quantity;
      if (nextQty > 99) {
        return NextResponse.json({ error: "quantity_limit_exceeded" }, { status: 400 });
      }
      if (nextQty > qtyOnHand) {
        return NextResponse.json(
          { error: "insufficient_stock", available_qty: qtyOnHand },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabase
        .from("cart_items")
        .update({ quantity: nextQty })
        .eq("id", existingItem.id);
      if (updateError) {
        console.error("Cart update failed", updateError);
        return NextResponse.json(
          { error: "cart_update_failed", detail: updateError.message },
          { status: 500 }
        );
      }
    } else {
      if (quantity > qtyOnHand) {
        return NextResponse.json(
          { error: "insufficient_stock", available_qty: qtyOnHand },
          { status: 400 }
        );
      }

      const { error: insertError } = await supabase
        .from("cart_items")
        .insert({ cart_id: cartId, sku_id: skuId, quantity });
      if (insertError) {
        console.error("Cart insert failed", insertError);
        return NextResponse.json(
          { error: "cart_insert_failed", detail: insertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Add cart error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
