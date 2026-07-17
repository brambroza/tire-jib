import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchLineMessageContent,
  mapWebhookEventForStorage,
  resolveMessageExtension,
  verifyLineWebhookSignature,
} from "@/lib/line/webhook";

const SUPPORTED_MEDIA_TYPES = new Set(["image", "video", "audio", "file", "sticker"]);
const LINK_CODE_PATTERN = /\bJIB-[A-Z0-9]{6}\b/i;

async function persistMediaIfAny({ supabase, row, message }) {
  if (!message?.id || !SUPPORTED_MEDIA_TYPES.has(message?.type)) return;

  if (message.type === "sticker") {
    await supabase.from("line_webhook_media").insert({
      webhook_event_id: row.id,
      message_id: message.id,
      line_user_id: row.line_user_id,
      media_type: message.type,
      content_type: "application/json",
      sticker_package_id: message.packageId || null,
      sticker_id: message.stickerId || null,
      sticker_keywords: message.keywords || null,
      raw_payload: message,
    });
    return;
  }

  const { bytes, contentType } = await fetchLineMessageContent(message.id);
  const bucket = process.env.LINE_WEBHOOK_MEDIA_BUCKET || "line-webhook-media";
  const ext = resolveMessageExtension(message.type, contentType);
  const filePath = `${new Date().toISOString().slice(0, 10)}/${message.id}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, bytes, {
    contentType,
    upsert: false,
  });

  if (uploadError) {
    throw new Error(`supabase_upload_failed:${uploadError.message}`);
  }

  await supabase.from("line_webhook_media").insert({
    webhook_event_id: row.id,
    message_id: message.id,
    line_user_id: row.line_user_id,
    media_type: message.type,
    content_type: contentType,
    storage_bucket: bucket,
    storage_path: filePath,
    file_size_bytes: bytes.byteLength,
    file_name: message.fileName || null,
    raw_payload: message,
  });
}

async function syncFriendshipFromEvent(supabase, event) {
  const lineUserId = event?.source?.userId;
  if (!lineUserId) return;

  const now = new Date().toISOString();

  if (event?.type === "follow") {
    await supabase
      .from("customes")
      .update({
        line_msg_user_id: lineUserId,
        line_is_friend: true,
        line_friendship_checked_at: now,
        line_followed_at: now,
      })
      .or(`line_msg_user_id.eq.${lineUserId},line_user_id.eq.${lineUserId}`);
  }

  if (event?.type === "unfollow") {
    await supabase
      .from("customes")
      .update({
        line_msg_user_id: lineUserId,
        line_is_friend: false,
        line_friendship_checked_at: now,
        line_unfollowed_at: now,
      })
      .or(`line_msg_user_id.eq.${lineUserId},line_user_id.eq.${lineUserId}`);
  }
}

async function tryLinkLineMsgUserIdFromMessage(supabase, event) {
  if (event?.type !== "message" || event?.message?.type !== "text") return false;
  const lineUserId = event?.source?.userId;
  const text = String(event?.message?.text || "").trim();
  if (!lineUserId || !text) return false;

  const match = text.match(LINK_CODE_PATTERN);
  if (!match) return false;
  const submittedCode = match[0].toUpperCase();
  const now = new Date().toISOString();

  const { data: codeRow } = await supabase
    .from("line_msg_link_codes")
    .select("id, customer_id, code, status, expires_at")
    .eq("code", submittedCode)
    .eq("status", "pending")
    .maybeSingle();

  if (!codeRow?.id) return false;
  if (new Date(codeRow.expires_at).getTime() <= Date.now()) {
    await supabase
      .from("line_msg_link_codes")
      .update({ status: "expired" })
      .eq("id", codeRow.id);
    return false;
  }

  await supabase
    .from("customes")
    .update({
      line_msg_user_id: lineUserId,
      line_is_friend: true,
      line_friendship_checked_at: now,
      line_followed_at: now,
    })
    .eq("id", codeRow.customer_id);

  await supabase
    .from("line_msg_link_codes")
    .update({
      status: "linked",
      linked_at: now,
      line_msg_user_id: lineUserId,
    })
    .eq("id", codeRow.id);

  return true;
}

export async function POST(request) {
  const signature = request.headers.get("x-line-signature") || "";
  const rawBody = await request.text();

  if (!verifyLineWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody || "{}");
  const events = Array.isArray(body?.events) ? body.events : [];
  const supabase = createSupabaseAdminClient();

  for (const event of events) {
    const mapped = mapWebhookEventForStorage(event);
    const { data, error } = await supabase
      .from("line_webhook_events")
      .insert(mapped)
      .select("id, line_user_id")
      .single();

    if (error || !data?.id) {
      console.error("line_webhook_insert_failed", { error, event });
      continue;
    }

    await syncFriendshipFromEvent(supabase, event).catch((friendError) => {
      console.error("line_friendship_sync_failed", { friendError, eventType: event?.type });
    });
    await tryLinkLineMsgUserIdFromMessage(supabase, event).catch((linkError) => {
      console.error("line_link_code_sync_failed", { linkError, eventType: event?.type });
    });

    await persistMediaIfAny({
      supabase,
      row: data,
      message: event?.message,
    }).catch((mediaError) => {
      console.error("line_media_persist_failed", { mediaError, messageId: event?.message?.id });
    });
  }

  return NextResponse.json({ ok: true });
}
