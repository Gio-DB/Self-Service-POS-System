import assert from "node:assert/strict";
import { io } from "socket.io-client";

const apiBase = process.env.VITE_API_URL ?? "http://127.0.0.1:3000";
const socket = io(apiBase, { timeout: 5000 });

async function request(path, method = "GET", body) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json();
  return { status: response.status, value };
}

async function waitForSocket() {
  if (socket.connected) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Socket connection timed out.")), 6000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function expectSocketEvent(eventName, action) {
  const event = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${eventName}.`)),
      3000,
    );
    socket.once(eventName, () => {
      clearTimeout(timer);
      resolve();
    });
  });
  await action();
  await event;
}

async function main() {
  const health = await request("/health");
  assert.equal(health.status, 200);
  assert.equal(health.value.database, "connected");
  await waitForSocket();

  const menuResult = await request("/api/menu");
  assert.equal(menuResult.status, 200);
  const menuItems = menuResult.value.flatMap((category) => category.items);
  const burger = menuItems.find((item) => item.name === "Classic Burger");
  const fries = menuItems.find((item) => item.name === "Fries");
  assert.ok(burger && fries, "Seeded demo menu items should be available.");
  const missingMenuItemId = Math.max(...menuItems.map((item) => item.id)) + 1;

  const reportDate = new Date().toISOString().slice(0, 10);
  const beforeReport = await request(`/api/reports/daily?date=${reportDate}`);
  assert.equal(beforeReport.status, 200);
  for (const date of ["0001-01-01", "9999-12-31"]) {
    assert.equal(
      (await request(`/api/reports/daily?date=${date}`)).status,
      200,
      `Valid date boundary ${date} should be accepted.`,
    );
  }
  assert.equal(
    (await request("/api/reports/daily?date=2026-02-31")).status,
    400,
    "Impossible calendar dates should be rejected.",
  );
  assert.equal(
    (await request("/api/reports/daily?date=0000-01-01")).status,
    400,
    "Years outside the database date range should be rejected.",
  );
  assert.equal(
    (await request("/api/reports/daily?date=2026-10-28&date=2026-10-29")).status,
    400,
    "Ambiguous repeated report dates should be rejected.",
  );
  assert.equal(
    (
      await request("/api/orders/not-a-uuid/status", "PATCH", {
        status: "CANCELLED",
      })
    ).status,
    400,
    "Malformed order IDs should be rejected as client input.",
  );
  assert.equal(
    (
      await request("/api/orders/not-a-uuid/items", "PATCH", {
        items: [{ menuItemId: fries.id, quantity: 1 }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/orders/not-a-uuid/payment", "POST", {
        cashTenderedMinorUnits: 0,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/menu/items/not-an-id/availability", "PATCH", {
        isAvailable: true,
      })
    ).status,
    400,
    "Malformed menu item IDs should be rejected as client input.",
  );
  assert.equal(
    (
      await request(`/api/menu/items/${missingMenuItemId}/availability`, "PATCH", {
        isAvailable: true,
      })
    ).status,
    404,
    "Unknown menu items should be reported as not found.",
  );
  const malformedJson = await fetch(`${apiBase}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformedJson.status, 400, "Malformed JSON should return 400.");

  for (const quantity of [0, 100]) {
    const invalidQuantity = await request("/api/orders", "POST", {
      id: crypto.randomUUID(),
      orderType: "TAKEAWAY",
      items: [{ menuItemId: fries.id, quantity }],
    });
    assert.equal(invalidQuantity.status, 400);
  }
  const maximumQuantityId = crypto.randomUUID();
  const maximumQuantityOrder = await request("/api/orders", "POST", {
    id: maximumQuantityId,
    orderType: "TAKEAWAY",
    items: [{ menuItemId: fries.id, quantity: 99 }],
  });
  assert.equal(maximumQuantityOrder.status, 201);
  assert.equal(maximumQuantityOrder.value.items[0].quantity, 99);
  assert.equal(
    (await request(`/api/orders/${maximumQuantityId}/status`, "PATCH", {
      status: "CANCELLED",
    })).status,
    200,
  );

  const orderId = crypto.randomUUID();
  const orderPayload = {
    id: orderId,
    orderType: "DINE_IN",
    tableNumber: "SMOKE",
    items: [
      { menuItemId: burger.id, quantity: 2, notes: "No onions" },
      { menuItemId: fries.id, quantity: 1, notes: null },
    ],
  };
  const created = await request("/api/orders", "POST", orderPayload);
  assert.equal(created.status, 201);
  assert.equal(created.value.totalMinorUnits, burger.priceMinorUnits * 2 + fries.priceMinorUnits);

  const retry = await request("/api/orders", "POST", orderPayload);
  assert.equal(retry.status, 200);
  assert.equal(retry.value.id, orderId);

  const conflictingRetry = await request("/api/orders", "POST", {
    ...orderPayload,
    items: [{ menuItemId: burger.id, quantity: 1, notes: null }],
  });
  assert.equal(conflictingRetry.status, 409);

  const concurrentId = crypto.randomUUID();
  const concurrentPayload = {
    id: concurrentId,
    orderType: "TAKEAWAY",
    items: [{ menuItemId: fries.id, quantity: 1 }],
  };
  const concurrentCreates = await Promise.all([
    request("/api/orders", "POST", concurrentPayload),
    request("/api/orders", "POST", concurrentPayload),
  ]);
  assert.deepEqual(
    concurrentCreates.map((result) => result.status).sort(),
    [200, 201],
  );

  const competingStatuses = await Promise.all([
    request(`/api/orders/${concurrentId}/status`, "PATCH", {
      status: "ACCEPTED",
    }),
    request(`/api/orders/${concurrentId}/status`, "PATCH", {
      status: "CANCELLED",
    }),
  ]);
  assert.equal(competingStatuses.filter((result) => result.status === 200).length, 1);
  assert.equal(competingStatuses.filter((result) => result.status === 409).length, 1);
  if (competingStatuses.find((result) => result.status === 200)?.value.status === "ACCEPTED") {
    const cancelled = await request(
      `/api/orders/${concurrentId}/status`,
      "PATCH",
      { status: "CANCELLED" },
    );
    assert.equal(cancelled.status, 200);
  }

  const edited = await request(`/api/orders/${orderId}/items`, "PATCH", {
    items: [
      { menuItemId: burger.id, quantity: 1, notes: "No onions" },
      { menuItemId: fries.id, quantity: 2, notes: null },
    ],
  });
  assert.equal(edited.status, 200);
  const expectedTotal = burger.priceMinorUnits + fries.priceMinorUnits * 2;
  assert.equal(edited.value.totalMinorUnits, expectedTotal);

  const invalidTransition = await request(
    `/api/orders/${orderId}/status`,
    "PATCH",
    { status: "PREPARING" },
  );
  assert.equal(invalidTransition.status, 409);
  const earlyPayment = await request(`/api/orders/${orderId}/payment`, "POST", {
    cashTenderedMinorUnits: expectedTotal,
  });
  assert.equal(earlyPayment.status, 409);

  await expectSocketEvent("orders:changed", async () => {
    const approved = await request(`/api/orders/${orderId}/status`, "PATCH", {
      status: "ACCEPTED",
    });
    assert.equal(approved.status, 200);
  });

  for (const status of ["PREPARING", "READY"]) {
    const updated = await request(`/api/orders/${orderId}/status`, "PATCH", {
      status,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.value.status, status);
  }

  const underpaid = await request(`/api/orders/${orderId}/payment`, "POST", {
    cashTenderedMinorUnits: expectedTotal - 1,
  });
  assert.equal(underpaid.status, 400);

  const tendered = expectedTotal + 500;
  const paid = await request(`/api/orders/${orderId}/payment`, "POST", {
    cashTenderedMinorUnits: tendered,
  });
  assert.equal(paid.status, 200);
  assert.equal(paid.value.changeDueMinorUnits, 500);
  assert.equal(paid.value.paymentStatus, "PAID");

  const paymentRaceId = crypto.randomUUID();
  const paymentRaceCreated = await request("/api/orders", "POST", {
    id: paymentRaceId,
    orderType: "TAKEAWAY",
    items: [{ menuItemId: fries.id, quantity: 1 }],
  });
  assert.equal(paymentRaceCreated.status, 201);
  for (const status of ["ACCEPTED", "PREPARING", "READY"]) {
    const changed = await request(`/api/orders/${paymentRaceId}/status`, "PATCH", {
      status,
    });
    assert.equal(changed.status, 200);
  }
  const paymentAttempts = await Promise.all([
    request(`/api/orders/${paymentRaceId}/payment`, "POST", {
      cashTenderedMinorUnits: paymentRaceCreated.value.totalMinorUnits,
    }),
    request(`/api/orders/${paymentRaceId}/payment`, "POST", {
      cashTenderedMinorUnits: paymentRaceCreated.value.totalMinorUnits,
    }),
  ]);
  assert.deepEqual(
    paymentAttempts.map((result) => result.status).sort(),
    [200, 409],
    "Concurrent payment attempts must record exactly one payment.",
  );

  const activeOrders = await request("/api/orders?active=true");
  assert.equal(
    activeOrders.value.some((order) => order.id === orderId),
    false,
    "A paid ready order should leave the active KDS list.",
  );

  const afterReport = await request(`/api/reports/daily?date=${reportDate}`);
  assert.equal(afterReport.value.paidOrderCount, beforeReport.value.paidOrderCount + 2);
  assert.equal(
    afterReport.value.totalMinorUnits,
    beforeReport.value.totalMinorUnits +
      expectedTotal +
      paymentRaceCreated.value.totalMinorUnits,
  );

  const menuChanged = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for menu update event.")),
      3000,
    );
    socket.once("menu:changed", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  const soldOut = await request(
    `/api/menu/items/${fries.id}/availability`,
    "PATCH",
    { isAvailable: false },
  );
  assert.equal(soldOut.status, 200);
  await menuChanged;

  const unavailableMenu = await request("/api/menu");
  assert.equal(
    unavailableMenu.value.flatMap((category) => category.items).some((item) => item.id === fries.id),
    false,
  );
  const adminMenu = await request("/api/menu?includeUnavailable=true");
  assert.equal(adminMenu.status, 200);
  assert.equal(
    adminMenu.value
      .flatMap((category) => category.items)
      .find((item) => item.id === fries.id)?.isAvailable,
    false,
    "Unavailable items should remain identifiable so the kiosk can keep stale basket lines visible.",
  );
  const unavailableOrder = await request("/api/orders", "POST", {
    id: crypto.randomUUID(),
    orderType: "TAKEAWAY",
    items: [{ menuItemId: fries.id, quantity: 1 }],
  });
  assert.equal(unavailableOrder.status, 400);

  const restored = await request(
    `/api/menu/items/${fries.id}/availability`,
    "PATCH",
    { isAvailable: true },
  );
  assert.equal(restored.status, 200);

  console.log("POS smoke test passed.");
  console.log(`Created, edited, approved, prepared, and paid order ${orderId}.`);
  console.log("Input boundaries, concurrency, WebSocket events, menu availability, and reports passed.");
}

main()
  .catch((error) => {
    console.error("POS smoke test failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    socket.disconnect();
  });
