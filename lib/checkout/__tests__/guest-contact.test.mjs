import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeThaiPhone, validateGuestContact } from "../guest-contact.mjs";

test("normalizeThaiPhone strips separators and +66 prefix", () => {
  assert.equal(normalizeThaiPhone("081-234-5678"), "0812345678");
  assert.equal(normalizeThaiPhone("+66 81 234 5678"), "0812345678");
  assert.equal(normalizeThaiPhone("66812345678"), "0812345678");
  assert.equal(normalizeThaiPhone("(02) 123 4567"), "021234567");
  assert.equal(normalizeThaiPhone(null), "");
});

test("validateGuestContact accepts valid input and trims", () => {
  const result = validateGuestContact({
    name: "  สมชาย   ใจดี ",
    phone: "081 234 5678",
    address: " 12/3 ถนนสุขุมวิท ",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    name: "สมชาย ใจดี",
    phone: "0812345678",
    address: "12/3 ถนนสุขุมวิท",
  });
  assert.deepEqual(result.errors, {});
});

test("validateGuestContact reports each missing or bad field", () => {
  const result = validateGuestContact({ name: "a", phone: "12345", address: "" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.name);
  assert.ok(result.errors.phone);
  assert.ok(result.errors.address);
});

test("validateGuestContact rejects over-long values", () => {
  const result = validateGuestContact({
    name: "ก".repeat(101),
    phone: "0812345678",
    address: "ข".repeat(501),
  });
  assert.ok(result.errors.name);
  assert.ok(result.errors.address);
  assert.equal(result.errors.phone, undefined);
});

test("validateGuestContact handles missing input", () => {
  assert.equal(validateGuestContact(undefined).ok, false);
});
