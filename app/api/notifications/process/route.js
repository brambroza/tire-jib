import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processPendingNotificationJobs } from "@/lib/notifications/jobs";
import { isInternalApiAuthorized } from "@/lib/security/internal-api";

export async function POST(request) {
  try {
    if (!isInternalApiAuthorized(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    const limit = Number(payload?.limit || 20);

    const supabase = createSupabaseAdminClient();
    const result = await processPendingNotificationJobs({ supabase, limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Process notification jobs error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
