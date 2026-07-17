import { createHmac, timingSafeEqual } from "crypto";

const LINE_MESSAGE_CONTENT_API = "https://api-data.line.me/v2/bot/message";

function getLineChannelSecret() {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    throw new Error("missing_line_channel_secret");
  }
  return secret;
}

function getLineMessagingToken() {
  const token = process.env.LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("missing_line_messaging_token");
  }
  return token;
}

export function verifyLineWebhookSignature(rawBody, signature) {
  if (!signature || !rawBody) return false;

  const expected = createHmac("sha256", getLineChannelSecret())
    .update(rawBody)
    .digest("base64");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function mapWebhookEventForStorage(event) {
  const source = event?.source || {};
  const message = event?.message || null;

  return {
    webhook_event_id: event?.webhookEventId || null,
    event_type: event?.type || "unknown",
    mode: event?.mode || null,
    timestamp_ms: event?.timestamp || null,
    line_user_id: source?.userId || null,
    source_type: source?.type || null,
    source_group_id: source?.groupId || null,
    source_room_id: source?.roomId || null,
    message_id: message?.id || null,
    message_type: message?.type || null,
    message_text: message?.type === "text" ? message?.text || null : null,
    message_payload: message,
    raw_event: event,
  };
}

export function resolveMessageExtension(messageType, contentType = "") {
  if (messageType === "image") return "jpg";
  if (messageType === "video") return "mp4";
  if (messageType === "audio") return "m4a";
  if (messageType === "file") {
    if (contentType.includes("pdf")) return "pdf";
    if (contentType.includes("zip")) return "zip";
    return "bin";
  }
  if (messageType === "sticker") return "json";
  return "bin";
}

export async function fetchLineMessageContent(messageId) {
  const response = await fetch(`${LINE_MESSAGE_CONTENT_API}/${messageId}/content`, {
    headers: {
      Authorization: `Bearer ${getLineMessagingToken()}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`line_message_content_error:${response.status}:${detail}`);
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    contentType,
  };
}
