import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createImageEmbeddingFromFile, toVectorLiteral } from "@/lib/search/image-embedding";

function normalizeMatchCount(value) {
  const count = Number(value || 12);
  if (!Number.isFinite(count)) return 12;
  return Math.max(1, Math.min(36, Math.trunc(count)));
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    const matchCount = normalizeMatchCount(formData.get("match_count"));

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "missing_image" }, { status: 400 });
    }

    const embedding = await createImageEmbeddingFromFile(file);
    const vectorLiteral = toVectorLiteral(embedding);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("search_similar_skus_by_embedding", {
      p_embedding: vectorLiteral,
      p_match_count: matchCount,
      p_site_code: "car_retail",
      p_group_code: "general",
    });

    if (error) {
      console.error("image_search_rpc_failed", error);
      return NextResponse.json(
        { error: "image_search_rpc_failed", detail: error.message },
        { status: 500 }
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const skuIds = rows.map((row) => row?.sku_id).filter(Boolean);

    return NextResponse.json({
      ok: true,
      sku_ids: skuIds,
      matches: rows.map((row) => ({
        sku_id: row.sku_id,
        similarity: Number(row.similarity || 0),
      })),
    });
  } catch (error) {
    console.error("image_search_failed", error);
    const message = String(error?.message || "image_search_failed");
    const parts = message.split(":");
    const source = parts[0] || "image_search_failed";
    return NextResponse.json(
      {
        error: "image_search_failed",
        source,
        detail: message,
      },
      { status: 400 }
    );
  }
}
