const apiBase = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3000";

export const MAX_ORDER_ITEM_QUANTITY = 99;

export type MenuItem = {
  id: number;
  name: string;
  priceMinorUnits: number;
  isAvailable: boolean;
};

export type MenuCategory = {
  id: number;
  name: string;
  items: MenuItem[];
};

export type OrderItem = {
  id: number;
  menuItemId: number | null;
  itemName: string;
  quantity: number;
  unitPriceMinorUnits: number;
  notes: string | null;
};

export type Order = {
  id: string;
  orderType: "TAKEAWAY" | "DINE_IN";
  tableNumber: string | null;
  status: "PENDING_REVIEW" | "ACCEPTED" | "PREPARING" | "READY" | "CANCELLED";
  paymentStatus: "UNPAID" | "PAID";
  totalMinorUnits: number;
  cashTenderedMinorUnits: number | null;
  changeDueMinorUnits: number | null;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  items: OrderItem[];
};

export type StaffRole = "WAITER" | "KITCHEN" | "ADMIN";

export type StaffSession = {
  role: StaffRole;
  expiresAt: string;
};

export type WaiterOrderBoard = {
  awaitingReview: Order[];
  active: Order[];
  paid: Order[];
  archive: Order[];
};

export type KdsOrderBoard = {
  approved: Order[];
  preparing: Order[];
  completed: Order[];
  archive: Order[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new ApiError(
      body?.error ?? `Request failed (${response.status}).`,
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  getMenu: (includeUnavailable = false) =>
    request<MenuCategory[]>(
      `/api/menu${includeUnavailable ? "?includeUnavailable=true" : ""}`,
    ),
  getWaiterOrderBoard: () => request<WaiterOrderBoard>("/api/orders/waiter-board"),
  getKdsOrderBoard: () => request<KdsOrderBoard>("/api/orders/kds-board"),
  createOrder: (body: {
    id: string;
    orderType: "TAKEAWAY" | "DINE_IN";
    tableNumber: string | null;
    items: { menuItemId: number; quantity: number }[];
  }) =>
    request<Order>("/api/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateItems: (
    orderId: string,
    items: { menuItemId: number; quantity: number; notes: string | null }[],
  ) =>
    request<Order>(`/api/orders/${orderId}/items`, {
      method: "PATCH",
      body: JSON.stringify({ items }),
    }),
  updateStatus: (orderId: string, status: Order["status"]) =>
    request<Order>(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  payOrder: (orderId: string, cashTenderedMinorUnits: number) =>
    request<Order>(`/api/orders/${orderId}/payment`, {
      method: "POST",
      body: JSON.stringify({ cashTenderedMinorUnits }),
    }),
  setAvailability: (itemId: number, isAvailable: boolean) =>
    request<MenuItem>(`/api/menu/items/${itemId}/availability`, {
      method: "PATCH",
      body: JSON.stringify({ isAvailable }),
    }),
  getDailyReport: (date: string) =>
    request<{
      date: string;
      paidOrderCount: number;
      totalMinorUnits: number;
    }>(`/api/reports/daily?date=${encodeURIComponent(date)}`),
  login: (role: StaffRole, pin: string) =>
    request<{ role: StaffRole }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ role, pin }),
    }),
  getSession: () => request<StaffSession>("/api/auth/session"),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
};

export const socketUrl = apiBase;
