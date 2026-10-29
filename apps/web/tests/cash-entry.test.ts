import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCashKey,
  MAX_CASH_TENDER_MINOR_UNITS,
  parseCashAmount,
} from "../src/cash-entry.js";

describe("cash keypad entry", () => {
  it("builds a decimal amount and limits it to two fraction digits", () => {
    let amount = "";
    for (const key of ["2", "0", ".", "5", "0"]) {
      const result = applyCashKey(amount, key);
      assert.equal(result.error, null);
      amount = result.amount;
    }
    assert.equal(amount, "20.50");
    assert.equal(parseCashAmount(amount), 2050);

    const extraFractionDigit = applyCashKey(amount, "1");
    assert.equal(extraFractionDigit.amount, amount);
    assert.match(extraFractionDigit.error ?? "", /two decimal places/);
  });

  it("supports clear, backspace, and a single decimal point", () => {
    assert.deepEqual(applyCashKey("12.3", "backspace"), {
      amount: "12.",
      error: null,
    });
    assert.deepEqual(applyCashKey("12.", "."), {
      amount: "12.",
      error: null,
    });
    assert.deepEqual(applyCashKey("12.3", "clear"), {
      amount: "",
      error: null,
    });
  });

  it("accepts the maximum supported amount and rejects values above it", () => {
    assert.equal(parseCashAmount("21474836.47"), MAX_CASH_TENDER_MINOR_UNITS);
    assert.equal(parseCashAmount("21474836.48"), null);
    assert.equal(
      applyCashKey("21474836.4", "8").amount,
      "21474836.4",
    );
    assert.match(
      applyCashKey("21474836.4", "8").error ?? "",
      /supported limit/,
    );
  });

  it("rejects malformed or unsafe cash amounts", () => {
    for (const value of ["", "1.234", "-1", "1,00", "90071992547409"]) {
      assert.equal(parseCashAmount(value), null, value);
    }
  });
});
