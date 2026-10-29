import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { api, socketUrl, type Order } from "../api.js";
import { formatMoney, formatTime } from "../format.js";

export function KdsView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setOrders(await api.getOrders(true));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load kitchen orders.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const socket = io(socketUrl);
    socket.on("orders:changed", refresh);
    return () => {
      socket.off("orders:changed", refresh);
      socket.disconnect();
    };
  }, [refresh]);

  async function advance(order: Order) {
    const next = order.status === "ACCEPTED" ? "PREPARING" : "READY";
    try {
      await api.updateStatus(order.id, next);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update order.");
    }
  }

  return (
    <section className="page kds-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">KITCHEN DISPLAY</p>
          <h1>Kitchen queue</h1>
          <p className="muted">Approved orders, sorted by arrival.</p>
        </div>
        <div className="live-indicator"><span /> Live updates</div>
      </div>
      {error && <div className="notice error">{error}</div>}
      {orders.length === 0 ? (
        <div className="empty-state large-empty"><span>✓</span><h2>All caught up</h2><p>Approved orders will appear here.</p></div>
      ) : (
        <section className="kds-grid" aria-label="Active kitchen orders">
          {orders.map((order) => (
            <article className={`kds-card kds-${order.status.toLowerCase()}`} key={order.id}>
              <div className="kds-card-top">
                <span className="kds-number">#{order.id.slice(0, 4).toUpperCase()}</span>
                <span className="kds-time">{formatTime(order.createdAt)}</span>
              </div>
              <div className="kds-card-title">
                <div>
                  <p className="eyebrow kds-order-type">{order.orderType === "DINE_IN" ? "DINE IN" : "TAKEAWAY"}</p>
                  <h2>{order.tableNumber ? `Table ${order.tableNumber}` : "Order"}</h2>
                </div>
                <span className={`status-pill status-${order.status.toLowerCase()}`}>{order.status}</span>
              </div>
              <div className="kds-items">
                {order.items.map((item) => (
                  <div className="kds-item" key={item.id}>
                    <b>{item.quantity}×</b>
                    <div><strong>{item.itemName}</strong>{item.notes && <p className="order-note">{item.notes}</p>}</div>
                    <span>{formatMoney(item.unitPriceMinorUnits * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="kds-card-bottom">
                <span>Total <strong>{formatMoney(order.totalMinorUnits)}</strong></span>
                {order.status === "READY" ? (
                  <span className="ready-label">Ready for collection</span>
                ) : (
                  <button className="primary-button" onClick={() => void advance(order)}>
                    {order.status === "ACCEPTED" ? "Start preparing" : "Mark ready"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
