import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createKdsOrderBoard,
  createWaiterOrderBoard,
  type BoardOrder,
} from "./order-boards.js";

type TestOrder = BoardOrder & { id: string };

function order(id: string, values: Partial<TestOrder> = {}): TestOrder {
  return {
    id,
    status: "PENDING_REVIEW",
    paymentStatus: "UNPAID",
    createdAt: new Date("2026-10-29T09:00:00.000Z"),
    paidAt: null,
    approvedAt: null,
    ...values,
  };
}

describe("order boards", () => {
  const dayStart = new Date("2026-10-29T00:00:00.000Z");

  it("uses the order creation date to prioritize the waiter archive", () => {
    const board = createWaiterOrderBoard([
      order("late-paid", {
        status: "READY",
        paymentStatus: "PAID",
        createdAt: new Date("2026-10-28T23:59:00.000Z"),
        paidAt: new Date("2026-10-29T08:00:00.000Z"),
      }),
      order("pending-later", { createdAt: new Date("2026-10-29T10:00:00.000Z") }),
      order("pending-earlier", { createdAt: new Date("2026-10-29T08:00:00.000Z") }),
      order("active", { status: "PREPARING" }),
      order("ready-active", { status: "READY" }),
      order("served", { status: "SERVED" }),
      order("paid-earlier", {
        status: "READY",
        paymentStatus: "PAID",
        paidAt: new Date("2026-10-29T11:00:00.000Z"),
      }),
      order("paid-later", {
        status: "READY",
        paymentStatus: "PAID",
        paidAt: new Date("2026-10-29T12:00:00.000Z"),
      }),
      order("cancelled", { status: "CANCELLED" }),
    ], dayStart);

    assert.deepEqual(board.awaitingReview.map(({ id }) => id), ["pending-earlier", "pending-later"]);
    assert.deepEqual(board.active.map(({ id }) => id), ["active", "ready-active"]);
    assert.deepEqual(board.served.map(({ id }) => id), ["served"]);
    assert.deepEqual(board.paid.map(({ id }) => id), ["paid-later", "paid-earlier"]);
    assert.deepEqual(board.archive.map(({ id }) => id), ["late-paid"]);
    assert.deepEqual(Object.keys(board), [
      "awaitingReview",
      "active",
      "served",
      "paid",
      "archive",
    ]);
  });

  it("keeps only approved kitchen work and sorts it by approval time", () => {
    const board = createKdsOrderBoard([
      order("unapproved"),
      order("completed", {
        status: "READY",
        approvedAt: new Date("2026-10-29T09:00:00.000Z"),
      }),
      order("approved-later", {
        status: "ACCEPTED",
        approvedAt: new Date("2026-10-29T10:00:00.000Z"),
      }),
      order("approved-earlier", {
        status: "ACCEPTED",
        approvedAt: new Date("2026-10-29T08:00:00.000Z"),
      }),
      order("old-preparing", {
        status: "PREPARING",
        createdAt: new Date("2026-10-28T20:00:00.000Z"),
      }),
      order("cancelled", { status: "CANCELLED" }),
    ], dayStart);

    assert.deepEqual(board.approved.map(({ id }) => id), ["approved-earlier", "approved-later"]);
    assert.deepEqual(board.preparing, []);
    assert.deepEqual(board.completed.map(({ id }) => id), ["completed"]);
    assert.deepEqual(board.archive.map(({ id }) => id), ["old-preparing"]);
  });
});
