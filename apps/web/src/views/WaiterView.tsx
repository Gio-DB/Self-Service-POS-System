import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, MAX_ORDER_ITEM_QUANTITY, type Order } from "../api.js";
import {
  applyCashKey,
  MAX_CASH_TENDER_MINOR_UNITS,
  parseCashAmount,
} from "../cash-entry.js";
import { Dialog } from "../components/Dialog.js";
import { StaffGate } from "../components/StaffGate.js";
import { formatMoney, formatOrderReference, formatTime } from "../format.js";

type EditLine = {
  id: number;
  menuItemId: number;
  itemName: string;
  unitPriceMinorUnits: number;
  quantity: number;
  notes: string;
};

export function WaiterView() {
  return <StaffGate role="WAITER"><WaiterContent /></StaffGate>;
}

function WaiterContent() {
  const [board, setBoard] = useState({
    awaitingReview: [] as Order[],
    active: [] as Order[],
    paid: [] as Order[],
    archive: [] as Order[],
  });
  const [cashOrder, setCashOrder] = useState<Order | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [cashDialogError, setCashDialogError] = useState("");
  const [paying, setPaying] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      setBoard(await api.getWaiterOrderBoard());
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

  function openEditor(order: Order) {
    const editableLines = order.items.flatMap((item) => item.menuItemId === null ? [] : [{
      id: item.id,
      menuItemId: item.menuItemId,
      itemName: item.itemName,
      unitPriceMinorUnits: item.unitPriceMinorUnits,
      quantity: item.quantity,
      notes: item.notes ?? "",
    }]);
    if (editableLines.length !== order.items.length) {
      setError("This order contains a historical menu item and cannot be edited.");
      return;
    }
    setEditOrder(order);
    setEditLines(editableLines);
    setError("");
    setNotice("");
  }

  function changeEditQuantity(lineId: number, change: number) {
    setEditLines((current) => current.flatMap((line) => {
      if (line.id !== lineId) return [line];
      const quantity = line.quantity + change;
      if (quantity < 1) return [];
      if (quantity > MAX_ORDER_ITEM_QUANTITY) return [line];
      return [{ ...line, quantity }];
    }));
  }

  function changeEditNote(lineId: number, notes: string) {
    setEditLines((current) => current.map((line) => (
      line.id === lineId ? { ...line, notes } : line
    )));
  }

  const editedTotal = useMemo(
    () => editLines.reduce(
      (sum, line) => sum + line.unitPriceMinorUnits * line.quantity,
      0,
    ),
    [editLines],
  );

  async function saveOrderEdits() {
    if (!editOrder || savingEdit) return;
    if (!editLines.length) {
      setError("An order must contain at least one item.");
      return;
    }
    setSavingEdit(true);
    setError("");
    try {
      await api.updateItems(
        editOrder.id,
        editLines.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          notes: line.notes.trim() || null,
        })),
      );
      setEditOrder(null);
      setEditLines([]);
      setNotice(`Order ${editOrder.id.slice(0, 8)} saved.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not edit order.");
    } finally {
      setSavingEdit(false);
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

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">FRONT OF HOUSE</p>
          <h1>Waiter station</h1>
          <p className="muted">Review and modify customer orders before the kitchen handoff, then record cash payments.</p>
        </div>
        <button className="secondary-button" onClick={() => void refresh()}>Refresh</button>
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}
      {notice && <div className="notice success">{notice}</div>}

      <BoardSection
        eyebrow="ACTION REQUIRED"
        title="Awaiting review"
        orders={board.awaitingReview}
        empty="No orders are waiting for review."
      >
        {(order) => (
          <article className="order-card" key={order.id}>
            <OrderSummary order={order} />
            <div className="button-row">
              <button className="secondary-button" onClick={() => openEditor(order)}>Modify order</button>
              <button className="secondary-button" onClick={() => void changeStatus(order, "CANCELLED")}>Cancel</button>
              <button className="primary-button" onClick={() => void changeStatus(order, "ACCEPTED")}>Approve order</button>
            </div>
          </article>
        )}
      </BoardSection>

      <BoardSection
        eyebrow="IN PROGRESS"
        title="Active orders"
        orders={board.active}
        empty="Approved unpaid orders will appear here."
      >
        {(order) => (
          <article className="order-card" key={order.id}>
            <OrderSummary order={order} />
            {order.status === "READY" && order.paymentStatus === "UNPAID" && (
              <div className="payment-box">
                <button className="primary-button full-width" onClick={() => openCashKeypad(order)}>
                  Enter cash received
                </button>
              </div>
            )}
          </article>
        )}
      </BoardSection>

      <BoardSection
        eyebrow="TODAY"
        title="Paid orders"
        orders={board.paid}
        empty="No orders have been paid today."
      >
        {(order) => (
          <article className="order-card" key={order.id}>
            <OrderSummary order={order} />
            <p className="paid-note">Paid · change {formatMoney(order.changeDueMinorUnits ?? 0)}</p>
          </article>
        )}
      </BoardSection>

      <BoardSection
        eyebrow="HISTORY"
        title="Archive"
        orders={board.archive}
        empty="No orders from previous days."
      >
        {(order) => <article className="order-card" key={order.id}><OrderSummary order={order} /></article>}
      </BoardSection>

      {editOrder && (
        <Dialog
          title={`Modify order ${editOrder.id.slice(0, 8)}`}
          onClose={() => {
            if (!savingEdit) {
              setEditOrder(null);
              setEditLines([]);
            }
          }}
        >
          <p className="dialog-intro">Add or remove quantities and record staff-only preparation notes for each item.</p>
          <div className="order-editor-lines">
            {editLines.map((line) => (
              <div className="order-editor-line" key={line.id}>
                <div className="order-editor-heading">
                  <strong>{line.itemName}</strong>
                  <span>{formatMoney(line.unitPriceMinorUnits * line.quantity)}</span>
                </div>
                <div className="quantity-control">
                  <button type="button" aria-label={`Remove one ${line.itemName}`} onClick={() => changeEditQuantity(line.id, -1)}>−</button>
                  <span>{line.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Add one ${line.itemName}`}
                    disabled={line.quantity >= MAX_ORDER_ITEM_QUANTITY}
                    onClick={() => changeEditQuantity(line.id, 1)}
                  >
                    +
                  </button>
                </div>
                <label className="field-label">
                  Modification note <span className="optional">(for example, extra cheese or no onions)</span>
                  <input
                    value={line.notes}
                    onChange={(event) => changeEditNote(line.id, event.target.value)}
                    maxLength={200}
                    placeholder="No modification"
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="cash-order-total">
            <span>Updated total</span>
            <strong>{formatMoney(editedTotal)}</strong>
          </div>
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={savingEdit}
              onClick={() => {
                setEditOrder(null);
                setEditLines([]);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={savingEdit || editLines.length === 0}
              onClick={() => void saveOrderEdits()}
            >
              {savingEdit ? "Saving…" : "Save changes"}
            </button>
          </div>
        </Dialog>
      )}

      {cashOrder && (
        <Dialog title="Enter cash received" onClose={closeCashKeypad}>
          <div className="cash-order-total">
            <span>Order total</span>
            <strong>{formatMoney(cashOrder.totalMinorUnits)}</strong>
          </div>
          <label className="cash-display-label" htmlFor="cash-amount">Cash received</label>
          <output id="cash-amount" className="cash-display" aria-live="polite" aria-label={`Cash received ${cashAmount || "0"}`}>
            {cashAmount || "0"}
          </output>
          <div className="cash-keypad" role="group" aria-label="Cash amount keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button type="button" className="keypad-button" aria-label={`Digit ${digit}`} key={digit} onClick={() => pressCashKey(digit)}>{digit}</button>
            ))}
            <button type="button" className="keypad-button keypad-utility" onClick={() => pressCashKey("clear")}>Clear</button>
            <button type="button" className="keypad-button" aria-label="Digit 0" onClick={() => pressCashKey("0")}>0</button>
            <button type="button" className="keypad-button keypad-utility" aria-label="Backspace" onClick={() => pressCashKey("backspace")}>⌫</button>
            <button type="button" className="keypad-button keypad-decimal" aria-label="Decimal point" onClick={() => pressCashKey(".")}>.</button>
          </div>
          {cashDialogError && <p className="notice error" role="alert">{cashDialogError}</p>}
          <div className="dialog-actions">
            <button type="button" className="secondary-button" disabled={paying} onClick={closeCashKeypad}>Cancel</button>
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

