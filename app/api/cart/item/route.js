import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isTrustedOrigin } from "@/lib/security/request-origin";

function parseItemId(payload) {
  const itemId = payload?.item_id;
  return typeof itemId === "string" ? itemId.trim() : "";
}

async function getAuthorizedCartItem(supabase, customerId, itemId) {
  const { data, error } = await supabase
    .from("cart_items")
    .select(
      `
      id,
      quantity,
      cart_id,
      cart:carts!inner(
        customer_id,
        status
      )
    `
    )
    .eq("id", itemId)
    .eq("cart.customer_id", customerId)
    .eq("cart.status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

export async function PATCH(request) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
    }

    const auth = await getCustomerAuthContext();
    const customerId = auth.customerId;
    if (!customerId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    const itemId = parseItemId(payload);
    const quantity = Number(payload?.quantity);
    if (!itemId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const supabase =
      auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();
    const cartItem = await getAuthorizedCartItem(supabase, customerId, itemId);
    if (!cartItem) {
      return NextResponse.json({ error: "item_not_found" }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("cart_items")
      .update({ quantity })
      .eq("id", itemId);

    if (updateError) {
      return NextResponse.json(
        { error: "update_failed", detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, item_id: itemId, quantity });
  } catch (error) {
    console.error("Update cart item error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
    }

    const auth = await getCustomerAuthContext();
    const customerId = auth.customerId;
    if (!customerId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    const itemId = parseItemId(payload);
    if (!itemId) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const supabase =
      auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();
    const cartItem = await getAuthorizedCartItem(supabase, customerId, itemId);
    if (!cartItem) {
      return NextResponse.json({ error: "item_not_found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("cart_items")
      .delete()
      .eq("id", itemId);

    if (deleteError) {
      return NextResponse.json(
        { error: "delete_failed", detail: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, item_id: itemId });
  } catch (error) {
    console.error("Delete cart item error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
