import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QUICK_ORDER_DESTINATION,
  cartHasSku,
  parseQuickOrderParams,
  quickOrderErrorMessage,
  rememberNonce,
  sanitizeReturnTo,
} from "../quick-order.mjs";

const SKU = "1df52c4e-2178-400f-9cd6-cb38cf8549a7";
const params = (query) => new URLSearchParams(query);

test("parseQuickOrderParams accepts valid sku, qty and nonce", () => {
  assert.deepEqual(parseQuickOrderParams(params(`sku=${SKU}&qty=4&n=ab12cd34`)), {
    skuId: SKU,
    quantity: 4,
    nonce: "ab12cd34",
  });
});

test("parseQuickOrderParams rejects missing or malformed sku", () => {
  assert.equal(parseQuickOrderParams(params("qty=1")), null);
  assert.equal(parseQuickOrderParams(params("sku=1;drop")), null);
  assert.equal(parseQuickOrderParams(null), null);
});

test("parseQuickOrderParams defaults and clamps quantity", () => {
  assert.equal(parseQuickOrderParams(params(`sku=${SKU}`)).quantity, 1);
  assert.equal(parseQuickOrderParams(params(`sku=${SKU}&qty=0`)).quantity, 1);
  assert.equal(parseQuickOrderParams(params(`sku=${SKU}&qty=500`)).quantity, 99);
  assert.equal(parseQuickOrderParams(params(`sku=${SKU}&qty=2.5`)).quantity, 1);
  assert.equal(parseQuickOrderParams(params(`sku=${SKU}&qty=abc`)).quantity, 1);
});

test("parseQuickOrderParams drops invalid nonce", () => {
  assert.equal(parseQuickOrderParams(params(`sku=${SKU}&n=<script>`)).nonce, null);
  assert.equal(parseQuickOrderParams(params(`sku=${SKU}`)).nonce, null);
});

test("sanitizeReturnTo allows only same-site relative paths", () => {
  assert.equal(sanitizeReturnTo(`/line/order?sku=${SKU}`), `/line/order?sku=${SKU}`);
  assert.equal(sanitizeReturnTo("/cart"), "/cart");
  assert.equal(sanitizeReturnTo("//evil.com"), null);
  assert.equal(sanitizeReturnTo("/\\evil.com"), null);
  assert.equal(sanitizeReturnTo("https://evil.com"), null);
  assert.equal(sanitizeReturnTo("javascript:alert(1)"), null);
  assert.equal(sanitizeReturnTo("/a\nb"), null);
  assert.equal(sanitizeReturnTo(""), null);
  assert.equal(sanitizeReturnTo(42), null);
  assert.equal(sanitizeReturnTo("/" + "a".repeat(600)), null);
});

test("rememberNonce de-duplicates and keeps most recent", () => {
  assert.deepEqual(rememberNonce(["a", "b"], "a"), ["b", "a"]);
  assert.deepEqual(rememberNonce(null, "x"), ["x"]);
  assert.deepEqual(rememberNonce(["1", "2", "3"], "4", 3), ["2", "3", "4"]);
});

test("quickOrderErrorMessage maps known codes and falls back", () => {
  assert.match(quickOrderErrorMessage("out_of_stock"), /หมด/);
  assert.match(quickOrderErrorMessage("whatever"), /ไม่สามารถ/);
});

test("quick order lands on checkout", () => {
  assert.equal(QUICK_ORDER_DESTINATION, "/checkout");
});

test("cartHasSku finds the SKU in cart details", () => {
  assert.equal(cartHasSku({ items: [{ skuId: SKU, quantity: 1 }] }, SKU), true);
  assert.equal(cartHasSku({ items: [{ skuId: "other" }] }, SKU), false);
  assert.equal(cartHasSku({ items: [] }, SKU), false);
  assert.equal(cartHasSku({ cart: null }, SKU), false);
  assert.equal(cartHasSku(null, SKU), false);
  assert.equal(cartHasSku({ items: [{ skuId: SKU }] }, ""), false);
});
