import { useCallback, useEffect, useState, type ReactNode } from "react";
import { io } from "socket.io-client";
import { api, socketUrl, type Order } from "../api.js";
import { StaffGate } from "../components/StaffGate.js";
import { formatMoney, formatTime } from "../format.js";

export function KdsView() {
  return <StaffGate role="KITCHEN"><KdsContent /></StaffGate>;
}

function KdsContent() {
  const [board, setBoard] = useState({
    approved: [] as Order[],
    preparing: [] as Order[],
    completed: [] as Order[],
    archive: [] as Order[],
  });
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setBoard(await api.getKdsOrderBoard());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load kitchen orders.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const socket = io(socketUrl, { withCredentials: true });
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
          <p className="muted">Approved orders grouped by their preparation stage.</p>
        </div>
        <div className="live-indicator"><span /> Live updates</div>
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}
      <KdsSection eyebrow="READY TO START" title="Approved orders" orders={board.approved} empty="No approved orders are waiting.">
        {(order) => <KitchenTicket key={order.id} order={order} onAdvance={advance} />}
      </KdsSection>
      <KdsSection eyebrow="IN PROGRESS" title="Preparing" orders={board.preparing} empty="No orders are being prepared.">
        {(order) => <KitchenTicket key={order.id} order={order} onAdvance={advance} />}
      </KdsSection>
      <KdsSection eyebrow="READY FOR COLLECTION" title="Completed" orders={board.completed} empty="No completed orders today.">
        {(order) => <KitchenTicket key={order.id} order={order} onAdvance={advance} />}
      </KdsSection>
      <KdsSection eyebrow="PREVIOUS DAYS" title="Archive" orders={board.archive} empty="No previous kitchen orders.">
        {(order) => <KitchenTicket key={order.id} order={order} onAdvance={advance} />}
      </KdsSection>
    </section>
  );
}

function KdsSection({
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
    <section className="work-section kds-section" aria-label={title}>
      <div className="section-heading">
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
        <span className="count-pill">{orders.length}</span>
      </div>
      {orders.length === 0 ? <div className="empty-state">{empty}</div> : <div className="kds-grid">{orders.map(children)}</div>}
    </section>
  );
}

function KitchenTicket({
  order,
  onAdvance,
}: {
  order: Order;
  onAdvance: (order: Order) => Promise<void>;
}) {
  return (
    <article className={`kds-card kds-${order.status.toLowerCase()}`}>
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
            <div><strong>{item.itemName}</strong>{item.notes && <p className="order-note">Modification: {item.notes}</p>}</div>
            <span>{formatMoney(item.unitPriceMinorUnits * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="kds-card-bottom">
        <span>Total <strong>{formatMoney(order.totalMinorUnits)}</strong></span>
        {order.status === "READY" ? (
          <span className="ready-label">Ready for collection</span>
        ) : (
          <button className="primary-button" onClick={() => void onAdvance(order)}>
            {order.status === "ACCEPTED" ? "Start preparing" : "Mark ready"}
          </button>
        )}
      </div>
    </article>
  );
}
