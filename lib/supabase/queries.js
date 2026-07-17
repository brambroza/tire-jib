import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatTHB } from "@/lib/utils/format";

async function getSiteAndGroupIds(supabase) {
  const [{ data: sites }, { data: groups }] = await Promise.all([
    supabase.from("sites").select("id, code").eq("code", "car_retail"),
    supabase.from("customer_groups").select("id, code").eq("code", "general"),
  ]);

  return {
    siteId: sites?.[0]?.id ?? null,
    groupId: groups?.[0]?.id ?? null,
  };
}

export async function getSiteAndGroupId(supabase) {
  const [{ data: sites }, { data: groups }] = await Promise.all([
    supabase.from("sites").select("id, code").eq("code", "car_retail"),
    supabase.from("customer_groups").select("id, code").eq("code", "general"),
  ]);

  return {
    siteId: sites?.[0]?.id ?? null,
    groupId: groups?.[0]?.id ?? null,
  };
}

export function getProductBadges(row) {
  const qty = Number(row.qty_on_hand ?? 0);
  const price = Number(row.price ?? 0);
  const oldPrice = Number(row.old_price ?? 0);

  const isNew = row.is_new === true;
  const isHot = row.is_hot === true || Number(row.total_sold ?? 0) >= 20;
  const isPromo = row.is_promotion === true;
  const isSale = oldPrice > price;

  if (isHot) {
    return { label: "🔥 ขายดี", variant: "hot" };
  }

  if (isSale) {
    const percent = Math.round(((oldPrice - price) / oldPrice) * 100);
    return { label: `-${percent}%`, variant: "sale" };
  }

  if (isPromo) {
    return { label: "โปรเด็ด", variant: "promo" };
  }

  if (isNew) {
    return { label: "ใหม่!", variant: "new" };
  }

  if (qty <= 2 && qty > 0) {
    return { label: "ใกล้หมด", variant: "sale" };
  }

  return null;
}

function getProductBadge(row) {
  const qty = Number(row.qty_on_hand ?? 0);
  const price = Number(row.price ?? 0);
  const oldPrice = Number(row.old_price ?? 0);

  const isNew = row.is_new === true;
  const isHot = row.is_hot === true || Number(row.total_sold ?? 0) >= 20;
  const isPromo = row.is_promotion === true;
  const isSale = oldPrice > price;

  if (isHot) {
    return { label: "🔥 ขายดี", variant: "hot" };
  }

  if (isSale) {
    const percent = Math.round(((oldPrice - price) / oldPrice) * 100);
    return { label: `-${percent}%`, variant: "sale" };
  }

  if (isPromo) {
    return { label: "โปรเด็ด", variant: "promo" };
  }

  if (isNew) {
    return { label: "ใหม่!", variant: "new" };
  }

  if (qty <= 2 && qty > 0) {
    return { label: "ใกล้หมด", variant: "sale" };
  }

  return null;
}

function mapSkuRowToProductCardNew(row, groupId) {
  const qty = Number(row.qty_on_hand ?? 0);

  return {
    id: row.id,
    sku_id: row.id,
    skuId: row.id,
    brand: row.brand,
    name: row.product_name,
    size: row.size_label,
    oldPrice: row.old_price
      ? `฿${Number(row.old_price).toLocaleString()}`
      : undefined,
    price: `฿${Number(row.price ?? 0).toLocaleString()}`,
    stock:
      qty > 5
        ? `✓ มีสินค้า ${qty} เส้น`
        : qty > 0
          ? `⚠ เหลือ ${qty} เส้น`
          : "สินค้าหมด",
    stockVariant: qty > 5 ? "ok" : qty > 0 ? "low" : "out",
    badge: getProductBadge(row),
    warranty: "🛡️ รับประกัน 365 วัน ทุกกรณี",
    imageUrl: row.image_url,
  };
}

