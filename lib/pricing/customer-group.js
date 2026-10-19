import { cache } from "react";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildPriceGroupIds, pickPriceRow } from "./price-helpers.mjs";

export { buildPriceGroupIds, pickPriceRow };

/** Code of the default price group used for guests and as a price fallback. */
export const GENERAL_GROUP_CODE = "general";

/**
 * Fetch the "general" customer group.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @returns {Promise<{ id: string, code: string, name: string } | null>}
 */
export async function fetchGeneralGroup(supabase) {
  const { data } = await supabase
    .from("customer_groups")
    .select("id, code, name")
    .eq("code", GENERAL_GROUP_CODE)
    .maybeSingle();

  if (!data?.id) return null;
  return { id: data.id, code: String(data.code), name: String(data.name || "") };
}

/**
 * Resolve which price group applies to the current request.
 * Guests use the general group. Logged-in customers use customes.group_id,
 * falling back to the general group when it is missing or unknown.
 * Cached per request so pages can call it from several queries.
 *
 * @returns {Promise<{
 *   groupId: string|null,
 *   groupCode: string,
 *   groupName: string,
 *   generalGroupId: string|null,
 *   generalGroupName: string,
 *   isGeneral: boolean,
 *   customerId: string|null,
 * }>}
 */
export const resolveCustomerPricingGroup = cache(async () => {
  const auth = await getCustomerAuthContext();
  const general = await fetchGeneralGroup(auth.supabase);

  const generalContext = {
    groupId: general?.id ?? null,
    groupCode: general?.code ?? GENERAL_GROUP_CODE,
    groupName: general?.name ?? "",
    generalGroupId: general?.id ?? null,
    generalGroupName: general?.name ?? "",
    isGeneral: true,
    customerId: auth.customerId ?? null,
  };

  if (!auth.customerId) return generalContext;

  let client = auth.supabase;
  if (auth.mode !== "supabase") {
    try {
      client = createSupabaseAdminClient();
    } catch {
      return generalContext;
    }
  }

  const { data: customer } = await client
    .from("customes")
    .select("group_id")
    .eq("id", auth.customerId)
    .maybeSingle();

  const customerGroupId = customer?.group_id ? String(customer.group_id) : "";
  if (!customerGroupId || customerGroupId === String(general?.id)) {
    return generalContext;
  }

  const { data: group } = await client
    .from("customer_groups")
    .select("id, code, name")
    .eq("id", customerGroupId)
    .maybeSingle();

  if (!group?.id) return generalContext;

  return {
    groupId: group.id,
    groupCode: String(group.code),
    groupName: String(group.name || ""),
    generalGroupId: general?.id ?? null,
    generalGroupName: general?.name ?? "",
    isGeneral: false,
    customerId: auth.customerId,
  };
});
