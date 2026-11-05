import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderFlexMessage, isSupportedNotificationEventType } from "../line-flex.js";

/** Flatten every text node inside a Flex container for simple assertions. */
function collectText(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (node.type === "text" && typeof node.text === "string") out.push(node.text);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => collectText(child, out));
    else if (value && typeof value === "object") collectText(value, out);
  }
  return out;
}

const baseOrder = {
  id: "11111111-1111-4111-8111-111111111111",
  order_no: "JIB-2611-0007",
  status: "pending",
  payment_status: "pending",
  total_amount: 17980,
};

const baseItems = [
  { brand: "Bridgestone", name: "Turanza T005A", size: "195/65R15", quantity: 4, line_total: 9400 },
  { brand: "Michelin", name: "Primacy 4+", size: "215/55R17", quantity: 2, line_total: 8580 },
];

test("supported event types", () => {
  assert.equal(isSupportedNotificationEventType("order_confirmed"), true);
  assert.equal(isSupportedNotificationEventType("something_else"), false);
  assert.throws(() => buildOrderFlexMessage({ eventType: "nope", order: baseOrder, items: [] }));
});

test("order_confirmed without slip shows status, items, totals and bank account", () => {
  const message = buildOrderFlexMessage({
    eventType: "order_confirmed",
    order: baseOrder,
    items: baseItems,
    appointment: null,
    totals: { item_subtotal: 17980, service_fee: 0, shipping_fee: 0, grand_total: 17980 },
    details: {
      fulfillmentType: "install",
      address: "123 ถนนสุขุมวิท",
      province: "กรุงเทพมหานคร",
      dateTrans: "2026-11-07",
      timeTrans: "09:00-10:00",
      paymentAccount: { bankName: "กสิกรไทย", accountName: "บจก. จิ๊บจิ๊บ", accountNumber: "123-4-56789-0" },
    },
  });

  assert.equal(message.contents.type, "bubble");
  assert.match(message.altText, /JIB-2611-0007/);
  assert.match(message.altText, /รอชำระเงิน/);

  const texts = collectText(message.contents);
  const joined = texts.join("\n");
  assert.match(joined, /รับคำสั่งซื้อแล้ว/);
  assert.match(joined, /รอร้านยืนยัน/);
  assert.match(joined, /รอชำระเงิน/);
  assert.match(joined, /ขนาด 195\/65R15/);
  assert.match(joined, /x4/);
  assert.match(joined, /ติดตั้งที่ร้าน/);
  assert.match(joined, /09:00-10:00/);
  assert.match(joined, /กรุงเทพมหานคร · 123 ถนนสุขุมวิท/);
  assert.match(joined, /123-4-56789-0/);
  assert.match(joined, /ส่งรูปสลิปในแชทนี้/);
  // grand total appears formatted as THB without decimals
  assert.ok(texts.some((t) => /17,980/.test(t)), "grand total present");
});

test("paid order hides bank account block", () => {
  const message = buildOrderFlexMessage({
    eventType: "payment_confirmed",
    order: { ...baseOrder, payment_status: "paid" },
    items: baseItems,
    appointment: null,
    totals: { grand_total: 17980 },
    details: {
      fulfillmentType: "delivery",
      address: "99 หมู่ 1 ต.บางปลา อ.บางพลี",
      province: "ต่างจังหวัด",
      paymentAccount: { bankName: "กสิกรไทย", accountName: "x", accountNumber: "123-4-56789-0" },
    },
  });
  const joined = collectText(message.contents).join("\n");
  assert.match(joined, /ชำระเงินแล้ว/);
  assert.doesNotMatch(joined, /123-4-56789-0/);
  assert.match(joined, /ส่งถึงบ้าน/);
  assert.doesNotMatch(joined, /นัดหมาย/);
});

test("falls back to appointment timestamp and generic payment note", () => {
  const message = buildOrderFlexMessage({
    eventType: "order_confirmed",
    order: baseOrder,
    items: [],
    appointment: { scheduled_at: "2026-11-07T02:00:00.000Z" },
    totals: null,
    details: { fulfillmentType: "install" },
  });
  const joined = collectText(message.contents).join("\n");
  assert.match(joined, /นัดหมาย/);
  assert.match(joined, /09:00/);
  assert.match(joined, /ทางร้านจะแจ้งช่องทางชำระเงินให้ทางแชทนี้/);
  assert.equal(message.contents.footer, undefined);
});
