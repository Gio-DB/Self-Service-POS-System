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
  paidAt: string | null;
  items: OrderItem[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  getMenu: (includeUnavailable = false) =>
    request<MenuCategory[]>(
      `/api/menu${includeUnavailable ? "?includeUnavailable=true" : ""}`,
    ),
  getOrders: (active = false) =>
    request<Order[]>(`/api/orders${active ? "?active=true" : ""}`),
  createOrder: (body: {
    id: string;
    orderType: "TAKEAWAY" | "DINE_IN";
    tableNumber: string | null;
    items: { menuItemId: number; quantity: number; notes: string | null }[];
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
};

export const socketUrl = apiBase;
