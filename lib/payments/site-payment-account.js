import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Site whose bank account and shipping config the checkout uses. */
export const CHECKOUT_SITE_ID = "1df52c4e-2178-400f-9cd6-cb38cf8549a7";

/**
 * Map a stored QR path to a storage path inside the `websitebank` bucket.
 * @param {string} rawPath
 * @param {string} siteId
 * @returns {string} storage path, absolute URL, or empty string
 */
function mapQrCodePath(rawPath, siteId) {
  if (!rawPath) return "";
  const trimmed = String(rawPath).trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const sanitized = trimmed.replace(/^\/+/, "").replace(/^websitebank\/+/, "");
  if (!sanitized) return "";
  if (sanitized.includes("/")) return sanitized;
  return `${siteId}/${sanitized}`;
}

/**
 * Resolve a public URL for the site's payment QR image.
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} siteId
 * @param {string} qrCodeUrl
 * @returns {Promise<string>}
 */
async function resolveSiteQrImageUrl(admin, siteId, qrCodeUrl) {
  const mappedPath = mapQrCodePath(qrCodeUrl, siteId);
  if (/^https?:\/\//i.test(mappedPath)) return mappedPath;

  if (mappedPath) {
    const { data } = admin.storage.from("websitebank").getPublicUrl(mappedPath);
    if (data?.publicUrl) return data.publicUrl;
  }

  const { data: files } = await admin.storage.from("websitebank").list(siteId, {
    limit: 1,
    sortBy: { column: "name", order: "asc" },
  });
  const file = files?.[0];
  if (!file?.name) return "";
  const { data } = admin.storage.from("websitebank").getPublicUrl(`${siteId}/${file.name}`);
  return data?.publicUrl || "";
}

/**
 * Fetch the bank account customers should transfer to for a site.
 * Returns null when the site has no payment account configured.
 *
 * @param {string} [siteId]
 * @returns {Promise<{accountName: string, accountNumber: string, bankName: string, qrImageUrl: string} | null>}
 */
export async function fetchSitePaymentAccount(siteId = CHECKOUT_SITE_ID) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("site_payment_accounts")
    .select("account_name, account_number, bank_name, qr_code_url")
    .eq("site_id", siteId)
    .maybeSingle();

  if (error) {
    console.error("fetchSitePaymentAccount error:", error);
    return null;
  }
  if (!data) return null;

  const qrImageUrl = await resolveSiteQrImageUrl(admin, siteId, data.qr_code_url);
  return {
    accountName: data.account_name || "",
    accountNumber: data.account_number || "",
    bankName: data.bank_name || "",
    qrImageUrl,
  };
}
