import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_GROUP_CODE = "general";

/**
 * Resolve the price group linked to a customer via customes.group_id.
 * Falls back to the "general" group when no group is linked.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string|null|undefined} groupId customes.group_id value
 * @returns {Promise<{ id: string|null, code: string, name: string } | null>}
 */
async function getCustomerGroup(supabase, groupId) {
  let query = supabase.from("customer_groups").select("id, code, name");
  query = groupId ? query.eq("id", groupId) : query.eq("code", DEFAULT_GROUP_CODE);

  const { data: group, error } = await query.maybeSingle();
  if (error || !group) {
    return groupId ? null : { id: null, code: DEFAULT_GROUP_CODE, name: "" };
  }

  return { id: group.id, code: String(group.code), name: group.name || "" };
}

export async function GET() {
  const auth = await getCustomerAuthContext();
  const customerId = auth.customerId;

  if (!customerId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase =
    auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("customes")
    .select(
      "id, line_user_id, line_msg_user_id, display_name, profile_image_url, address, location, phone, last_login_at, group_id"
    )
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "supabase_fetch_error" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (auth.lineUserId && data.line_user_id && data.line_user_id !== auth.lineUserId) {
    return NextResponse.json({ error: "session_mismatch" }, { status: 403 });
  }

  const customerGroup = await getCustomerGroup(supabase, data.group_id);

  return NextResponse.json({ profile: { ...data, customer_group: customerGroup } });
}
