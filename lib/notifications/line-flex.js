const DEFAULT_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

const EVENT_TITLES = {
  order_confirmed: "รับคำสั่งซื้อแล้ว",
  payment_confirmed: "ยืนยันการชำระเงินแล้ว",
  service_in_progress: "ช่างกำลังดำเนินการ",
  service_completed: "ติดตั้ง/จัดส่งเรียบร้อย",
};

const ORDER_STATUS_LABELS = {
  pending: "รอร้านยืนยัน",
  confirmed: "ร้านยืนยันแล้ว",
  preparing: "กำลังจัดเตรียม",
  shipping: "กำลังจัดส่ง",
  installed: "ติดตั้งสำเร็จ",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

const PAYMENT_STATUS_LABELS = {
  pending: "รอชำระเงิน",
  awaiting_verification: "รอตรวจสอบการชำระเงิน",
  paid: "ชำระเงินแล้ว",
  failed: "ชำระเงินไม่สำเร็จ",
  refunded: "คืนเงินแล้ว",
};

const INK = "#111827";
const MUTED = "#6b7280";
const BRAND = "#06c755";

/**
 * Format a number as Thai Baht without decimals.
 * @param {number|string} value
 * @returns {string}
 */
function formatTHB(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });
}

/**
 * Format a date-like value in Bangkok time, e.g. "7 พ.ย. 2569 09:00".
 * @param {string|Date|null} dateLike
 * @returns {string}
 */
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

/**
 * Format an ISO date string (YYYY-MM-DD) as a Thai date without time.
 * @param {string} isoDate
 * @returns {string}
 */
function formatThaiDateOnly(isoDate) {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return String(isoDate);
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
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
  return trimText(base, 60);
}

function text(value, options = {}) {
  return {
    type: "text",
    text: String(value ?? "-") || "-",
    wrap: true,
    size: options.size || "sm",
    color: options.color || INK,
    ...(options.weight ? { weight: options.weight } : {}),
    ...(options.align ? { align: options.align } : {}),
    ...(options.flex !== undefined ? { flex: options.flex } : {}),
    ...(options.margin ? { margin: options.margin } : {}),
  };
}

/**
 * Two-column key/value row.
 * @param {string} label
 * @param {string} value
 * @param {{bold?: boolean}} [options]
 */
function kvRow(label, value, options = {}) {
  return {
    type: "box",
    layout: "horizontal",
    margin: "sm",
    contents: [
      text(label, { color: MUTED, flex: 4 }),
      text(value, {
        flex: 6,
        align: "end",
        weight: options.bold ? "bold" : undefined,
        color: options.color || INK,
      }),
    ],
  };
}

function sectionTitle(label) {
  return text(label, { weight: "bold", color: "#374151", margin: "lg" });
}

function buildItemRows(items) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) {
    return [text("-", { color: MUTED, margin: "sm" })];
  }

  const rows = safeItems.slice(0, 8).map((item) => {
    const size = item?.size ? `ขนาด ${item.size}` : normalizeItemName(item);
    const sub = item?.size ? normalizeItemName(item) : "";
    const qty = Number(item?.quantity || 0);
    const lineTotal = Number(item?.line_total || 0);
    return {
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        {
          type: "box",
          layout: "vertical",
          flex: 7,
          contents: [
            text(size, { weight: "bold" }),
            ...(sub ? [text(sub, { size: "xs", color: MUTED })] : []),
          ],
        },
        {
          type: "box",
          layout: "vertical",
          flex: 3,
          contents: [
            text(`x${qty}`, { align: "end", color: MUTED }),
            ...(lineTotal > 0 ? [text(formatTHB(lineTotal), { align: "end" })] : []),
          ],
        },
      ],
    };
  });

  if (safeItems.length > 8) {
    rows.push(text(`และอีก ${safeItems.length - 8} รายการ`, { color: MUTED, margin: "sm" }));
  }
  return rows;
}

function buildOrderUrl(orderId) {
  if (!DEFAULT_SITE_URL || !orderId) return null;
  return `${DEFAULT_SITE_URL.replace(/\/$/, "")}/orders/${orderId}`;
}

/**
 * Human-readable fulfillment label.
 * @param {string} fulfillmentType
 * @returns {string}
 */
function fulfillmentLabel(fulfillmentType) {
  if (fulfillmentType === "delivery") return "ส่งถึงบ้าน (ต่างจังหวัด)";
  if (fulfillmentType === "install") return "ติดตั้งที่บ้าน (กรุงเทพฯ และปริมณฑล)";
  return "-";
}

/**
 * Schedule text from either the free-text date/time pair or the appointment timestamp.
 * @param {{dateTrans?: string, timeTrans?: string}} details
 * @param {{scheduled_at?: string}|null} appointment
 * @returns {string}
 */
function scheduleLabel(details, appointment) {
  const dateText = formatThaiDateOnly(details?.dateTrans);
  const timeText = String(details?.timeTrans || "").trim();
  if (dateText && timeText) return `${dateText} · ${timeText}`;
  if (dateText) return dateText;
  return formatThaiDate(appointment?.scheduled_at);
}

export function isSupportedNotificationEventType(eventType) {
  return Object.prototype.hasOwnProperty.call(EVENT_TITLES, eventType);
}

