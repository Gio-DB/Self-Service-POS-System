import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  api,
  MAX_ORDER_ITEM_QUANTITY,
  socketUrl,
  type MenuCategory,
} from "../api.js";
import { Dialog } from "../components/Dialog.js";
import { formatMoney } from "../format.js";

export function KioskView() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [orderType, setOrderType] = useState<"TAKEAWAY" | "DINE_IN">("TAKEAWAY");
  const [customerReference, setCustomerReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const submissionOrderId = useRef<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadMenu = () => {
      api.getMenu(true)
        .then((menu) => {
          if (active) {
            setCategories(menu);
            setError("");
          }
        })
        .catch((cause: unknown) => {
          if (active) {
            setError(cause instanceof Error ? cause.message : "Could not load menu.");
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    const socket = io(socketUrl);
    socket.on("connect", loadMenu);
    socket.on("menu:changed", loadMenu);
    loadMenu();
    return () => {
      active = false;
      socket.off("connect", loadMenu);
      socket.off("menu:changed", loadMenu);
      socket.disconnect();
    };
  }, []);

  const items = useMemo(
    () => categories.flatMap((category) => category.items),
    [categories],
  );
  const cartItems = items.filter((item) => (quantities[item.id] ?? 0) > 0);
  const hasUnavailableItems = cartItems.some((item) => !item.isAvailable);
  const total = cartItems.reduce(
    (sum, item) => sum + item.priceMinorUnits * (quantities[item.id] ?? 0),
    0,
  );

  function changeQuantity(itemId: number, change: number) {
    if (
      change > 0 &&
      (quantities[itemId] ?? 0) >= MAX_ORDER_ITEM_QUANTITY
    ) {
      setError(`Maximum ${MAX_ORDER_ITEM_QUANTITY} of each item per order.`);
      return;
    }
    setQuantities((current) => {
      const next = Math.max(0, (current[itemId] ?? 0) + change);
      return { ...current, [itemId]: next };
    });
  }

  function openConfirmation() {
    setError("");
    setMessage("");
    submissionOrderId.current = crypto.randomUUID();
    setConfirming(true);
  }

  async function confirmOrder() {
    if (submitting || !cartItems.length || hasUnavailableItems) return;
    setSubmitting(true);
    setError("");
    try {
      const orderId = submissionOrderId.current ?? crypto.randomUUID();
      submissionOrderId.current = orderId;
      const order = await api.createOrder({
        id: orderId,
        orderType,
        customerReference: customerReference.trim() || null,
        items: cartItems.map((item) => ({
          menuItemId: item.id,
          quantity: quantities[item.id] ?? 0,
        })),
      });
      setMessage(`Order ${order.id.slice(0, 8)} sent for waiter review.`);
      setQuantities({});
      setCustomerReference("");
      submissionOrderId.current = null;
      setConfirming(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Order could not be sent.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page kiosk-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CUSTOMER ORDERING</p>
          <h1>Good food, your way.</h1>
          <p className="muted">Choose from today's menu and send your order to the team.</p>
        </div>
        <div className="order-type" role="group" aria-label="Order type">
          <button className={orderType === "TAKEAWAY" ? "selected" : ""} onClick={() => setOrderType("TAKEAWAY")}>Takeaway</button>
          <button className={orderType === "DINE_IN" ? "selected" : ""} onClick={() => setOrderType("DINE_IN")}>Dine in</button>
        </div>
      </div>
      {error && <div className="notice error">{error}</div>}

      <div className="kiosk-layout">
        <div className="menu-column">
          {loading && <p className="muted">Loading menu…</p>}
          {categories.map((category) => (
            <section className="menu-section" key={category.id}>
              <div className="section-heading">
                <h2>{category.name}</h2>
                <span>{category.items.length} items</span>
              </div>
              <div className="menu-grid">
                {category.items.map((item) => (
                  <article className="menu-card" key={item.id}>
                    <div className="food-placeholder" aria-hidden="true">{item.name.slice(0, 1)}</div>
                    <div className="menu-card-info">
                      <strong>{item.name}</strong>
                      <span>{formatMoney(item.priceMinorUnits)}</span>
                    </div>
                    <button
                      className="add-button"
                      aria-label={item.isAvailable ? `Add ${item.name}` : `${item.name} is sold out`}
                      disabled={
                        !item.isAvailable ||
                        (quantities[item.id] ?? 0) >= MAX_ORDER_ITEM_QUANTITY
                      }
                      title={
                        !item.isAvailable
                          ? "Sold out"
                          : (quantities[item.id] ?? 0) >= MAX_ORDER_ITEM_QUANTITY
                          ? `Maximum ${MAX_ORDER_ITEM_QUANTITY} per order`
                          : undefined
                      }
                      onClick={() => changeQuantity(item.id, 1)}
                    >
                      {!item.isAvailable
                        ? "Sold out"
                        : (quantities[item.id] ?? 0) > 0
                          ? `+ ${quantities[item.id]}`
                          : "Add"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="cart-panel">
          <div className="cart-title">
            <div><p className="eyebrow">YOUR ORDER</p><h2>Basket</h2></div>
            <span className="count-pill">{cartItems.reduce((sum, item) => sum + (quantities[item.id] ?? 0), 0)}</span>
          </div>
          <label className="field-label">
            Your name or table number <span className="optional">(optional)</span>
            <input
              value={customerReference}
              onChange={(event) => setCustomerReference(event.target.value)}
              placeholder="Optional"
              maxLength={30}
            />
          </label>
          {cartItems.length === 0 ? (
            <div className="empty-cart"><span>＋</span><p>Your basket is empty.</p><small>Add something delicious.</small></div>
          ) : (
            <div className="cart-lines">
              {cartItems.map((item) => (
                <div className="cart-line" key={item.id}>
                  <div><strong>{item.name}</strong><small>{formatMoney(item.priceMinorUnits)} each</small></div>
                  <div className="quantity-control">
                    <button aria-label={`Remove one ${item.name}`} onClick={() => changeQuantity(item.id, -1)}>−</button>
                    <span>{quantities[item.id]}</span>
                    <button
                      aria-label={`Add one ${item.name}`}
                      disabled={
                        !item.isAvailable ||
                        (quantities[item.id] ?? 0) >= MAX_ORDER_ITEM_QUANTITY
                      }
                      onClick={() => changeQuantity(item.id, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="cart-total"><span>Total</span><strong>{formatMoney(total)}</strong></div>
          {hasUnavailableItems && (
            <p className="notice error">Remove sold-out items from your basket before sending.</p>
          )}
          <button className="primary-button full-width" disabled={cartItems.length === 0 || hasUnavailableItems || submitting || loading} onClick={openConfirmation}>
            Send order
          </button>
          {message && <div className="notice success">{message}</div>}
          <p className="fine-print">Your order is sent to staff for review before it reaches the kitchen.</p>
        </aside>
      </div>
      {confirming && (
        <Dialog
          title="Confirm your order"
          onClose={() => {
            if (!submitting) {
              submissionOrderId.current = null;
              setConfirming(false);
              setError("");
            }
          }}
        >
          <p className="dialog-intro">
            Check your order before sending it to the restaurant.
          </p>
          <div className="confirmation-details">
            <p>
              <strong>Order type</strong>
              <span>{orderType === "DINE_IN" ? "Dine in" : "Takeaway"}</span>
            </p>
            {customerReference.trim() && (
              <p>
                <strong>{orderType === "DINE_IN" ? "Table number" : "Your name"}</strong>
                <span>{customerReference.trim()}</span>
              </p>
            )}
          </div>
          <div className="confirmation-items">
            {cartItems.map((item) => (
              <div className="confirmation-line" key={item.id}>
                <span>
                  <strong>{quantities[item.id]}×</strong> {item.name}
                  {!item.isAvailable && (
                    <small className="unavailable-label">Sold out</small>
                  )}
                </span>
                <strong>
                  {formatMoney(item.priceMinorUnits * quantities[item.id])}
                </strong>
              </div>
            ))}
          </div>
          <div className="confirmation-total">
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          {error && <p className="notice error" role="alert">{error}</p>}
          {hasUnavailableItems && (
            <p className="notice error" role="alert">
              Remove sold-out items from your order before confirming.
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={submitting}
              onClick={() => {
                submissionOrderId.current = null;
                setConfirming(false);
                setError("");
              }}
            >
              Back to order
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={submitting || !cartItems.length || hasUnavailableItems}
              onClick={() => void confirmOrder()}
            >
              {submitting ? "Sending…" : "Confirm order"}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
