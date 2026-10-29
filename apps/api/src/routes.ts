import { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { Router } from "express";
import { z } from "zod";
import {
  createStaffSessionToken,
  getStaffSession,
  pinMatches,
  readStaffAuthConfig,
  requireStaffRole,
  staffRoles,
  staffSessionCookie,
  staffSessionCookieOptions,
} from "./auth.js";
import {
  restaurantTimeZone,
  startOfRestaurantBusinessDay,
} from "./business-time.js";
import { HttpError } from "./errors.js";
import { createKdsOrderBoard, createWaiterOrderBoard } from "./order-boards.js";
import {
  calculateCashChange,
  calculateOrderTotal,
  canTransitionOrder,
  orderStatuses,
  sameOrderLines,
  type OrderStatus,
} from "./order-rules.js";

const orderInclude = { items: { orderBy: { id: "asc" as const } } };
const maxInteger = 2_147_483_647;
const orderIdSchema = z.string().uuid();

export type RealtimeEvents = {
  emit: (eventName: string) => unknown;
};

const customerOrderItemSchema = z.object({
  menuItemId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99),
}).strict();

const waiterOrderItemSchema = z.object({
  menuItemId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().trim().max(200).optional().nullable(),
}).strict();

const orderInputSchema = z.object({
  id: z.string().uuid(),
  orderType: z.enum(["TAKEAWAY", "DINE_IN"]),
  tableNumber: z.string().trim().max(30).optional().nullable(),
  items: z.array(customerOrderItemSchema).min(1).max(50),
}).strict();

const updateItemsSchema = z.object({
  items: z.array(waiterOrderItemSchema).min(1).max(50),
}).strict();

const statusSchema = z.object({
  status: z.enum(orderStatuses),
});

const paymentSchema = z.object({
  cashTenderedMinorUnits: z.number().int().min(0).max(maxInteger),
});

const loginSchema = z.object({
  role: z.enum(staffRoles),
  pin: z.string().min(1).max(128),
}).strict();

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  return parsed.data;
}

export function parseCustomerOrderInput(value: unknown) {
  return parseOrThrow(orderInputSchema, value);
}

function orderLinesForComparison(
  items: readonly {
    menuItemId: number | null;
    quantity: number;
    notes: string | null;
  }[],
) {
  return items.map(({ menuItemId, quantity, notes }) => ({
    menuItemId,
    quantity,
    notes,
  }));
}

function clientLinesForComparison(
  items: readonly {
    menuItemId: number;
    quantity: number;
    notes?: string | null;
  }[],
) {
  return items.map(({ menuItemId, quantity, notes }) => ({
    menuItemId,
    quantity,
    notes: notes?.trim() || null,
  }));
}

async function fetchMenuLines(
  prisma: PrismaClient,
  items: readonly {
    menuItemId: number;
    quantity: number;
    notes?: string | null;
  }[],
) {
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: [...new Set(items.map((item) => item.menuItemId))] },
      isAvailable: true,
    },
  });
  const itemById = new Map(menuItems.map((item) => [item.id, item]));
  if (items.some((item) => !itemById.has(item.menuItemId))) {
    throw new HttpError(400, "One or more selected menu items are unavailable.");
  }

  const lines = items.map((item) => {
    const menuItem = itemById.get(item.menuItemId);
    if (!menuItem) {
      throw new HttpError(400, "One or more selected menu items are unavailable.");
    }
    return {
      menuItemId: menuItem.id,
      itemName: menuItem.name,
      unitPriceMinorUnits: menuItem.priceMinorUnits,
      quantity: item.quantity,
      notes: item.notes?.trim() || null,
    };
  });

  let totalMinorUnits: number;
  try {
    totalMinorUnits = calculateOrderTotal(
      lines.map(({ unitPriceMinorUnits, quantity }) => ({
        priceMinorUnits: unitPriceMinorUnits,
        quantity,
      })),
    );
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "Invalid order total.",
    );
  }

  return { lines, totalMinorUnits };
}

