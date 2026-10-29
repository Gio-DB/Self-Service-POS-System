import { useEffect, useState } from "react";
import { api, type MenuCategory } from "../api.js";
import { formatMoney } from "../format.js";
import { StaffGate } from "../components/StaffGate.js";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function AdminView() {
  return <StaffGate role="ADMIN"><AdminContent /></StaffGate>;
}

function AdminContent() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [date, setDate] = useState(todayUtc());
  const [report, setReport] = useState<{
    date: string;
    paidOrderCount: number;
    totalMinorUnits: number;
  } | null>(null);
  const [error, setError] = useState("");

  async function refreshMenu() {
    try {
      setCategories(await api.getMenu(true));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load menu.");
    }
  }

  async function loadReport() {
    try {
      setReport(await api.getDailyReport(date));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load report.");
    }
  }

  useEffect(() => {
    void refreshMenu();
    void loadReport();
  }, []);

  async function toggleAvailability(itemId: number, isAvailable: boolean) {
    try {
      await api.setAvailability(itemId, !isAvailable);
      await refreshMenu();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update menu item.");
    }
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RESTAURANT CONTROL</p>
          <h1>Admin overview</h1>
          <p className="muted">A small menu availability control and paid sales summary for the demo.</p>
        </div>
        <span className="demo-badge"><span /> Demo data</span>
      </div>
      {error && <div className="notice error">{error}</div>}
      <section className="work-section">
        <div className="section-heading"><div><p className="eyebrow">MENU</p><h2>Item availability</h2></div></div>
        <div className="admin-menu">
          {categories.flatMap((category) =>
            category.items.map((item) => (
              <div className="admin-menu-row" key={item.id}>
                <div><strong>{item.name}</strong><small>{category.name} · {formatMoney(item.priceMinorUnits)}</small></div>
                <button
                  className={item.isAvailable ? "availability available" : "availability unavailable"}
                  onClick={() => void toggleAvailability(item.id, item.isAvailable)}
                >
                  {item.isAvailable ? "Available" : "Sold out"}
                </button>
              </div>
            )),
          )}
          {categories.every((category) => category.items.length === 0) && (
            <div className="empty-state">No available menu items.</div>
          )}
        </div>
      </section>

      <section className="work-section">
        <div className="section-heading">
          <div><p className="eyebrow">SALES</p><h2>Daily summary</h2></div>
          <label className="date-picker">Business date <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </div>
        <button className="secondary-button" onClick={() => void loadReport()}>Load report</button>
        {report && (
          <div className="report-grid">
            <article className="report-card"><span>Paid orders</span><strong>{report.paidOrderCount}</strong></article>
            <article className="report-card"><span>Paid sales</span><strong>{formatMoney(report.totalMinorUnits)}</strong></article>
            <article className="report-card"><span>Date (UTC)</span><strong>{report.date}</strong></article>
          </div>
        )}
      </section>
    </section>
  );
}
