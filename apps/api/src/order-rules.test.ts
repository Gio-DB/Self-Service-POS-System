import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCashChange,
  calculateOrderTotal,
  canRoleRequestOrderStatus,
  canRoleTransitionOrder,
  canTransitionOrder,
  nextDailyOrderNumber,
  sameOrderLines,
} from "./order-rules.js";

describe("order rules", () => {
  it("allows only the intended order status transitions", () => {
    assert.equal(canTransitionOrder("PENDING_REVIEW", "ACCEPTED"), true);
    assert.equal(canTransitionOrder("ACCEPTED", "PREPARING"), true);
    assert.equal(canTransitionOrder("PREPARING", "READY"), true);
    assert.equal(canTransitionOrder("READY", "PREPARING"), false);
    assert.equal(canTransitionOrder("CANCELLED", "ACCEPTED"), false);
  });

  it("limits the statuses each staff role may request", () => {
    assert.equal(canRoleRequestOrderStatus("WAITER", "ACCEPTED"), true);
    assert.equal(canRoleRequestOrderStatus("WAITER", "CANCELLED"), true);
    assert.equal(canRoleRequestOrderStatus("WAITER", "PREPARING"), false);
    assert.equal(canRoleRequestOrderStatus("KITCHEN", "PREPARING"), true);
    assert.equal(canRoleRequestOrderStatus("KITCHEN", "READY"), true);
    assert.equal(canRoleRequestOrderStatus("KITCHEN", "ACCEPTED"), false);
  });

  it("rejects stale transitions even when the target is normally allowed for the role", () => {
    assert.equal(canRoleTransitionOrder("WAITER", "PENDING_REVIEW", "ACCEPTED"), true);
    assert.equal(canRoleTransitionOrder("WAITER", "ACCEPTED", "CANCELLED"), false);
    assert.equal(canRoleTransitionOrder("WAITER", "ACCEPTED", "ACCEPTED"), false);
    assert.equal(canRoleTransitionOrder("KITCHEN", "ACCEPTED", "PREPARING"), true);
    assert.equal(canRoleTransitionOrder("KITCHEN", "ACCEPTED", "READY"), false);
  });

  it("allocates daily references up to the five-digit limit", () => {
    assert.equal(nextDailyOrderNumber(0), 1);
    assert.equal(nextDailyOrderNumber(1), 2);
    assert.equal(nextDailyOrderNumber(99_998), 99_999);
    assert.equal(nextDailyOrderNumber(99_999), null);
    assert.throws(() => nextDailyOrderNumber(-1), /outside the supported range/);
    assert.throws(() => nextDailyOrderNumber(100_000), /outside the supported range/);
  });

  it("calculates totals using integer minor units", () => {
    assert.equal(
      calculateOrderTotal([
        { priceMinorUnits: 1299, quantity: 2 },
        { priceMinorUnits: 399, quantity: 1 },
      ]),
      2997,
    );
  });

  it("rejects totals outside the database integer range", () => {
    assert.throws(() =>
      calculateOrderTotal([
        { priceMinorUnits: 2_147_483_647, quantity: 2 },
      ]),
      /Order total exceeds the supported range/,
    );
    assert.equal(
      calculateOrderTotal([{ priceMinorUnits: 2_147_483_647, quantity: 1 }]),
      2_147_483_647,
    );
  });

  it("rejects invalid line prices and quantities", () => {
    assert.throws(
      () => calculateOrderTotal([{ priceMinorUnits: -1, quantity: 1 }]),
      /valid integer prices and quantities/,
    );
    assert.throws(
      () => calculateOrderTotal([{ priceMinorUnits: 100, quantity: 0 }]),
      /valid integer prices and quantities/,
    );
    assert.throws(
      () => calculateOrderTotal([{ priceMinorUnits: 100.5, quantity: 1 }]),
      /valid integer prices and quantities/,
    );
  });

  it("calculates cash change and rejects insufficient tender", () => {
    assert.equal(calculateCashChange(1299, 2000), 701);
    assert.equal(calculateCashChange(1299, 1299), 0);
    assert.throws(
      () => calculateCashChange(1299, 1298),
      /Cash tendered must cover the order total/,
    );
    assert.throws(
      () => calculateCashChange(-1, 0),
      /Order total must be a non-negative integer/,
    );
    assert.throws(
      () => calculateCashChange(0, Number.MAX_SAFE_INTEGER + 1),
      /Cash tendered must cover the order total/,
    );
  });

  it("treats line order as irrelevant for idempotent request comparison", () => {
    assert.equal(
      sameOrderLines(
        [
          { menuItemId: 2, quantity: 1, notes: null },
          { menuItemId: 1, quantity: 2, notes: "No onions" },
        ],
        [
          { menuItemId: 1, quantity: 2, notes: "No onions" },
          { menuItemId: 2, quantity: 1, notes: null },
        ],
      ),
      true,
    );
    assert.equal(
      sameOrderLines(
        [{ menuItemId: 1, quantity: 1, notes: null }],
        [{ menuItemId: 1, quantity: 2, notes: null }],
      ),
      false,
    );
  });
});
