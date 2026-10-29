export const MAX_CASH_TENDER_MINOR_UNITS = 2_147_483_647;

function parseMinorUnits(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(value.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const total = whole * 100 + fraction;
  return Number.isSafeInteger(total) ? total : null;
}

export function parseCashAmount(value: string): number | null {
  const total = parseMinorUnits(value);
  return total !== null && total <= MAX_CASH_TENDER_MINOR_UNITS
    ? total
    : null;
}

export function applyCashKey(
  amount: string,
  key: string,
): { amount: string; error: string | null } {
  if (key === "clear") return { amount: "", error: null };
  if (key === "backspace") {
    return { amount: amount.slice(0, -1), error: null };
  }
  if (key === ".") {
    return {
      amount: amount.includes(".") ? amount : `${amount || "0"}.`,
      error: null,
    };
  }
  if (!/^\d$/.test(key)) return { amount, error: "Invalid keypad key." };
  if (amount.includes(".") && (amount.split(".")[1]?.length ?? 0) >= 2) {
    return { amount, error: "Enter no more than two decimal places." };
  }

  const next = `${amount}${key}`;
  if (next.length > 13) {
    return {
      amount,
      error: "Cash amount is above the supported limit.",
    };
  }
  const total = parseMinorUnits(next);
  if (total === null || total > MAX_CASH_TENDER_MINOR_UNITS) {
    return {
      amount,
      error: "Cash amount is above the supported limit.",
    };
  }
  return { amount: next, error: null };
}
