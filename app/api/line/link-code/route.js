import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { isTrustedOrigin } from "@/lib/security/request-origin";

const CODE_PREFIX = "JIB";
const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 15;

function randomCode(length = CODE_LENGTH) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${CODE_PREFIX}-${out}`;
}

async function createUniqueCode(supabase, payload, maxAttempts = 8) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = randomCode();
    const { data, error } = await supabase
      .from("line_msg_link_codes")
      .insert({ ...payload, code })
      .select("id, code, status, expires_at")
      .single();

    if (!error && data?.id) return data;

    const duplicate = error?.code === "23505" || String(error?.message || "").includes("duplicate");
    if (!duplicate) {
      throw error || new Error("insert_line_msg_link_code_failed");
    }
  }

  throw new Error("line_msg_link_code_collision");
}

export async function GET() {
  const auth = await getCustomerAuthContext();
  if (!auth?.customerId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: customer } = await supabase
    .from("customes")
    .select("id, line_user_id, line_msg_user_id")
    .eq("id", auth.customerId)
    .maybeSingle();

  const { data: codeRow } = await supabase
    .from("line_msg_link_codes")
    .select("id, code, status, expires_at, linked_at, line_msg_user_id")
    .eq("customer_id", auth.customerId)
    .in("status", ["pending", "linked"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    linked: Boolean(customer?.line_msg_user_id),
    line_msg_user_id: customer?.line_msg_user_id || null,
    code: codeRow || null,
  });
}

export async function POST(request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const auth = await getCustomerAuthContext();
  if (!auth?.customerId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: customer } = await supabase
    .from("customes")
    .select("id, line_user_id, line_msg_user_id")
    .eq("id", auth.customerId)
    .maybeSingle();

  if (!customer?.id) {
    return NextResponse.json({ error: "customer_not_found" }, { status: 404 });
  }

  if (customer.line_msg_user_id) {
    return NextResponse.json({
      ok: true,
      already_linked: true,
      line_msg_user_id: customer.line_msg_user_id,
    });
  }

  await supabase
    .from("line_msg_link_codes")
    .update({ status: "expired" })
    .eq("customer_id", auth.customerId)
    .eq("status", "pending");

  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const row = await createUniqueCode(supabase, {
    customer_id: auth.customerId,
    line_login_user_id: customer.line_user_id,
    status: "pending",
    expires_at: expiresAt,
  });

  return NextResponse.json({
    ok: true,
    code: row,
    expires_in_minutes: CODE_TTL_MINUTES,
  });
}