function mapSkuRowToProductCard(row, groupId) {
  const matchedPrice =
    row?.prices?.find(
      (priceRow) => String(priceRow.group_id) === String(groupId),
    ) || row?.prices?.[0];
  const price = matchedPrice?.price ?? 0;
  const qty = row?.inventory?.qty_on_hand ?? 0;
  const imageRows = Array.isArray(row?.image_url) ? row.image_url : [];
  const imageUrl =
    imageRows
      .map((item) => String(item?.image_url || "").trim())
      .find(Boolean) || "";

  return {
    id: row.id,
    brand: row.product?.brand ?? "",
    name: row.product?.name ?? "",
    size: row.size_label || formatSize(row),
    price: formatTHB(price),
    stock: qty > 0 ? `✓ มีสินค้า ${qty} เส้น` : "⚠ สินค้าหมด",
    stockVariant: qty > 5 ? "ok" : "low",
    badge:
      qty > 0
        ? { label: "พร้อมส่ง", variant: "hot" }
        : { label: "สินค้าหมด", variant: "sale" },
    warranty: "🛡️ รับประกัน 365 วัน ทุกกรณี",
    imageFile: imageUrl || null,
    imageFiles: imageUrl ? [imageUrl] : [],
  };
}

function toNullableNumber(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;

  const num = Number(trimmed);
  return Number.isNaN(num) ? null : num;
}

function mapHeroImagePath(rawPath, siteId) {
  if (!rawPath) return "";
  const trimmed = String(rawPath).trim();
  if (!trimmed) return "";

  const supabaseHost = (() => {
    try {
      return new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      ).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const hostname = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname.replace(/^\/+/, "");
      const publicHeroPrefix = "storage/v1/object/public/hero/";

      // Already a Supabase public URL of bucket `hero` -> keep as-is.
      if (
        supabaseHost &&
        hostname === supabaseHost &&
        pathname.includes(publicHeroPrefix)
      ) {
        return trimmed;
      }

      // For external URLs (including example.com placeholders), use filename/path as key in bucket `hero`.
      if (!pathname) return "";
      const cleaned = pathname.replace(/^hero\/+/, "");
      if (!cleaned) return "";
      return cleaned.includes("/") ? cleaned : `${siteId}/${cleaned}`;
    } catch {
      return "";
    }
  }
  const sanitized = trimmed.replace(/^\/+/, "").replace(/^hero\/+/, "");
  if (!sanitized) return "";
  if (sanitized.includes("/")) return sanitized;
  return `${siteId}/${sanitized}`;
}

