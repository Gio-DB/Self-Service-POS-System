import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  restaurantBusinessDate,
  startOfRestaurantBusinessDate,
  startOfRestaurantBusinessDay,
} from "./business-time.js";

describe("restaurant business time", () => {
  it("calculates Berlin business days across daylight-saving changes", () => {
    const timeZone = "Europe/Berlin";
    const summerDay = new Date("2026-06-02T12:00:00.000Z");
    assert.equal(restaurantBusinessDate(summerDay, timeZone), "2026-06-02");
    assert.deepEqual(
      startOfRestaurantBusinessDay(summerDay, timeZone),
      new Date("2026-06-01T22:00:00.000Z"),
    );

    const dstStart = new Date("2026-03-29T10:00:00.000Z");
    assert.deepEqual(
      startOfRestaurantBusinessDay(dstStart, timeZone),
      new Date("2026-03-28T23:00:00.000Z"),
    );
  });

  it("resets the business date at local midnight", () => {
    const timeZone = "Europe/Berlin";
    assert.equal(
      restaurantBusinessDate(new Date("2026-03-28T22:59:59.999Z"), timeZone),
      "2026-03-28",
    );
    assert.equal(
      restaurantBusinessDate(new Date("2026-03-28T23:00:00.000Z"), timeZone),
      "2026-03-29",
    );
    assert.equal(
      restaurantBusinessDate(new Date("2026-10-25T22:59:59.999Z"), timeZone),
      "2026-10-25",
    );
    assert.equal(
      restaurantBusinessDate(new Date("2026-10-25T23:00:00.000Z"), timeZone),
      "2026-10-26",
    );
  });

  it("maps a selected restaurant business date to its local-midnight boundaries", () => {
    const timeZone = "Europe/Berlin";
    const springStart = startOfRestaurantBusinessDate(
      new Date("2026-03-29T00:00:00.000Z"),
      timeZone,
    );
    const springEnd = startOfRestaurantBusinessDate(
      new Date("2026-03-30T00:00:00.000Z"),
      timeZone,
    );
    const autumnStart = startOfRestaurantBusinessDate(
      new Date("2026-10-25T00:00:00.000Z"),
      timeZone,
    );
    const autumnEnd = startOfRestaurantBusinessDate(
      new Date("2026-10-26T00:00:00.000Z"),
      timeZone,
    );

    assert.deepEqual(springStart, new Date("2026-03-28T23:00:00.000Z"));
    assert.deepEqual(springEnd, new Date("2026-03-29T22:00:00.000Z"));
    assert.equal(springEnd.getTime() - springStart.getTime(), 23 * 60 * 60 * 1_000);
    assert.deepEqual(autumnStart, new Date("2026-10-24T22:00:00.000Z"));
    assert.deepEqual(autumnEnd, new Date("2026-10-25T23:00:00.000Z"));
    assert.equal(autumnEnd.getTime() - autumnStart.getTime(), 25 * 60 * 60 * 1_000);
  });

  it("handles dates before the JavaScript Date.UTC 0-99 year special case", () => {
    assert.deepEqual(
      startOfRestaurantBusinessDate(
        new Date("0001-01-01T00:00:00.000Z"),
        "Europe/Berlin",
      ),
      new Date("0000-12-31T23:06:32.000Z"),
    );
  });
});
