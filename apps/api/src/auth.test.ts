import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import {
  createStaffSessionToken,
  pinMatches,
  readStaffSessionToken,
  requireStaffRole,
  staffSessionCookie,
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

  it("compares shared PINs without exposing the expected value", () => {
    assert.equal(pinMatches("1111", config.pins.WAITER), true);
    assert.equal(pinMatches("1112", config.pins.WAITER), false);
  });
});