function toHeroCandidatePaths(rawPath, siteId) {
  const mapped = mapHeroImagePath(rawPath, siteId);
  if (!mapped) return [];
  if (/^https?:\/\//i.test(mapped)) return [mapped];

  const candidates = new Set([mapped]);
  const normalized = mapped.replace(/^\/+/, "");
  const fileName = normalized.split("/").pop() || "";

  if (fileName) candidates.add(fileName);
  if (fileName && siteId) candidates.add(`${siteId}/${fileName}`);

  if (siteId && normalized.startsWith(`${siteId}/`)) {
    const withoutSite = normalized.slice(siteId.length + 1);
    if (withoutSite) candidates.add(withoutSite);
  }

  return Array.from(candidates).filter(Boolean);
}

async function resolveHeroImageUrl(rawPath, siteId) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const candidates = toHeroCandidatePaths(rawPath, siteId);
  if (!candidates.length) return "";

  for (const key of candidates) {
    if (
      /^https?:\/\//i.test(key) &&
      key.includes("/storage/v1/object/public/hero/")
    ) {
      return key;
    }
    if (/^https?:\/\//i.test(key)) continue;

    const dir = key.includes("/") ? key.slice(0, key.lastIndexOf("/")) : "";
    const name = key.includes("/") ? key.slice(key.lastIndexOf("/") + 1) : key;
    const { data: files } = await admin.storage
      .from("hero")
      .list(dir, { limit: 100 });
    const exists = Array.isArray(files) && files.some((f) => f?.name === name);
    if (!exists) continue;

    const { data } = supabase.storage.from("hero").getPublicUrl(key);
    if (data?.publicUrl) return data.publicUrl;
  }

  return "";
}

export async function fetchSiteHeroAds() {
  const supabase = await createSupabaseServerClient();
  const { siteId } = await getSiteAndGroupIds(supabase);
  if (!siteId) return [];

  const nowIso = new Date().toISOString();
  let query = supabase
    .from("site_hero_ads")
    .select(
      "id, title, message, tag, image_url, cta_label, cta_href, sort_order, starts_at, ends_at, updated_at",
    )
    .eq("site_id", siteId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error("fetchSiteHeroAds error:", error);
    return [];
  }

  const rows = (Array.isArray(data) ? data : []).filter((row) => {
    const startsAt = row?.starts_at
      ? new Date(row.starts_at).toISOString()
      : "";
    const endsAt = row?.ends_at ? new Date(row.ends_at).toISOString() : "";
    if (startsAt && startsAt > nowIso) return false;
    if (endsAt && endsAt < nowIso) return false;
    return true;
  });

  const resolved = await Promise.all(
    rows.map(async (row) => {
      const imageUrl = await resolveHeroImageUrl(row?.image_url, siteId);
      return {
        id: row?.id,
        title: row?.title || "",
        message: row?.message || "",
        tag: row?.tag || "",
        imageUrl,
        ctaLabel: row?.cta_label || "",
        ctaHref: row?.cta_href || "",
      };
    }),
  );

  return resolved.filter((row) => row.imageUrl);
}

export async function fetchFeaturedProducts_backup({
  brand,
  size,
  carModel,
  carMake,
  year,
}) {
  const supabase = await createSupabaseServerClient();
  const { siteId, groupId } = await getSiteAndGroupIds(supabase);

  if (!siteId || !groupId) {
    return [];
  }

  let query = supabase
    .from("skus")
    .select(
      `
     id,
    size_label,
    width_mm,
    aspect_ratio,
    rim_inch,
    product:products!inner(
      id,
      brand,
      name,
      car_year_from,
      car_year_to,
      site_id,
      product_car_models!inner(
        car_brand:car_brands!inner(
          id,
          name
        ),
        car_model:car_models!inner(
          id,
          name
        )
      )
    ),
    inventory:inventory(
      qty_on_hand
    ),
    sku_image_embeddings(
      image_url
    ),
    prices:prices!inner(
      price,
      group_id
    )
    `,
    )
    .eq("product.site_id", siteId)
    .eq("prices.group_id", groupId);

  console.log("siteId", siteId);
  console.log("groupId", groupId);

  if (brand) {
    query = query.ilike("product.brand", `%${brand}%`);
  }

  if (carMake) {
    query = query.ilike(
      "product.product_car_models.car_brand.name",
      `%${carMake}%`,
    );
  }

  if (carModel) {
    query = query.ilike(
      "product.product_car_models.car_model.name",
      `%${carModel}%`,
    );
  }

  if (year) {
    const yearNum = Number(year);
    if (!Number.isNaN(yearNum)) {
      query = query
        .lte("product.car_year_from", yearNum)
        .gte("product.car_year_to", yearNum);
    }
  }

  if (size) {
    const [width, rest] = size.split("/");
    const [aspect, rimPart] = rest ? rest.split("R") : [];
    if (width) {
      query = query.eq("width_mm", Number(width));
    }
    if (aspect) {
      query = query.eq("aspect_ratio", Number(aspect));
    }
    if (rimPart) {
      query = query.eq("rim_inch", Number(rimPart));
    }
  }

  const { data } = await query;

  return data?.map((row) => mapSkuRowToProductCard(row, groupId)) ?? [];
}

export async function fetchFeaturedProducts({
  brand,
  size,
  carModel,
  carMake,
  year,
}) {
  const supabase = await createSupabaseServerClient();
  const { siteId, groupId } = await getSiteAndGroupIds(supabase);

  if (!siteId || !groupId) return [];

  const [width, rest] = size ? String(size).split("/") : [];
  const [aspect, rimPart] = rest ? rest.split("R") : [];

  const { data, error } = await supabase.rpc("get_featured_products", {
    p_site_id: siteId,
    p_group_id: groupId,
    p_brand: String(brand || "").trim() || null,
    p_car_make: String(carMake || "").trim() || null,
    p_car_model: String(carModel || "").trim() || null,
    p_year: toNullableNumber(year),
    p_width_mm: toNullableNumber(width),
    p_aspect_ratio: toNullableNumber(aspect),
    p_rim_inch: toNullableNumber(rimPart),
  });

  if (error) {
    console.error("fetchFeaturedProducts error:", error);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];

  const uniqueRows = Array.from(
    new Map(rows.map((row) => [String(row?.id || ""), row])).values(),
  ).filter((row) => String(row?.id || "").trim());

  return (
    uniqueRows?.map((row) => mapSkuRowToProductCardNew(row, groupId)) ?? []
  );

  /* return uniqueRows.map((row) => ({
    id: row.id,
    skuId: row.id,
    name: row.product_name,
    brand: row.brand,
    sizeLabel: row.size_label,
    widthMm: row.width_mm,
    aspectRatio: row.aspect_ratio,
    rimInch: row.rim_inch,
    price: row.price,
    qtyOnHand: row.qty_on_hand ?? 0,
    imageUrl: row.image_url,
    carBrandName: row.car_brand_name,
    carModelName: row.car_model_name,
    carYearFrom: row.car_year_from,
    carYearTo: row.car_year_to,
    groupId: row.group_id,
  })); */
}

export async function fetchProductsBySkuIds(skuIds = []) {
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(skuIds) ? skuIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    ),
  );
  if (!normalizedIds.length) return [];

  const supabase = await createSupabaseServerClient();
  const { siteId, groupId } = await getSiteAndGroupIds(supabase);
  if (!siteId || !groupId) return [];

  const { data, error } = await supabase
    .from("skus")
    .select(
      `
      id,
      size_label,
      width_mm,
      aspect_ratio,
      rim_inch,
      product:products!inner(
        id,
        brand,
        name,
        site_id,
        active
      ),
      inventory:inventory(
        qty_on_hand
      ),
      sku_image_embeddings(
        image_url
      ),
      prices:prices!inner(
        price,
        group_id
      )
      `,
    )
    .in("id", normalizedIds)
    .eq("product.site_id", siteId)
    .eq("product.active", true)
    .eq("prices.group_id", groupId);

  if (error || !Array.isArray(data)) {
    if (error) console.error("fetchProductsBySkuIds error:", error);
    return [];
  }

  const byId = new Map(
    data.map((row) => [String(row.id), mapSkuRowToProductCard(row, groupId)]),
  );
  return normalizedIds.map((id) => byId.get(id)).filter(Boolean);
}

