import { NextResponse } from "next/server";
import { getCustomerAuthContext } from "@/lib/auth/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isTrustedOrigin } from "@/lib/security/request-origin";

const TAX_ID_PATTERN = /^\d{13}$/;

function normalizeString(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitizeTaxPayload(payload) {
  const requestType = normalizeString(payload?.request_type, 20) === "company" ? "company" : "personal";
  const taxPayerName = normalizeString(payload?.tax_payer_name, 200);
  const taxId = normalizeString(payload?.tax_id, 20).replace(/\D/g, "");
  const branchNo = normalizeString(payload?.branch_no, 20);
  const address = normalizeString(payload?.address, 1000);
  const email = normalizeString(payload?.email, 200).toLowerCase();
  const phone = normalizeString(payload?.phone, 30).replace(/[^\d+]/g, "");

  return {
    requestType,
    taxPayerName,
    taxId,
    branchNo,
    address,
    email,
    phone,
  };
}

export async function GET(_request, { params }) {
  try {
    const resolvedParams = await params;
    const orderId = normalizeString(resolvedParams?.orderId, 80);

    const auth = await getCustomerAuthContext();
    const customerId = auth.customerId;
    if (!customerId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();

    const { data: order } = await supabase
      .from("orders")
      .select("id, customer_id")
      .eq("id", orderId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!order?.id) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }

    const [{ data: request }, { data: profile }] = await Promise.all([
      supabase
        .from("tax_invoice_requests")
        .select("id, request_type, tax_payer_name, tax_id, branch_no, address, email, phone, status, note, created_at")
        .eq("order_id", orderId)
        .eq("customer_id", customerId)
        .maybeSingle(),
      supabase
        .from("customes")
        .select("display_name, address, phone")
        .eq("id", customerId)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      ok: true,
      request: request || null,
      defaults: {
        tax_payer_name: profile?.display_name || "",
        address: profile?.address || "",
        phone: profile?.phone || "",
      },
    });
  } catch (error) {
    console.error("Tax invoice request GET error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
    }

    const resolvedParams = await params;
    const orderId = normalizeString(resolvedParams?.orderId, 80);

    const auth = await getCustomerAuthContext();
    const customerId = auth.customerId;
    if (!customerId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    const sanitized = sanitizeTaxPayload(payload);

    if (!sanitized.taxPayerName) {
      return NextResponse.json({ error: "missing_tax_payer_name" }, { status: 400 });
    }
    if (!TAX_ID_PATTERN.test(sanitized.taxId)) {
      return NextResponse.json({ error: "invalid_tax_id" }, { status: 400 });
    }
    if (!sanitized.address) {
      return NextResponse.json({ error: "missing_address" }, { status: 400 });
    }

    const supabase = auth.mode === "supabase" ? auth.supabase : createSupabaseAdminClient();

    const { data: order } = await supabase
      .from("orders")
      .select("id, customer_id")
      .eq("id", orderId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!order?.id) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }

    const row = {
      order_id: orderId,
      customer_id: customerId,
      request_type: sanitized.requestType,
      tax_payer_name: sanitized.taxPayerName,
      tax_id: sanitized.taxId,
      branch_no: sanitized.branchNo || null,
      address: sanitized.address,
      email: sanitized.email || null,
      phone: sanitized.phone || null,
      status: "pending",
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: upsertError } = await supabase
      .from("tax_invoice_requests")
      .upsert(row, { onConflict: "order_id,customer_id" })
      .select("id, status, created_at")
      .maybeSingle();

    if (upsertError) {
      return NextResponse.json(
        { error: "tax_invoice_request_failed", detail: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, request: saved || null });
  } catch (error) {
    console.error("Tax invoice request POST error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
