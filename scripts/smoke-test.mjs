import assert from "node:assert/strict";
import { io } from "socket.io-client";

const apiBase = process.env.VITE_API_URL ?? "http://127.0.0.1:3000";
const socket = io(apiBase, { timeout: 5000 });
const staffCookies = new Map();

async function request(path, method = "GET", body, staffRole) {
  const headers = { "Content-Type": "application/json" };
  if (staffRole) {
    const cookie = staffCookies.get(staffRole);
    assert.ok(cookie, `${staffRole} must sign in before making this request.`);
    headers.Cookie = cookie;
  }
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = response.status === 204 ? undefined : await response.json();
  return { status: response.status, value, headers: response.headers };
}

async function loginAs(role) {
  const result = await request("/api/auth/login", "POST", {
    role,
    pin: process.env[`STAFF_${role}_PIN`] ?? {
      WAITER: "1111",
      KITCHEN: "2222",
      ADMIN: "3333",
    }[role],
  });
  assert.equal(result.status, 200, `${role} sign-in should succeed.`);
  const cookie = result.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie, `${role} sign-in should return a session cookie.`);
  staffCookies.set(role, cookie);
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
  assert.equal(
    (await request("/api/orders/waiter-board")).status,
    401,
    "Staff order boards should require a session.",
  );
  await loginAs("ADMIN");

  const menuResult = await request("/api/menu");
  assert.equal(menuResult.status, 200);
  const menuItems = menuResult.value.flatMap((category) => category.items);
  const burger = menuItems.find((item) => item.name === "Classic Burger");
  const fries = menuItems.find((item) => item.name === "Fries");
  assert.ok(burger && fries, "Seeded demo menu items should be available.");
  const missingMenuItemId = Math.max(...menuItems.map((item) => item.id)) + 1;

  const beforeReport = await request("/api/reports/daily", "GET", undefined, "ADMIN");
  assert.equal(beforeReport.status, 200);
  const reportDate = beforeReport.value.date;
  for (const date of ["0001-01-01", "9999-12-31"]) {
    assert.equal(
      (await request(`/api/reports/daily?date=${date}`, "GET", undefined, "ADMIN")).status,
      200,
      `Valid date boundary ${date} should be accepted.`,
    );
  }
  assert.equal(
    (await request("/api/reports/daily?date=2026-02-31", "GET", undefined, "ADMIN")).status,
    400,
    "Impossible calendar dates should be rejected.",
  );
  assert.equal(
    (await request("/api/reports/daily?date=0000-01-01", "GET", undefined, "ADMIN")).status,
    400,
    "Years outside the database date range should be rejected.",
  );
  assert.equal(
    (await request("/api/reports/daily?date=2026-10-28&date=2026-10-29", "GET", undefined, "ADMIN")).status,
    400,
    "Ambiguous repeated report dates should be rejected.",
  );
  await loginAs("WAITER");
  assert.equal(
    (
      await request("/api/orders/not-a-uuid/status", "PATCH", {
        status: "CANCELLED",
      }, "WAITER")
    ).status,
    400,
    "Malformed order IDs should be rejected as client input.",
  );
  assert.equal(
    (
      await request("/api/orders/not-a-uuid/items", "PATCH", {
        items: [{ menuItemId: fries.id, quantity: 1 }],
      }, "WAITER")
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/orders/not-a-uuid/payment", "POST", {
        cashTenderedMinorUnits: 0,
      }, "WAITER")
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/menu/items/not-an-id/availability", "PATCH", {
        isAvailable: true,
      }, "ADMIN")
    ).status,
    400,
    "Malformed menu item IDs should be rejected as client input.",
  );
  assert.equal(
    (
      await request(`/api/menu/items/${missingMenuItemId}/availability`, "PATCH", {
        isAvailable: true,
      }, "ADMIN")
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
    customerReference: "Sam",
    items: [{ menuItemId: fries.id, quantity: 99 }],
  });
  assert.equal(maximumQuantityOrder.status, 201);
  assert.equal(maximumQuantityOrder.value.items[0].quantity, 99);
  assert.equal(maximumQuantityOrder.value.customerReference, "Sam");
  assert.equal(maximumQuantityOrder.value.businessDate, `${reportDate}T00:00:00.000Z`);
  assert.ok(maximumQuantityOrder.value.orderNumber >= 1);
  const cancelledMaximumOrder = await request(
    `/api/orders/${maximumQuantityId}/status`,
    "PATCH",
    { status: "CANCELLED" },
    "WAITER",
  );
  assert.equal(cancelledMaximumOrder.status, 200);
  assert.equal(
    cancelledMaximumOrder.value.orderNumber,
    maximumQuantityOrder.value.orderNumber,
    "Cancelling an order must preserve its assigned daily reference.",
  );

  const orderId = crypto.randomUUID();
  const orderPayload = {
    id: orderId,
    orderType: "DINE_IN",
    customerReference: "SMOKE",
    items: [
      { menuItemId: burger.id, quantity: 2 },
      { menuItemId: fries.id, quantity: 1 },
    ],
  };
  const created = await request("/api/orders", "POST", orderPayload);
  assert.equal(created.status, 201);
  assert.equal(created.value.totalMinorUnits, burger.priceMinorUnits * 2 + fries.priceMinorUnits);
  assert.equal(created.value.customerReference, "SMOKE");
  assert.equal(created.value.businessDate, `${reportDate}T00:00:00.000Z`);
  assert.ok(created.value.orderNumber > maximumQuantityOrder.value.orderNumber);

  const retry = await request("/api/orders", "POST", orderPayload);
  assert.equal(retry.status, 200);
  assert.equal(retry.value.id, orderId);
  assert.equal(retry.value.orderNumber, created.value.orderNumber);

  const conflictingRetry = await request("/api/orders", "POST", {
    ...orderPayload,
    items: [{ menuItemId: burger.id, quantity: 1 }],
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
  assert.equal(
    concurrentCreates[0].value.orderNumber,
    concurrentCreates[1].value.orderNumber,
    "Concurrent retries with one UUID must preserve one daily reference.",
  );
  assert.equal(concurrentCreates[0].value.businessDate, `${reportDate}T00:00:00.000Z`);

  const distinctConcurrentCreates = await Promise.all(
    [crypto.randomUUID(), crypto.randomUUID()].map((id) =>
      request("/api/orders", "POST", {
        id,
        orderType: "TAKEAWAY",
        items: [{ menuItemId: fries.id, quantity: 1 }],
      }),
    ),
  );
  assert.deepEqual(
    distinctConcurrentCreates.map((result) => result.status),
    [201, 201],
  );
  const concurrentOrderNumbers = distinctConcurrentCreates
    .map((result) => result.value.orderNumber)
    .sort((left, right) => left - right);
  assert.equal(
    concurrentOrderNumbers[1],
    concurrentOrderNumbers[0] + 1,
    "Distinct concurrent orders must receive consecutive numbers.",
  );

  const competingStatuses = await Promise.all([
    request(`/api/orders/${concurrentId}/status`, "PATCH", {
      status: "ACCEPTED",
    }, "WAITER"),
    request(`/api/orders/${concurrentId}/status`, "PATCH", {
      status: "CANCELLED",
    }, "WAITER"),
  ]);
  assert.equal(competingStatuses.filter((result) => result.status === 200).length, 1);
  assert.equal(competingStatuses.filter((result) => result.status === 409).length, 1);
  let racePaidOrderCount = 0;
  let racePaidTotalMinorUnits = 0;
  const raceWinner = competingStatuses.find((result) => result.status === 200);
  const staleStatus = raceWinner.value.status === "ACCEPTED" ? "CANCELLED" : "ACCEPTED";
  assert.equal(
    (await request(`/api/orders/${concurrentId}/status`, "PATCH", {
      status: staleStatus,
    }, "WAITER")).status,
    409,
    "A role-permitted action from a stale order state should return a conflict.",
  );
  if (raceWinner.value.status === "ACCEPTED") {
    await loginAs("KITCHEN");
    for (const status of ["PREPARING", "READY"]) {
      const prepared = await request(`/api/orders/${concurrentId}/status`, "PATCH", {
        status,
      }, "KITCHEN");
      assert.equal(prepared.status, 200);
    }
    await loginAs("WAITER");
    const paidRaceOrder = await request(`/api/orders/${concurrentId}/payment`, "POST", {
      cashTenderedMinorUnits: raceWinner.value.totalMinorUnits,
    }, "WAITER");
    assert.equal(paidRaceOrder.status, 200);
    racePaidOrderCount = 1;
    racePaidTotalMinorUnits = paidRaceOrder.value.totalMinorUnits;
  }

  const edited = await request(`/api/orders/${orderId}/items`, "PATCH", {
    items: [
      { menuItemId: burger.id, quantity: 1, notes: "No onions" },
      { menuItemId: fries.id, quantity: 2, notes: null },
    ],
  }, "WAITER");
  assert.equal(edited.status, 200);
  const expectedTotal = burger.priceMinorUnits + fries.priceMinorUnits * 2;
  assert.equal(edited.value.totalMinorUnits, expectedTotal);

  const invalidTransition = await request(
    `/api/orders/${orderId}/status`,
    "PATCH",
    { status: "PREPARING" },
    "WAITER",
  );
  assert.equal(invalidTransition.status, 403);
  const earlyPayment = await request(`/api/orders/${orderId}/payment`, "POST", {
    cashTenderedMinorUnits: expectedTotal,
  }, "WAITER");
  assert.equal(earlyPayment.status, 409);

  await expectSocketEvent("orders:changed", async () => {
    const approved = await request(`/api/orders/${orderId}/status`, "PATCH", {
      status: "ACCEPTED",
    }, "WAITER");
    assert.equal(approved.status, 200);
  });

  await loginAs("KITCHEN");
  for (const status of ["PREPARING", "READY"]) {
    const updated = await request(`/api/orders/${orderId}/status`, "PATCH", {
      status,
    }, "KITCHEN");
    assert.equal(updated.status, 200);
    assert.equal(updated.value.status, status);
  }

  await loginAs("WAITER");
  const underpaid = await request(`/api/orders/${orderId}/payment`, "POST", {
    cashTenderedMinorUnits: expectedTotal - 1,
  }, "WAITER");
  assert.equal(underpaid.status, 400);

  const tendered = expectedTotal + 500;
  const paid = await request(`/api/orders/${orderId}/payment`, "POST", {
    cashTenderedMinorUnits: tendered,
  }, "WAITER");
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
  for (const status of ["ACCEPTED"]) {
    const changed = await request(`/api/orders/${paymentRaceId}/status`, "PATCH", {
      status,
    }, "WAITER");
    assert.equal(changed.status, 200);
  }
  for (const status of ["PREPARING", "READY"]) {
    const changed = await request(`/api/orders/${paymentRaceId}/status`, "PATCH", {
      status,
    }, "KITCHEN");
    assert.equal(changed.status, 200);
  }
  const paymentAttempts = await Promise.all([
    request(`/api/orders/${paymentRaceId}/payment`, "POST", {
      cashTenderedMinorUnits: paymentRaceCreated.value.totalMinorUnits,
    }, "WAITER"),
    request(`/api/orders/${paymentRaceId}/payment`, "POST", {
      cashTenderedMinorUnits: paymentRaceCreated.value.totalMinorUnits,
    }, "WAITER"),
  ]);
  assert.deepEqual(
    paymentAttempts.map((result) => result.status).sort(),
    [200, 409],
    "Concurrent payment attempts must record exactly one payment.",
  );

  const kdsBoard = await request("/api/orders/kds-board", "GET", undefined, "KITCHEN");
  const visibleKitchenOrders = [
    ...kdsBoard.value.approved,
    ...kdsBoard.value.preparing,
    ...kdsBoard.value.completed,
    ...kdsBoard.value.archive,
  ];
  assert.ok(
    visibleKitchenOrders.some((order) => order.id === orderId),
    "Ready orders remain visible to the kitchen for the rest of the business day.",
  );
  const kitchenOrder = visibleKitchenOrders.find((order) => order.id === orderId);
  assert.equal(kitchenOrder.orderNumber, created.value.orderNumber);

  const waiterBoard = await request("/api/orders/waiter-board", "GET", undefined, "WAITER");
  const waiterOrder = waiterBoard.value.paid.find((order) => order.id === orderId);
  assert.ok(waiterOrder);
  assert.equal(waiterOrder.orderNumber, created.value.orderNumber);
  assert.equal(waiterOrder.customerReference, "SMOKE");
  const afterReport = await request(
    `/api/reports/daily?date=${reportDate}`,
    "GET",
    undefined,
    "ADMIN",
  );
  assert.equal(
    afterReport.value.paidOrderCount,
    beforeReport.value.paidOrderCount + 2 + racePaidOrderCount,
  );
  assert.equal(
    afterReport.value.totalMinorUnits,
    beforeReport.value.totalMinorUnits +
      expectedTotal +
      paymentRaceCreated.value.totalMinorUnits +
      racePaidTotalMinorUnits,
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
    "ADMIN",
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
    "ADMIN",
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