/**
 * Build the LINE Flex message sent to a customer for an order event.
 * `details` is optional checkout context (fulfillment, address, schedule,
 * fee breakdown, bank account) that is not stored on the orders row.
 *
 * @param {{
 *   eventType: string,
 *   order: {id?: string, order_no?: string, status?: string, payment_status?: string, total_amount?: number},
 *   items: Array<{brand?: string, name?: string, size?: string, quantity?: number, line_total?: number}>,
 *   appointment: {scheduled_at?: string}|null,
 *   totals: {grand_total?: number, item_subtotal?: number, service_fee?: number, shipping_fee?: number}|null,
 *   details?: {
 *     fulfillmentType?: string,
 *     address?: string|null,
 *     province?: string|null,
 *     dateTrans?: string|null,
 *     timeTrans?: string|null,
 *     paymentAccount?: {bankName?: string, accountName?: string, accountNumber?: string}|null,
 *   },
 * }} input
 * @returns {{altText: string, contents: object}}
 */
export function buildOrderFlexMessage({ eventType, order, items, appointment, totals, details }) {
  if (!isSupportedNotificationEventType(eventType)) {
    throw new Error("unsupported_notification_event_type");
  }

  const title = EVENT_TITLES[eventType];
  const orderNo = order?.order_no || "-";
  const orderStatus = ORDER_STATUS_LABELS[order?.status] || order?.status || "-";
  const paymentStatus = PAYMENT_STATUS_LABELS[order?.payment_status] || order?.payment_status || "-";
  const grandTotal = Number(totals?.grand_total ?? order?.total_amount ?? 0);
  const itemSubtotal = Number(totals?.item_subtotal ?? 0);
  const serviceFee = Number(totals?.service_fee ?? 0);
  const shippingFee = Number(totals?.shipping_fee ?? 0);
  const orderUrl = buildOrderUrl(order?.id);
  const safeDetails = details || {};
  const isPaid = order?.payment_status === "paid";
  const paymentAccount = safeDetails.paymentAccount || null;
  const hasPaymentAccount = Boolean(paymentAccount?.accountNumber);

  const bodyContents = [
    text(title, { weight: "bold", size: "lg", color: "#0f172a" }),
    text(`เลขที่คำสั่งซื้อ ${orderNo}`, { color: MUTED, margin: "xs" }),

    sectionTitle("สถานะ"),
    kvRow("คำสั่งซื้อ", orderStatus),
    kvRow("การชำระเงิน", paymentStatus, { color: isPaid ? "#15803d" : "#b45309", bold: true }),

    { type: "separator", margin: "lg" },
    sectionTitle("รายการสินค้า"),
    ...buildItemRows(items),
    ...(itemSubtotal > 0 ? [kvRow("รวมสินค้า", formatTHB(itemSubtotal))] : []),
    ...(serviceFee > 0 ? [kvRow("ค่าบริการติดตั้ง", formatTHB(serviceFee))] : []),
    ...(shippingFee > 0 ? [kvRow("ค่าจัดส่ง", formatTHB(shippingFee))] : []),
    kvRow("ยอดรวมสุทธิ", formatTHB(grandTotal), { bold: true }),
  ];

  if (safeDetails.fulfillmentType || appointment?.scheduled_at || safeDetails.address) {
    bodyContents.push({ type: "separator", margin: "lg" }, sectionTitle("การรับบริการ"));
    if (safeDetails.fulfillmentType) {
      bodyContents.push(kvRow("รูปแบบ", fulfillmentLabel(safeDetails.fulfillmentType)));
    }
    if (safeDetails.fulfillmentType !== "delivery") {
      bodyContents.push(kvRow("นัดหมาย", scheduleLabel(safeDetails, appointment)));
    }
    const place = [safeDetails.province, safeDetails.address]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" · ");
    if (place) {
      bodyContents.push(
        kvRow(safeDetails.fulfillmentType === "delivery" ? "ที่อยู่จัดส่ง" : "สถานที่", trimText(place, 160))
      );
    }
  }

  if (!isPaid && hasPaymentAccount) {
    bodyContents.push(
      { type: "separator", margin: "lg" },
      sectionTitle("ชำระเงิน"),
      kvRow("ธนาคาร", paymentAccount.bankName || "-"),
      kvRow("ชื่อบัญชี", paymentAccount.accountName || "-"),
      kvRow("เลขที่บัญชี", paymentAccount.accountNumber, { bold: true }),
      text(`โอน ${formatTHB(grandTotal)} แล้วส่งรูปสลิปในแชทนี้ได้เลย ทางร้านจะตรวจสอบและแจ้งสถานะให้อีกครั้ง`, {
        size: "xs",
        color: MUTED,
        margin: "md",
      })
    );
  } else if (!isPaid) {
    bodyContents.push(
      text("ทางร้านจะแจ้งช่องทางชำระเงินให้ทางแชทนี้", { size: "xs", color: MUTED, margin: "lg" })
    );
  }

  const footerContents = orderUrl
    ? [
        {
          type: "button",
          style: "primary",
          color: BRAND,
          action: {
            type: "uri",
            label: "ดูรายละเอียดคำสั่งซื้อ",
            uri: orderUrl,
          },
        },
      ]
    : [];

  return {
    altText: `คำสั่งซื้อ ${orderNo}: ${title} · ${paymentStatus}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: BRAND,
        paddingAll: "12px",
        contents: [text("สวัสดีจิ๊บจิ๊บ", { color: "#ffffff", weight: "bold" })],
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
