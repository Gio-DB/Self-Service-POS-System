import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { createStaffSessionToken, staffSessionCookie, type StaffAuthConfig } from "./auth.js";
import { HttpError } from "./errors.js";
import { parseCustomerOrderInput } from "./routes.js";

const apiAuthConfig: StaffAuthConfig = {
  sessionSecret: "route-test-session-secret",
  pins: { WAITER: "1111", KITCHEN: "2222", ADMIN: "3333" },
  sessionTtlMs: 60_000,
};

process.env.DATABASE_URL ??= "postgresql://pos:pos@127.0.0.1:5432/restaurant_pos";
process.env.STAFF_SESSION_SECRET = apiAuthConfig.sessionSecret;
process.env.STAFF_WAITER_PIN = apiAuthConfig.pins.WAITER;
process.env.STAFF_KITCHEN_PIN = apiAuthConfig.pins.KITCHEN;
process.env.STAFF_ADMIN_PIN = apiAuthConfig.pins.ADMIN;

async function withApiServer(assertions: (baseUrl: string) => Promise<void>) {
  const { createApp } = await import("./app.js");
  const server = createServer(createApp({ emit: () => undefined }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await assertions(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe("customer order validation", () => {
  const order = {
    id: "b4e69710-aa3b-47da-ae7d-78c1a901cba2",
    orderType: "TAKEAWAY",
    tableNumber: null,
    items: [{ menuItemId: 1, quantity: 1 }],
  };

  it("accepts customer menu items without modification notes", () => {
    assert.deepEqual(parseCustomerOrderInput(order), order);
  });

  it("rejects a customer-supplied modification note", () => {
    assert.throws(
      () => parseCustomerOrderInput({
        ...order,
        items: [{ ...order.items[0], notes: "Extra cheese" }],
      }),
      (error: unknown) => error instanceof HttpError && error.status === 400,
    );
  });

  it("enforces waiter-only edits at the HTTP boundary", async () => {
    await withApiServer(async (baseUrl) => {
      const body = JSON.stringify({
        items: [{ menuItemId: 1, quantity: 1, notes: "Extra cheese" }],
      });
      const anonymous = await fetch(`${baseUrl}/api/orders/b4e69710-aa3b-47da-ae7d-78c1a901cba2/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      });
      assert.equal(anonymous.status, 401);

      const kitchenToken = createStaffSessionToken("KITCHEN", apiAuthConfig);
      const kitchen = await fetch(`${baseUrl}/api/orders/b4e69710-aa3b-47da-ae7d-78c1a901cba2/items`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${staffSessionCookie}=${kitchenToken}`,
        },
        body,
      });
      assert.equal(kitchen.status, 403);
    });
  });
});
