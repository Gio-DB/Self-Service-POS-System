export const orderStatuses = [
  "PENDING_REVIEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCELLED",
] as const;

export const maxDailyOrderNumber = 99_999;

export type OrderStatus = (typeof orderStatuses)[number];
export type OrderStaffRole = "WAITER" | "KITCHEN" | "ADMIN";

const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_REVIEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["SERVED"],
  SERVED: [],
  CANCELLED: [],
};

export function canTransitionOrder(
  current: OrderStatus,
  next: OrderStatus,
): boolean {
  return current === next || allowedTransitions[current].includes(next);
}

export function canRoleRequestOrderStatus(
  role: OrderStaffRole,
  status: OrderStatus,
): boolean {
  if (role === "WAITER") {
    return status === "ACCEPTED" || status === "SERVED" || status === "CANCELLED";
  }
  if (role === "KITCHEN") {
    return status === "PREPARING" || status === "READY";
  }
  return false;
}

export function canRoleTransitionOrder(
  role: OrderStaffRole,
  current: OrderStatus,
  next: OrderStatus,
): boolean {
  if (!canTransitionOrder(current, next)) return false;
  if (role === "WAITER") {
    return (
      (current === "PENDING_REVIEW" &&
        (next === "ACCEPTED" || next === "CANCELLED")) ||
      (current === "READY" && next === "SERVED")
    );
  }
  if (role === "KITCHEN") {
    return (
      (current === "ACCEPTED" && next === "PREPARING") ||
      (current === "PREPARING" && next === "READY")
    );
  }
  return false;
}

export function nextDailyOrderNumber(lastNumber: number): number | null {
  if (!Number.isInteger(lastNumber) || lastNumber < 0 || lastNumber > maxDailyOrderNumber) {
    throw new Error("Daily order counter is outside the supported range.");
  }
  return lastNumber === maxDailyOrderNumber ? null : lastNumber + 1;
}

export function calculateCashChange(
  totalMinorUnits: number,
  cashTenderedMinorUnits: number,
): number {
  if (!Number.isSafeInteger(totalMinorUnits) || totalMinorUnits < 0) {
    throw new Error("Order total must be a non-negative integer.");
  }
  if (
    !Number.isSafeInteger(cashTenderedMinorUnits) ||
    cashTenderedMinorUnits < totalMinorUnits
  ) {
    throw new Error("Cash tendered must cover the order total.");
  }
  return cashTenderedMinorUnits - totalMinorUnits;
}

export function calculateOrderTotal(
  lines: readonly { priceMinorUnits: number; quantity: number }[],
): number {
  let total = 0;
  for (const line of lines) {
    if (
      !Number.isSafeInteger(line.priceMinorUnits) ||
      line.priceMinorUnits < 0 ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1
    ) {
      throw new Error("Order lines must have valid integer prices and quantities.");
    }
    total += line.priceMinorUnits * line.quantity;
    if (!Number.isSafeInteger(total) || total > 2_147_483_647) {
      throw new Error("Order total exceeds the supported range.");
    }
  }
  return total;
}

export function sameOrderLines(
  left: readonly {
    menuItemId: number | null;
    quantity: number;
    notes: string | null;
  }[],
  right: readonly {
    menuItemId: number;
    quantity: number;
    notes: string | null;
  }[],
): boolean {
  const normalize = (
    lines: readonly {
      menuItemId: number | null;
      quantity: number;
      notes: string | null;
    }[],
  ) =>
    lines
      .map(
        (line) =>
          `${line.menuItemId}:${line.quantity}:${line.notes ?? ""}`,
      )
      .sort();

  const leftLines = normalize(left);
  const rightLines = normalize(right);
  return (
    leftLines.length === rightLines.length &&
    leftLines.every((line, index) => line === rightLines[index])
  );
}
