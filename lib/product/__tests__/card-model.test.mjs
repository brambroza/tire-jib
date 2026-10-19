import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProductCardModel,
  resolveDetailHref,
  resolveImageSrc,
  resolvePriceGroupChip,
  resolveSkuId,
  resolveStockTone,
  splitPrice,
  stripLeadingSymbol,
} from "../card-model.mjs";

test("resolveSkuId prefers id, then sku_id, then skuId, and trims", () => {
  assert.equal(resolveSkuId({ id: " abc " }), "abc");
  assert.equal(resolveSkuId({ sku_id: "s1" }), "s1");
  assert.equal(resolveSkuId({ skuId: "s2" }), "s2");
  assert.equal(resolveSkuId({ id: 42 }), "42");
  assert.equal(resolveSkuId(null), "");
  assert.equal(resolveSkuId({}), "");
});

test("resolveImageSrc picks first non-empty candidate in priority order", () => {
  assert.equal(resolveImageSrc({ imageFiles: ["", " a.png "], imageUrl: "b.png" }), "a.png");
  assert.equal(resolveImageSrc({ imageFile: "c.png", imageUrl: "b.png" }), "c.png");
  assert.equal(resolveImageSrc({ imageUrl: "b.png" }), "b.png");
  assert.equal(resolveImageSrc({ imageFiles: null }), "");
  assert.equal(resolveImageSrc(undefined), "");
});

test("resolveDetailHref encodes sku and falls back to href", () => {
  assert.equal(resolveDetailHref({}, "a b/c"), "/products/a%20b%2Fc");
  assert.equal(resolveDetailHref({ href: " /promo " }, ""), "/promo");
  assert.equal(resolveDetailHref({ href: "   " }, ""), null);
  assert.equal(resolveDetailHref({ href: 12 }, ""), null);
});

test("resolveStockTone normalises unknown values to ok", () => {
  assert.equal(resolveStockTone("out"), "out");
  assert.equal(resolveStockTone("low"), "low");
  assert.equal(resolveStockTone("ok"), "ok");
  assert.equal(resolveStockTone(undefined), "ok");
  assert.equal(resolveStockTone("weird"), "ok");
});

test("stripLeadingSymbol removes emoji and symbol prefixes but keeps Thai text", () => {
  assert.equal(stripLeadingSymbol("🛡️ รับประกัน 365 วัน"), "รับประกัน 365 วัน");
  assert.equal(stripLeadingSymbol("✓ มีสินค้า 8 เส้น"), "มีสินค้า 8 เส้น");
  assert.equal(stripLeadingSymbol("⚠ สินค้าหมด"), "สินค้าหมด");
  assert.equal(stripLeadingSymbol("สินค้าหมด"), "สินค้าหมด");
  assert.equal(stripLeadingSymbol(""), "");
  assert.equal(stripLeadingSymbol(undefined), "");
});

test("buildProductCardModel composes a complete view model", () => {
  const model = buildProductCardModel({
    id: "sku-1",
    brand: "Michelin",
    name: "Primacy 4",
    stockVariant: "ok",
    stock: "✓ มีสินค้า 8 เส้น",
    warranty: "🛡️ รับประกัน 365 วัน ทุกกรณี",
    imageUrl: "tire.png",
  });

  assert.deepEqual(model, {
    skuId: "sku-1",
    imageSrc: "tire.png",
    detailHref: "/products/sku-1",
    stockTone: "ok",
    isOutOfStock: false,
    canAdd: true,
    altText: "Michelin Primacy 4",
    stockText: "มีสินค้า 8 เส้น",
    warrantyText: "รับประกัน 365 วัน ทุกกรณี",
  });
});

test("buildProductCardModel blocks add when out of stock or sku missing", () => {
  assert.equal(buildProductCardModel({ id: "x", stockVariant: "out" }).canAdd, false);
  assert.equal(buildProductCardModel({ id: "x", stockVariant: "out" }).isOutOfStock, true);
  assert.equal(buildProductCardModel({ stockVariant: "ok" }).canAdd, false);
  assert.equal(buildProductCardModel({}).altText, "ยางรถยนต์");
  assert.equal(buildProductCardModel({ id: "x", stockVariant: "low" }).canAdd, true);
});

test("splitPrice separates currency symbol from amount", () => {
  assert.deepEqual(splitPrice("฿2,145"), { symbol: "฿", amount: "2,145" });
  assert.deepEqual(splitPrice("฿ 990"), { symbol: "฿", amount: "990" });
  assert.deepEqual(splitPrice("2,145"), { symbol: "", amount: "2,145" });
  assert.deepEqual(splitPrice(1500), { symbol: "", amount: "1500" });
  assert.deepEqual(splitPrice(undefined), { symbol: "", amount: "" });
});

test("resolvePriceGroupChip maps group to label and tone", () => {
  assert.equal(resolvePriceGroupChip(null), null);
  assert.equal(resolvePriceGroupChip(undefined), null);
  assert.equal(resolvePriceGroupChip({ code: "", name: "" }), null);
  assert.deepEqual(resolvePriceGroupChip({ code: "general", name: "ทั่วไป", isGeneral: true }), {
    label: "ราคาทั่วไป",
    tone: "general",
  });
  assert.deepEqual(resolvePriceGroupChip({ code: "member", name: "สมาชิก", isGeneral: false }), {
    label: "ราคาสมาชิก",
    tone: "member",
  });
  assert.deepEqual(resolvePriceGroupChip({ code: "dealer_mid", name: "ดีลเลอร์กลาง", isGeneral: false }), {
    label: "ราคาดีลเลอร์กลาง",
    tone: "dealer",
  });
  assert.deepEqual(resolvePriceGroupChip({ code: "vip" }), { label: "ราคาvip", tone: "member" });
});
