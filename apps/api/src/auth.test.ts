import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import {
  createStaffSessionToken,
  hashStaffPin,
  readStaffSessionToken,
  requireStaffRole,
  staffSessionCookie,
  staffPinHashMatches,
  type StaffAuthConfig,
} from "./auth.js";
import { HttpError } from "./errors.js";

const config: StaffAuthConfig = {
  sessionSecret: "test-session-secret",
  pins: { WAITER: "1111", KITCHEN: "2222", ADMIN: "3333" },
  sessionTtlMs: 60_000,
};

describe("staff role sessions", () => {
  it("accepts a signed session and rejects tampered or expired tokens", () => {
    const token = createStaffSessionToken("WAITER", config, 1_000);
    assert.deepEqual(readStaffSessionToken(token, config, 2_000), {
      role: "WAITER",
      expiresAt: new Date(61_000),
    });
    assert.equal(readStaffSessionToken(`${token}x`, config, 2_000), null);
    assert.equal(readStaffSessionToken(token, config, 61_000), null);
  });

  it("permits only the session's staff role", () => {
    const token = createStaffSessionToken("WAITER", config);
    const request = {
      headers: { cookie: `${staffSessionCookie}=${token}` },
    } as Request;
    assert.equal(requireStaffRole(request, config, "WAITER").role, "WAITER");
    assert.throws(
      () => requireStaffRole(request, config, "KITCHEN"),
      (error: unknown) => error instanceof HttpError && error.status === 403,
    );
  });

  it("stores role PINs as non-recoverable hashes and verifies them", async () => {
    const encodedHash = await hashStaffPin("test-role-pin");
    assert.notEqual(encodedHash, "test-role-pin");
    assert.match(encodedHash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    assert.equal(await staffPinHashMatches("test-role-pin", encodedHash), true);
    assert.equal(await staffPinHashMatches("wrong-role-pin", encodedHash), false);
    assert.equal(await staffPinHashMatches("test-role-pin", "invalid-hash"), false);
  });
});
