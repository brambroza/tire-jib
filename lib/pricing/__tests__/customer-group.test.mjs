import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPriceGroupIds, pickPriceRow, resolveEffectivePrice } from "../price-helpers.mjs";

const GROUP = "11111111-1111-4111-8111-111111111111";
const GENERAL = "22222222-2222-4222-8222-222222222222";

test("buildPriceGroupIds keeps group first and general second", () => {
  assert.deepEqual(buildPriceGroupIds(GROUP, GENERAL), [GROUP, GENERAL]);
});

test("buildPriceGroupIds drops duplicates and empty values", () => {
  assert.deepEqual(buildPriceGroupIds(GENERAL, GENERAL), [GENERAL]);
  assert.deepEqual(buildPriceGroupIds(null, GENERAL), [GENERAL]);
  assert.deepEqual(buildPriceGroupIds("", undefined), []);
});

test("pickPriceRow prefers the customer's group price", () => {
  const prices = [
    { group_id: GENERAL, price: 100 },
    { group_id: GROUP, price: 80 },
  ];
  assert.equal(pickPriceRow(prices, GROUP, GENERAL).price, 80);
});

test("pickPriceRow falls back to general when group price missing", () => {
  const prices = [{ group_id: GENERAL, price: 100 }];
  assert.equal(pickPriceRow(prices, GROUP, GENERAL).price, 100);
});

test("pickPriceRow falls back to first row when neither group matches", () => {
  const prices = [{ group_id: "other", price: 55 }];
  assert.equal(pickPriceRow(prices, GROUP, GENERAL).price, 55);
});

test("pickPriceRow returns undefined for empty input", () => {
  assert.equal(pickPriceRow([], GROUP, GENERAL), undefined);
  assert.equal(pickPriceRow(null, GROUP, GENERAL), undefined);
});

test("resolveEffectivePrice uses promo_price when lower than price", () => {
  assert.deepEqual(resolveEffectivePrice({ price: 2500, promo_price: 2200 }), {
    price: 2200,
    basePrice: 2500,
    isPromo: true,
    discountPercent: 12,
    saving: 300,
  });
  assert.deepEqual(resolveEffectivePrice({ price: "1000", promo_price: "0" }), {
    price: 0,
    basePrice: 1000,
    isPromo: true,
    discountPercent: 100,
    saving: 1000,
  });
});

test("resolveEffectivePrice ignores missing, equal, higher or invalid promo_price", () => {
  const regular = { price: 2500, basePrice: 2500, isPromo: false, discountPercent: 0, saving: 0 };
  assert.deepEqual(resolveEffectivePrice({ price: 2500 }), regular);
  assert.deepEqual(resolveEffectivePrice({ price: 2500, promo_price: null }), regular);
  assert.deepEqual(resolveEffectivePrice({ price: 2500, promo_price: 2500 }), regular);
  assert.deepEqual(resolveEffectivePrice({ price: 2500, promo_price: 2600 }), regular);
  assert.deepEqual(resolveEffectivePrice({ price: 2500, promo_price: "abc" }), regular);
  assert.deepEqual(resolveEffectivePrice({ price: 2500, promo_price: -1 }), regular);
  assert.deepEqual(resolveEffectivePrice(null), { ...regular, price: 0, basePrice: 0 });
});