export function createApiRouter(prisma: PrismaClient, events: RealtimeEvents) {
  const router = Router();
  const authConfig = readStaffAuthConfig();
  const timeZone = restaurantTimeZone();

  router.post("/auth/login", (request, response) => {
    const input = parseOrThrow(loginSchema, request.body);
    if (!pinMatches(input.pin, authConfig.pins[input.role])) {
      throw new HttpError(401, "Invalid staff PIN.");
    }
    const token = createStaffSessionToken(input.role, authConfig);
    response.cookie(staffSessionCookie, token, staffSessionCookieOptions(authConfig));
    response.json({ role: input.role });
  });

  router.get("/auth/session", (request, response) => {
    const session = getStaffSession(request, authConfig);
    if (!session) throw new HttpError(401, "Staff sign-in is required.");
    response.json({
      role: session.role,
      expiresAt: session.expiresAt.toISOString(),
    });
  });

  router.post("/auth/logout", (_request, response) => {
    response.clearCookie(staffSessionCookie, staffSessionCookieOptions(authConfig));
    response.status(204).end();
  });

  router.get("/menu", async (request, response) => {
    const includeUnavailable = request.query.includeUnavailable === "true";
    const categories = await prisma.menuCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        items: {
          where: includeUnavailable ? undefined : { isAvailable: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            priceMinorUnits: true,
            isAvailable: true,
          },
        },
      },
    });
    response.json(categories);
  });

  router.patch("/menu/items/:id/availability", async (request, response) => {
    requireStaffRole(request, authConfig, "ADMIN");
    const rawId = request.params.id;
    const body = parseOrThrow(
      z.object({ isAvailable: z.boolean() }),
      request.body,
    );
    const id = Number(rawId);
    if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id < 1) {
      throw new HttpError(400, "Menu item ID must be a positive integer.");
    }
    const item = await prisma.menuItem.update({
      where: { id },
      data: { isAvailable: body.isAvailable },
    }).catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new HttpError(404, "Menu item not found.");
      }
      throw error;
    });
    events.emit("menu:changed");
    response.json(item);
  });

  router.get("/orders/waiter-board", async (request, response) => {
    requireStaffRole(request, authConfig, "WAITER");
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "asc" },
      include: orderInclude,
    });
    response.json(createWaiterOrderBoard(
      orders,
      startOfRestaurantBusinessDay(new Date(), timeZone),
    ));
  });

  router.get("/orders/kds-board", async (request, response) => {
    requireStaffRole(request, authConfig, "KITCHEN");
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "asc" },
      include: orderInclude,
    });
    response.json(createKdsOrderBoard(
      orders,
      startOfRestaurantBusinessDay(new Date(), timeZone),
    ));
  });

  router.post("/orders", async (request, response) => {
    const input = parseCustomerOrderInput(request.body);
    const existing = await prisma.order.findUnique({
      where: { id: input.id },
      include: orderInclude,
    });
    const requestedItems = clientLinesForComparison(input.items);
    if (existing) {
      if (
        existing.orderType !== input.orderType ||
        existing.tableNumber !== (input.tableNumber?.trim() || null) ||
        !sameOrderLines(
          orderLinesForComparison(existing.items),
          requestedItems,
        )
      ) {
        throw new HttpError(
          409,
          "This order ID was already used for a different order.",
        );
      }
      response.status(200).json(existing);
      return;
    }

    const { lines, totalMinorUnits } = await fetchMenuLines(prisma, input.items);
    try {
      const order = await prisma.order.create({
        data: {
          id: input.id,
          orderType: input.orderType,
          tableNumber: input.tableNumber?.trim() || null,
          totalMinorUnits,
          items: { create: lines },
        },
        include: orderInclude,
      });
      response.status(201).json(order);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const concurrentOrder = await prisma.order.findUnique({
          where: { id: input.id },
          include: orderInclude,
        });
        if (
          concurrentOrder &&
          concurrentOrder.orderType === input.orderType &&
          concurrentOrder.tableNumber === (input.tableNumber?.trim() || null) &&
          sameOrderLines(
            orderLinesForComparison(concurrentOrder.items),
            requestedItems,
          )
        ) {
          response.status(200).json(concurrentOrder);
          return;
        }
        throw new HttpError(409, "This order ID has already been used.");
      }
      throw error;
    }
  });

  router.patch("/orders/:id/items", async (request, response) => {
    requireStaffRole(request, authConfig, "WAITER");
    const input = parseOrThrow(updateItemsSchema, request.body);
    const orderId = parseOrThrow(orderIdSchema, request.params.id);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new HttpError(404, "Order not found.");
    if (order.status !== "PENDING_REVIEW") {
      throw new HttpError(409, "Only orders awaiting review can be edited.");
    }
    const { lines, totalMinorUnits } = await fetchMenuLines(prisma, input.items);
    const updated = await prisma.$transaction(async (transaction) => {
      const changed = await transaction.order.updateMany({
        where: { id: order.id, status: "PENDING_REVIEW" },
        data: { totalMinorUnits },
      });
      if (changed.count !== 1) {
        throw new HttpError(409, "The order changed and can no longer be edited.");
      }
      await transaction.orderItem.deleteMany({ where: { orderId: order.id } });
      await transaction.orderItem.createMany({
        data: lines.map((line) => ({ ...line, orderId: order.id })),
      });
      return transaction.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
    });
    events.emit("orders:changed");
    response.json(updated);
  });

  router.patch("/orders/:id/status", async (request, response) => {
    const session = requireStaffRole(request, authConfig, "WAITER", "KITCHEN");
    const input = parseOrThrow(statusSchema, request.body);
    const orderId = parseOrThrow(orderIdSchema, request.params.id);
    const current = await prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!current) throw new HttpError(404, "Order not found.");
    const waiterTransition =
      current.status === "PENDING_REVIEW" &&
      (input.status === "ACCEPTED" || input.status === "CANCELLED");
    const kitchenTransition =
      (current.status === "ACCEPTED" && input.status === "PREPARING") ||
      (current.status === "PREPARING" && input.status === "READY");
    if (
      (session.role === "WAITER" && !waiterTransition) ||
      (session.role === "KITCHEN" && !kitchenTransition)
    ) {
      throw new HttpError(403, "Your staff role is not permitted to make this status change.");
    }
    if (
      !canTransitionOrder(
        current.status as OrderStatus,
        input.status as OrderStatus,
      )
    ) {
      throw new HttpError(
        409,
        `Order cannot move from ${current.status} to ${input.status}.`,
      );
    }
    const changed = await prisma.order.updateMany({
      where: { id: current.id, status: current.status },
      data: {
        status: input.status,
        ...(current.status === "PENDING_REVIEW" && input.status === "ACCEPTED"
          ? { approvedAt: new Date() }
          : {}),
      },
    });
    if (changed.count !== 1) {
      throw new HttpError(409, "The order changed; refresh and try again.");
    }
    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: current.id },
      include: orderInclude,
    });
    events.emit("orders:changed");
    response.json(updated);
  });

  router.post("/orders/:id/payment", async (request, response) => {
    requireStaffRole(request, authConfig, "WAITER");
    const input = parseOrThrow(paymentSchema, request.body);
    const orderId = parseOrThrow(orderIdSchema, request.params.id);
    const current = await prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!current) throw new HttpError(404, "Order not found.");
    if (current.status !== "READY" || current.paymentStatus !== "UNPAID") {
      throw new HttpError(409, "Only unpaid ready orders can be paid.");
    }
    let changeDueMinorUnits: number;
    try {
      changeDueMinorUnits = calculateCashChange(
        current.totalMinorUnits,
        input.cashTenderedMinorUnits,
      );
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Invalid cash tender.",
      );
    }
    const payment = await prisma.$transaction(async (transaction) => {
      const result = await transaction.order.updateMany({
        where: {
          id: current.id,
          status: "READY",
          paymentStatus: "UNPAID",
        },
        data: {
          paymentStatus: "PAID",
          cashTenderedMinorUnits: input.cashTenderedMinorUnits,
          changeDueMinorUnits,
          paidAt: new Date(),
        },
      });
      if (result.count !== 1) {
        throw new HttpError(409, "The order has already been paid or changed.");
      }
      return transaction.order.findUniqueOrThrow({
        where: { id: current.id },
        include: orderInclude,
      });
    });
    events.emit("orders:changed");
    response.json(payment);
  });

  router.get("/reports/daily", async (request, response) => {
    requireStaffRole(request, authConfig, "ADMIN");
    const dateQuery = request.query.date;
    if (dateQuery !== undefined && typeof dateQuery !== "string") {
      throw new HttpError(400, "Date must use YYYY-MM-DD format.");
    }
    const date =
      typeof dateQuery === "string" ? dateQuery : new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError(400, "Date must use YYYY-MM-DD format.");
    }
    if (Number(date.slice(0, 4)) < 1) {
      throw new HttpError(400, "Date is not valid.");
    }
    const start = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== date) {
      throw new HttpError(400, "Date is not valid.");
    }
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const [count, sum] = await prisma.$transaction([
      prisma.order.count({
        where: {
          paymentStatus: "PAID",
          paidAt: { gte: start, lt: end },
        },
      }),
      prisma.order.aggregate({
        where: {
          paymentStatus: "PAID",
          paidAt: { gte: start, lt: end },
        },
        _sum: { totalMinorUnits: true },
      }),
    ]);
    response.json({
      date,
      paidOrderCount: count,
      totalMinorUnits: sum._sum.totalMinorUnits ?? 0,
    });
  });

  return router;
}
