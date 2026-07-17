const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

export function isLineMessagingConfigured() {
  return Boolean(process.env.LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN);
}

export async function sendLineFlexMessage({ to, altText, contents }) {
  const channelAccessToken = process.env.LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN;
  const endpoint = process.env.LINE_MESSAGING_API_ENDPOINT || LINE_PUSH_ENDPOINT;
  console.log("[line-messaging] sendLineFlexMessage start", {
    to,
    endpoint,
    hasToken: Boolean(channelAccessToken),
    hasContents: Boolean(contents),
  });

  if (!channelAccessToken) {
    throw new Error("line_messaging_api_not_configured");
  }

  if (!to || typeof to !== "string") {
    throw new Error("invalid_line_recipient");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      to,
      messages: [
        {
          type: "flex",
          altText: altText || "อัปเดตสถานะคำสั่งซื้อ",
          contents,
        },
      ],
    }),
  });
  console.log("[line-messaging] push response", { status: response.status, ok: response.ok });

  if (!response.ok) {
    const detailText = await response.text();
    console.error("[line-messaging] push failed detail", detailText);
    throw new Error(`line_push_failed:${response.status}:${detailText}`);
  }

  console.log("[line-messaging] push success", { to });
  return { ok: true };
}
