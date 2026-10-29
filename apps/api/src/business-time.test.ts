import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  restaurantBusinessDate,
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
});
