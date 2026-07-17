import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isInternalApiAuthorized } from "@/lib/security/internal-api";
import {
  createImageEmbeddingFromFile,
  toVectorLiteral,
} from "@/lib/search/image-embedding";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

export async function POST(request) {
  try {
    if (!isInternalApiAuthorized(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const skuId = String(formData.get("sku_id") || "").trim();
    const imageUrl = String(formData.get("image_url") || "").trim();
    const file = formData.get("image");

    if (!isUuid(skuId)) {
      return NextResponse.json({ error: "invalid_sku_id" }, { status: 400 });
    }

    let sourceFile = null;
    let sourceImageUrl = imageUrl;

    if (file && typeof file !== "string") {
      sourceFile = file;
    } else if (imageUrl) {
      const remote = await fetch(imageUrl);
      if (!remote.ok) {
        return NextResponse.json(
          { error: "fetch_image_url_failed" },
          { status: 400 },
        );
      }
      const blob = await remote.blob();
      sourceFile = new Blob([blob], { type: blob.type || "image/jpeg" });
    } else {
      return NextResponse.json(
        { error: "missing_image_or_image_url" },
        { status: 400 },
      );
    }

    const embedding = await createImageEmbeddingFromFile(sourceFile);
    const vectorLiteral = toVectorLiteral(embedding);

    const supabase = createSupabaseAdminClient();
    const upsertPayload = {
      sku_id: skuId,
      image_url: sourceImageUrl || null,
      embedding: vectorLiteral,
      source: "manual",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("sku_image_embeddings")
      .upsert(upsertPayload, { onConflict: "sku_id,image_url" })
      .select("id, sku_id, image_url")
      .maybeSingle();

    if (error) {
      console.error("upsert_embedding_failed", error);
      return NextResponse.json(
        { error: "upsert_embedding_failed", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, row: data || null });
  } catch (error) {
    console.error("index_embedding_failed", error);
    return NextResponse.json(
      {
        error: "index_embedding_failed",
        detail: String(error?.message || ""),
      },
      { status: 400 },
    );
  }
}
