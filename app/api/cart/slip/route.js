import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isTrustedOrigin } from "@/lib/security/request-origin";

const MAX_SLIP_SIZE_BYTES = 5 * 1024 * 1024;
const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json(
        { error: "forbidden_origin", detail: "origin/referer ไม่อยู่ในรายการที่อนุญาต" },
        { status: 403 }
      );
    }

    const auth = await getCustomerAuthContext();
    const customerId = auth.customerId;

    if (!customerId) {
      return NextResponse.json(
        { error: "unauthorized", detail: "กรุณาเข้าสู่ระบบก่อนอัปโหลดสลิป" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("slip");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }
    if (!MIME_TO_EXT[file.type]) {
      return NextResponse.json(
        {
          error: "invalid_file_type",
          detail: `รองรับเฉพาะ ${Object.keys(MIME_TO_EXT).join(", ")} (received: ${file.type || "unknown"})`,
        },
        { status: 400 }
      );
    }
    if (file.size > MAX_SLIP_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: "file_too_large",
          detail: `ไฟล์ใหญ่เกิน ${MAX_SLIP_SIZE_BYTES} bytes`,
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = MIME_TO_EXT[file.type];
    const filename = `slip-${Date.now()}-${Math.random().toString(16).slice(2, 10)}.${ext}`;
    const path = `${customerId}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("slips")
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Slip upload error", uploadError);
      return NextResponse.json(
        {
          error: "upload_failed",
          detail: uploadError.message || "upload_failed",
        },
        { status: 500 }
      );
    }

    const { data: signedData, error: signedUrlError } = await supabase.storage
      .from("slips")
      .createSignedUrl(path, 60 * 60);
    if (signedUrlError) {
      return NextResponse.json(
        {
          error: "signed_url_failed",
          detail: signedUrlError.message || "signed_url_failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ path, preview_url: signedData.signedUrl });
  } catch (error) {
    console.error("Slip upload error", error);
    return NextResponse.json(
      {
        error: "unexpected_error",
        detail: error?.message || "unexpected_error",
      },
      { status: 500 }
    );
  }
}
