import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCashChange,
  calculateOrderTotal,
  canTransitionOrder,
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
