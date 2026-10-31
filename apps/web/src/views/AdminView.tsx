import { useEffect, useState, type FormEvent } from "react";
import { api, type MenuCategory, type StaffRole } from "../api.js";
import { formatMoney } from "../format.js";
import { StaffGate } from "../components/StaffGate.js";

export function AdminView() {
  return <StaffGate role="ADMIN"><AdminContent /></StaffGate>;
}

const staffRoles: { role: StaffRole; label: string }[] = [
  { role: "WAITER", label: "Waiter" },
  { role: "KITCHEN", label: "Kitchen" },
  { role: "ADMIN", label: "Admin" },
];

const emptyStaffPins: Record<StaffRole, string> = {
  WAITER: "",
  KITCHEN: "",
  ADMIN: "",
};

function AdminContent() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [date, setDate] = useState("");
  const [report, setReport] = useState<{
    date: string;
    paidOrderCount: number;
    totalMinorUnits: number;
  } | null>(null);
  const [configuredRoles, setConfiguredRoles] = useState<StaffRole[]>([]);
  const [staffPins, setStaffPins] = useState(emptyStaffPins);
  const [savingPins, setSavingPins] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
      const dailyReport = await api.getDailyReport(date || undefined);
      setReport(dailyReport);
      if (!date) setDate(dailyReport.date);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load report.");
    }
  }

  async function loadCredentialStatus() {
    try {
      const status = await api.getStaffCredentialStatus();
      setConfiguredRoles(status.filter((item) => item.configured).map(({ role }) => role));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load PIN status.");
    }
  }

  useEffect(() => {
    void refreshMenu();
    void loadReport();
    void loadCredentialStatus();
  }, []);

  async function toggleAvailability(itemId: number, isAvailable: boolean) {
    try {
      await api.setAvailability(itemId, !isAvailable);
      await refreshMenu();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update menu item.");
    }
  }

  async function changeStaffPins(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingPins) return;
    setSavingPins(true);
    setError("");
    setNotice("");
    try {
      await api.updateStaffPins(staffPins);
      setStaffPins(emptyStaffPins);
      setNotice("All shared role PINs were changed. The new values apply to the next sign-in.");
      await loadCredentialStatus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change staff PINs.");
    } finally {
      setSavingPins(false);
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
      {notice && <div className="notice success" role="status">{notice}</div>}
      <section className="work-section">
        <div className="section-heading">
          <div><p className="eyebrow">STAFF ACCESS</p><h2>Shared role PINs</h2></div>
        </div>
        <p className="muted">
          Current PIN values are never displayed. Enter 4–128 characters for each role; changes apply to new sign-ins.
        </p>
        <div className="admin-menu">
          {staffRoles.map(({ role, label }) => (
            <div className="admin-menu-row" key={role}>
              <strong>{label}</strong>
              <small>{configuredRoles.includes(role) ? "Configured · value hidden" : "Not configured"}</small>
            </div>
          ))}
        </div>
        <form className="staff-pin-form" onSubmit={(event) => void changeStaffPins(event)}>
          {staffRoles.map(({ role, label }) => (
            <label className="field-label" key={role}>
              New {label} PIN
              <input
                type="password"
                autoComplete="new-password"
                value={staffPins[role]}
                onChange={(event) => setStaffPins((current) => ({
                  ...current,
                  [role]: event.target.value,
                }))}
                minLength={4}
                maxLength={128}
                required
              />
            </label>
          ))}
          <button className="primary-button" type="submit" disabled={savingPins}>
            {savingPins ? "Saving PINs…" : "Change all PINs"}
          </button>
        </form>
      </section>
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
            <article className="report-card"><span>Business date</span><strong>{report.date}</strong></article>
          </div>
        )}
      </section>
    </section>
  );
}