async function fetchActiveCartWithClient(supabase, userId) {
  const { data: customer } = await supabase
    .from("customes")
    .select("id, address")
    .eq("id", userId)
    .maybeSingle();

  const { data: cart, error: cartError } = await supabase
    .from("carts")
    .select(
      "id, status, fulfillment_type, scheduled_at, service_fee, shipping_fee, address, location_lat, location_lon, slip_url, payment_option",
    )
    .eq("customer_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (cartError) {
    console.error("fetch cart error:", cartError);
    throw cartError;
  }

  if (!cart) {
    return { cart: null, items: [], total: 0, customer: customer || null };
  }

  const { groupId } = await getSiteAndGroupIds(supabase);

  let itemsQuery = supabase
    .from("cart_items")
    .select(
      `
      id,
      quantity,
      sku:skus(
        id,
        size_label,
        width_mm,
        aspect_ratio,
        rim_inch,
        product:products(
          brand,
          name
        ),
        prices:prices(
          price,
          group_id
        )
      )
    `,
    )
    .eq("cart_id", cart.id);

  if (groupId) {
    itemsQuery = itemsQuery.eq("sku.prices.group_id", groupId);
  }

  const { data: items, error: itemsError } = await itemsQuery;

  if (itemsError) {
    throw itemsError;
  }

  const normalizedItems =
    items?.map((row) => {
      const matchedPrice =
        row.sku?.prices?.find((p) => String(p.group_id) === String(groupId)) ||
        row.sku?.prices?.[0];

      const unitPrice = matchedPrice?.price ?? 0;
      const lineTotal = unitPrice * row.quantity;

      return {
        id: row.id,
        skuId: row.sku?.id,
        name: `${row.sku?.product?.brand ?? ""} ${row.sku?.product?.name ?? ""}`.trim(),
        size: row.sku?.size_label || formatSize(row.sku),
        quantity: row.quantity,
        unitPrice,
        lineTotal,
      };
    }) ?? [];

  const total = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);

  return { cart, items: normalizedItems, total, customer: customer || null };
}