function BoardSection({
  eyebrow,
  title,
  orders,
  empty,
  children,
}: {
  eyebrow: string;
  title: string;
  orders: Order[];
  empty: string;
  children: (order: Order) => ReactNode;
}) {
  return (
    <section className="work-section" aria-label={title}>
      <div className="section-heading">
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
        <span className="count-pill">{orders.length}</span>
      </div>
      {orders.length === 0 ? <div className="empty-state">{empty}</div> : <div className="order-grid">{orders.map(children)}</div>}
    </section>
  );
}

function OrderSummary({ order }: { order: Order }) {
  const orderDescription = order.orderType === "DINE_IN"
    ? order.customerReference
      ? `Dine in · Table ${order.customerReference}`
      : "Dine in"
    : order.customerReference
      ? `Takeaway · ${order.customerReference}`
      : "Takeaway";
  return (
    <>
      <div className="order-card-heading">
        <div>
          <p className="eyebrow">ORDER {formatOrderReference(order.orderNumber)}</p>
          <h3>{orderDescription}</h3>
        </div>
        <span className={`status-pill status-${order.status.toLowerCase()}`}>{order.status.replaceAll("_", " ")}</span>
      </div>
      <p className="order-time">Received at {formatTime(order.createdAt)}</p>
      <div className="order-lines">
        {order.items.map((item) => (
          <div className="order-line" key={item.id}>
            <span><b>{item.quantity}×</b> {item.itemName}</span>
            <strong>{formatMoney(item.unitPriceMinorUnits * item.quantity)}</strong>
            {item.notes && <span className="order-note">Modification: {item.notes}</span>}
          </div>
        ))}
      </div>
      <div className="order-total"><span>Total</span><strong>{formatMoney(order.totalMinorUnits)}</strong></div>
    </>
  );
}
