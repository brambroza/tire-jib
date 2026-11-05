import { test } from "node:test";
import assert from "node:assert/strict";

process.env.LINE_SESSION_SECRET = "test-secret-for-guest-session";
const {
  createGuestSessionToken,
  verifyGuestSessionToken,
  isGuestLineUserId,
} = await import("../guest-session.js");

const CUSTOMER = "1df52c4e-2178-400f-9cd6-cb38cf8549a7";

test("guest token round-trips", () => {
  const payload = verifyGuestSessionToken(createGuestSessionToken({ customerId: CUSTOMER }));
  assert.equal(payload.customerId, CUSTOMER);
  assert.equal(payload.guest, true);
});

test("guest token rejects tampering, expiry and junk", () => {
  const token = createGuestSessionToken({ customerId: CUSTOMER });
  const [body, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ customerId: "other", guest: true, exp: 9999999999 })).toString("base64url");
  assert.equal(verifyGuestSessionToken(`${forged}.${sig}`), null);
  assert.equal(verifyGuestSessionToken(`${body}.x${sig.slice(1)}`), null);
  assert.equal(verifyGuestSessionToken(createGuestSessionToken({ customerId: CUSTOMER }, { maxAge: -10 })), null);
  assert.equal(verifyGuestSessionToken("nope"), null);
  assert.equal(verifyGuestSessionToken(undefined), null);
});

test("isGuestLineUserId detects placeholder ids only", () => {
  assert.equal(isGuestLineUserId("guest:abc"), true);
  assert.equal(isGuestLineUserId("U1234567890abcdef"), false);
  assert.equal(isGuestLineUserId(null), false);
});