export async function fetchActiveCart(userId) {
  const supabase = await createSupabaseServerClient();
  return fetchActiveCartWithClient(supabase, userId);
}

export async function fetchActiveCartWithAdmin(supabase, userId) {
  return fetchActiveCartWithClient(supabase, userId);
}

function formatSize(row) {
  if (!row) return "";
  if (row.width_mm && row.aspect_ratio && row.rim_inch) {
    return `${row.width_mm}/${row.aspect_ratio}R${row.rim_inch}`;
  }
  return row.size_label ?? "";
}

export async function fetchAppointments(userId) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("install_appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      vehicle_plate,
      notes,
      order:orders!inner(order_no, customer_id)
    `,
    )
    .eq("order.customer_id", userId)
    .order("scheduled_at", { ascending: true });

  return data ?? [];
}

export async function fetchPromotions() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("promotions")
    .select(
      "id,title,message,image_url,priority,active,start_at,end_at,is_banner",
    )
    .eq("active", true)
    /*   .eq("is_banner" ,is_banner) */
    .or(`start_at.is.null,start_at.lte.${now}`)
    .or(`end_at.is.null,end_at.gte.${now}`)
    .order("priority", { ascending: false })
    .limit(10);

  const promotions = Array.isArray(data) ? data : [];
  const bucket = admin.storage.from("promotions");
  const imageMap = {};

  await Promise.all(
    promotions.map(async (item) => {
      const folder = String(item?.id || "").trim();
      if (!folder) return;

      const { data: files, error } = await bucket.list(folder, {
        limit: 1,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error || !files?.length) {
        if (error) {
          console.error("fetchPromotions storage list error", {
            folder,
            error: error.message,
          });
        }
        return;
      }

      const path = `${folder}/${files[0].name}`;
      const { data: signedData, error: signedError } =
        await bucket.createSignedUrl(path, 60 * 60);
      if (signedError) {
        console.error("fetchPromotions signed url error", {
          path,
          error: signedError.message,
        });
      }
      const signedUrl = signedData?.signedUrl || "";
      const publicUrl = bucket.getPublicUrl(path).data?.publicUrl || "";
      if (signedUrl || publicUrl) {
        imageMap[folder] = signedUrl || publicUrl;
      }
    }),
  );

  return (
    promotions.map((item) => ({
      id: item.id,
      text: item.title,
      highlight: item.message,
      imageUrl: imageMap[String(item.id)] || item.image_url || null,
      is_banner: item.is_banner === true,
    })) ?? []
  );
}

export async function fetchProductBrands({ limit = 24 } = {}) {
  const supabase = await createSupabaseServerClient();
  const { siteId } = await getSiteAndGroupIds(supabase);

  let query = supabase
    .from("products")
    .select("brand")
    .eq("active", true)
    .not("brand", "is", null)
    .order("brand", { ascending: true });

  if (siteId) {
    query = query.eq("site_id", siteId);
  }

  const { data, error } = await query.limit(limit * 3);
  if (error) {
    console.error("fetch brands error:", error);
    return [];
  }

  const seen = new Set();
  const uniqueBrands = [];
  (data || []).forEach((row) => {
    const brand = typeof row?.brand === "string" ? row.brand.trim() : "";
    if (!brand) return;
    const key = brand.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    uniqueBrands.push(brand.toUpperCase());
  });

  return uniqueBrands.slice(0, limit);
}
