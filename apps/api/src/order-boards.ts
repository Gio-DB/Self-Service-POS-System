export type BoardOrder = {
  status: string;
  paymentStatus: string;
  createdAt: Date;
  paidAt: Date | null;
  approvedAt: Date | null;
};

export type WaiterOrderBoard<T extends BoardOrder> = {
  awaitingReview: T[];
  active: T[];
  paid: T[];
  archive: T[];
};

export type KdsOrderBoard<T extends BoardOrder> = {
  approved: T[];
  preparing: T[];
  completed: T[];
  archive: T[];
};

function oldestFirst<T extends BoardOrder>(left: T, right: T): number {
  return left.createdAt.getTime() - right.createdAt.getTime();
}

function newestCreatedFirst<T extends BoardOrder>(left: T, right: T): number {
  return right.createdAt.getTime() - left.createdAt.getTime();
}

function newestPaidFirst<T extends BoardOrder>(left: T, right: T): number {
  return (right.paidAt?.getTime() ?? 0) - (left.paidAt?.getTime() ?? 0);
}

function oldestApprovedFirst<T extends BoardOrder>(left: T, right: T): number {
  return (left.approvedAt?.getTime() ?? left.createdAt.getTime()) -
    (right.approvedAt?.getTime() ?? right.createdAt.getTime());
}

export function createWaiterOrderBoard<T extends BoardOrder>(
  orders: readonly T[],
  startOfBusinessDay: Date,
): WaiterOrderBoard<T> {
  const board: WaiterOrderBoard<T> = {
    awaitingReview: [],
    active: [],
    paid: [],
    archive: [],
  };
  for (const order of orders) {
    if (order.createdAt < startOfBusinessDay) {
      board.archive.push(order);
    } else if (order.status === "PENDING_REVIEW") {
      board.awaitingReview.push(order);
    } else if (order.paymentStatus === "PAID") {
      board.paid.push(order);
    } else if (["ACCEPTED", "PREPARING", "READY"].includes(order.status)) {
      board.active.push(order);
    }
  }
  board.awaitingReview.sort(oldestFirst);
  board.active.sort(oldestFirst);
  board.paid.sort(newestPaidFirst);
  board.archive.sort(newestCreatedFirst);
  return board;
}

export function createKdsOrderBoard<T extends BoardOrder>(
  orders: readonly T[],
  startOfBusinessDay: Date,
): KdsOrderBoard<T> {
  const board: KdsOrderBoard<T> = {
    approved: [],
    preparing: [],
    completed: [],
    archive: [],
  };
  for (const order of orders) {
    if (!["ACCEPTED", "PREPARING", "READY"].includes(order.status)) continue;
    if (order.createdAt < startOfBusinessDay) {
      board.archive.push(order);
    } else if (order.status === "ACCEPTED") {
      board.approved.push(order);
    } else if (order.status === "PREPARING") {
      board.preparing.push(order);
    } else {
      board.completed.push(order);
    }
  }
  board.approved.sort(oldestApprovedFirst);
  board.preparing.sort(oldestApprovedFirst);
  board.completed.sort(oldestApprovedFirst);
  board.archive.sort(newestCreatedFirst);
  return board;
}
