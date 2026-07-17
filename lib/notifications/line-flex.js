const DEFAULT_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

const EVENT_TITLES = {
  order_confirmed: "ยืนยันคำสั่งซื้อแล้ว",
  payment_confirmed: "ยืนยันการชำระเงินแล้ว",
  service_in_progress: "ช่างกำลังดำเนินการ",
  service_completed: "ติดตั้ง/จัดส่งเรียบร้อย",
};

function formatTHB(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  });
}

function formatThaiDate(dateLike) {
  if (!dateLike) return "-";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function trimText(text, maxLength = 90) {
  const raw = String(text || "").trim();
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, Math.max(0, maxLength - 1))}…`;
}

function normalizeItemName(item) {
  const base = `${item?.brand || ""} ${item?.name || ""}`.trim() || item?.title || "สินค้า";
  const size = item?.size ? ` (${item.size})` : "";
  return trimText(`${base}${size}`);
}

function buildItemLines(items) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) {
    return [
      {
        type: "text",
        text: "-",
        size: "sm",
        color: "#4b5563",
      },
    ];
  }

  const lines = safeItems.slice(0, 8).map((item) => ({
    type: "text",
    text: `• ${normalizeItemName(item)} x${Number(item?.quantity || 0)}`,
    wrap: true,
    size: "sm",
    color: "#111827",
    margin: "sm",
  }));

  if (safeItems.length > 8) {
    lines.push({
      type: "text",
      text: `และอีก ${safeItems.length - 8} รายการ`,
      size: "sm",
      color: "#4b5563",
      margin: "sm",
    });
  }

  return lines;
}

function buildOrderUrl(orderId) {
  if (!DEFAULT_SITE_URL || !orderId) return null;
  return `${DEFAULT_SITE_URL.replace(/\/$/, "")}/orders/${orderId}`;
}

export function isSupportedNotificationEventType(eventType) {
  return Object.prototype.hasOwnProperty.call(EVENT_TITLES, eventType);
}

export function buildOrderFlexMessage({ eventType, order, items, appointment, totals }) {
  if (!isSupportedNotificationEventType(eventType)) {
    throw new Error("unsupported_notification_event_type");
  }

  const title = EVENT_TITLES[eventType];
  const orderNo = order?.order_no || "-";
  const amount = formatTHB(totals?.grand_total ?? order?.total_amount ?? 0);
  const scheduleText = formatThaiDate(appointment?.scheduled_at);
  const orderUrl = buildOrderUrl(order?.id);

  const bodyContents = [
    {
      type: "text",
      text: title,
      weight: "bold",
      size: "lg",
      color: "#0f172a",
      wrap: true,
    },
    {
      type: "box",
      layout: "vertical",
      margin: "md",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: `เลขที่คำสั่งซื้อ: ${orderNo}`,
          size: "sm",
          color: "#111827",
          wrap: true,
        },
        {
          type: "text",
          text: `ยอดรวม: ${amount}`,
          size: "sm",
          color: "#111827",
          wrap: true,
        },
        {
          type: "text",
          text: `นัดหมาย: ${scheduleText}`,
          size: "sm",
          color: "#111827",
          wrap: true,
        },
      ],
    },
    {
      type: "separator",
      margin: "lg",
    },
    {
      type: "text",
      text: "สรุปรายการสินค้า",
      margin: "lg",
      size: "sm",
      weight: "bold",
      color: "#374151",
    },
    {
      type: "box",
      layout: "vertical",
      margin: "sm",
      contents: buildItemLines(items),
    },
  ];

  const footerContents = orderUrl
    ? [
        {
          type: "button",
          style: "primary",
          color: "#06c755",
          action: {
            type: "uri",
            label: "ดูรายละเอียดคำสั่งซื้อ",
            uri: orderUrl,
          },
        },
      ]
    : [];

  return {
    altText: `อัปเดตคำสั่งซื้อ ${orderNo}: ${title}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#06c755",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: "สวัสดีจิ๊บจิ๊บ",
            color: "#ffffff",
            weight: "bold",
            size: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: bodyContents,
      },
      ...(footerContents.length
        ? {
            footer: {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: footerContents,
            },
          }
        : {}),
    },
  };
}
