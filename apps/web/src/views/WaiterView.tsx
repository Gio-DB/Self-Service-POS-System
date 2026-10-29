import { useCallback, useEffect, useState } from "react";
import { api, MAX_ORDER_ITEM_QUANTITY, type Order } from "../api.js";
import {
  applyCashKey,
  MAX_CASH_TENDER_MINOR_UNITS,
  parseCashAmount,
} from "../cash-entry.js";
import { Dialog } from "../components/Dialog.js";
import { formatMoney, formatTime } from "../format.js";

export function WaiterView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cashOrder, setCashOrder] = useState<Order | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [cashDialogError, setCashDialogError] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      setOrders(await api.getOrders());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load orders.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function changeStatus(order: Order, status: Order["status"]) {
    setError("");
    setNotice("");
    try {
      await api.updateStatus(order.id, status);
      setNotice(`Order ${order.id.slice(0, 8)} updated.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update order.");
    }
  }

  async function changeQuantity(order: Order, itemIndex: number, change: number) {
    setError("");
    try {
      const currentItem = order.items[itemIndex];
      if (!currentItem?.menuItemId) return;
      if (change > 0 && currentItem.quantity >= MAX_ORDER_ITEM_QUANTITY) {
        setError(`Maximum ${MAX_ORDER_ITEM_QUANTITY} of each item per order.`);
        return;
      }
      const nextItems = order.items.flatMap((item) => {
        if (item.menuItemId === null) return [];
        const quantity =
          item.id === currentItem.id ? item.quantity + change : item.quantity;
        if (quantity < 1) return [];
        return [
          {
            menuItemId: item.menuItemId,
            quantity,
            notes: item.notes,
          },
        ];
      });
      if (!nextItems.length) {
        setError("An order must contain at least one item.");
        return;
      }
      await api.updateItems(order.id, nextItems);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not edit order.");
    }
  }

  function openCashKeypad(order: Order) {
    setCashOrder(order);
    setCashAmount("");
    setCashDialogError("");
    setError("");
    setNotice("");
  }

  function pressCashKey(key: string) {
    if (paying) return;
    const result = applyCashKey(cashAmount, key);
    setCashAmount(result.amount);
    setCashDialogError(result.error ?? "");
  }

  async function takePayment() {
    if (!cashOrder || paying || cashDialogError) return;
    const tender = parseCashAmount(cashAmount);
    if (tender === null) {
      setCashDialogError("Enter a valid cash amount using the keypad.");
      return;
    }
    if (tender > MAX_CASH_TENDER_MINOR_UNITS) {
      setCashDialogError("Cash amount is above the supported limit.");
      return;
    }
    if (tender < cashOrder.totalMinorUnits) {
      setCashDialogError(
        `Cash received must cover the total of ${formatMoney(cashOrder.totalMinorUnits)}.`,
      );
      return;
    }
    setPaying(true);
    setCashDialogError("");
    try {
      const paid = await api.payOrder(cashOrder.id, tender);
      setNotice(
        `Payment recorded. Change due: ${formatMoney(paid.changeDueMinorUnits ?? 0)}.`,
      );
      setCashOrder(null);
      setCashAmount("");
      await refresh();
    } catch (cause) {
      setCashDialogError(
        cause instanceof Error ? cause.message : "Could not record payment.",
      );
    } finally {
      setPaying(false);
    }
  }

  function closeCashKeypad() {
    if (paying) return;
    setCashOrder(null);
    setCashAmount("");
    setCashDialogError("");
  }

  const pending = orders.filter((order) => order.status === "PENDING_REVIEW");
  const active = orders.filter(
    (order) => order.status !== "PENDING_REVIEW" && order.status !== "CANCELLED",
  );

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">FRONT OF HOUSE</p>
          <h1>Waiter station</h1>
          <p className="muted">Review kiosk orders, approve the kitchen handoff, and record cash payments.</p>
        </div>
        <button className="secondary-button" onClick={() => void refresh()}>Refresh</button>
      </div>
      {error && <div className="notice error">{error}</div>}
      {notice && <div className="notice success">{notice}</div>}

      <section className="work-section">
        <div className="section-heading">
          <div><p className="eyebrow">ACTION REQUIRED</p><h2>Awaiting review</h2></div>
          <span className="count-pill">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <div className="empty-state">No orders are waiting for review.</div>
        ) : (
          <div className="order-grid">
            {pending.map((order) => (
              <article className="order-card" key={order.id}>
                <OrderSummary order={order} />
                <div className="order-edit">
                  <span className="eyebrow">EDIT QUANTITIES</span>
                  {order.items.map((item, index) => (
                    <div className="edit-line" key={item.id}>
                      <span>{item.itemName}</span>
                      <div className="quantity-control compact">
                        <button aria-label={`Remove one ${item.itemName}`} onClick={() => void changeQuantity(order, index, -1)}>−</button>
                        <span>{item.quantity}</span>
                        <button
                          aria-label={`Add one ${item.itemName}`}
                          disabled={item.quantity >= MAX_ORDER_ITEM_QUANTITY}
                          title={
                            item.quantity >= MAX_ORDER_ITEM_QUANTITY
                              ? `Maximum ${MAX_ORDER_ITEM_QUANTITY} per order`
                              : undefined
                          }
                          onClick={() => void changeQuantity(order, index, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="button-row">
                  <button className="secondary-button" onClick={() => void changeStatus(order, "CANCELLED")}>Cancel</button>
                  <button className="primary-button" onClick={() => void changeStatus(order, "ACCEPTED")}>Approve order</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="work-section">
        <div className="section-heading">
          <div><p className="eyebrow">IN PROGRESS</p><h2>Active orders</h2></div>
          <span className="count-pill">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <div className="empty-state">Approved orders will appear here.</div>
        ) : (
          <div className="order-grid">
            {active.map((order) => (
              <article className="order-card" key={order.id}>
                <OrderSummary order={order} />
                {order.status === "READY" && order.paymentStatus === "UNPAID" && (
                  <div className="payment-box">
                    <button
                      className="primary-button full-width"
                      onClick={() => openCashKeypad(order)}
                    >
                      Enter cash received
                    </button>
                  </div>
                )}
                {order.paymentStatus === "PAID" && (
                  <p className="paid-note">Paid · change {formatMoney(order.changeDueMinorUnits ?? 0)}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      {cashOrder && (
        <Dialog title="Enter cash received" onClose={closeCashKeypad}>
          <div className="cash-order-total">
            <span>Order total</span>
            <strong>{formatMoney(cashOrder.totalMinorUnits)}</strong>
          </div>
          <label className="cash-display-label" htmlFor="cash-amount">
            Cash received
          </label>
          <output
            id="cash-amount"
            className="cash-display"
            aria-live="polite"
            aria-label={`Cash received ${cashAmount || "0"}`}
          >
            {cashAmount || "0"}
          </output>
          <div className="cash-keypad" role="group" aria-label="Cash amount keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                type="button"
                className="keypad-button"
                aria-label={`Digit ${digit}`}
                key={digit}
                onClick={() => pressCashKey(digit)}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              className="keypad-button keypad-utility"
              onClick={() => pressCashKey("clear")}
            >
              Clear
            </button>
            <button
              type="button"
              className="keypad-button"
              aria-label="Digit 0"
              onClick={() => pressCashKey("0")}
            >
              0
            </button>
            <button
              type="button"
              className="keypad-button keypad-utility"
              aria-label="Backspace"
              onClick={() => pressCashKey("backspace")}
            >
              ⌫
            </button>
            <button
              type="button"
              className="keypad-button keypad-decimal"
              aria-label="Decimal point"
              onClick={() => pressCashKey(".")}
            >
              .
            </button>
          </div>
          {cashDialogError && (
            <p className="notice error" role="alert">
              {cashDialogError}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={paying}
              onClick={closeCashKeypad}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={paying || cashAmount.length === 0 || Boolean(cashDialogError)}
              onClick={() => void takePayment()}
            >
              {paying ? "Recording…" : "Record payment"}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function OrderSummary({ order }: { order: Order }) {
  return (
    <>
      <div className="order-card-heading">
        <div>
          <p className="eyebrow">ORDER {order.id.slice(0, 8)}</p>
          <h3>{order.orderType === "DINE_IN" ? `Dine in${order.tableNumber ? ` · Table ${order.tableNumber}` : ""}` : "Takeaway"}</h3>
        </div>
        <span className={`status-pill status-${order.status.toLowerCase()}`}>{order.status.replaceAll("_", " ")}</span>
      </div>
      <p className="order-time">Received at {formatTime(order.createdAt)}</p>
      <div className="order-lines">
        {order.items.map((item) => (
          <div className="order-line" key={item.id}>
            <span><b>{item.quantity}×</b> {item.itemName}</span>
            <strong>{formatMoney(item.unitPriceMinorUnits * item.quantity)}</strong>
            {item.notes && <span className="order-note">{item.notes}</span>}
          </div>
        ))}
      </div>
      <div className="order-total"><span>Total</span><strong>{formatMoney(order.totalMinorUnits)}</strong></div>
    </>
  );
}
