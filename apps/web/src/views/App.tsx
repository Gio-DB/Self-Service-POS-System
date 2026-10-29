import { AdminView } from "./AdminView.js";
import { KdsView } from "./KdsView.js";
import { KioskView } from "./KioskView.js";
import { WaiterView } from "./WaiterView.js";

const screens = {
  "/": { name: "Kiosk", element: <KioskView /> },
  "/kiosk": { name: "Kiosk", element: <KioskView /> },
  "/waiter": { name: "Waiter", element: <WaiterView /> },
  "/kds": { name: "Kitchen display", element: <KdsView /> },
  "/admin": { name: "Admin", element: <AdminView /> },
};

export default function App() {
  const screen = screens[window.location.pathname as keyof typeof screens] ??
    screens["/"];

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">P</span>
          <span>Tableflow <small>prototype</small></span>
        </a>
        <nav aria-label="Demo screens">
          <a href="/kiosk" aria-current={screen.name === "Kiosk" ? "page" : undefined}>Kiosk</a>
          <a href="/waiter" aria-current={screen.name === "Waiter" ? "page" : undefined}>Waiter</a>
          <a href="/kds" aria-current={screen.name === "Kitchen display" ? "page" : undefined}>Kitchen</a>
          <a href="/admin" aria-current={screen.name === "Admin" ? "page" : undefined}>Admin</a>
        </nav>
        <span className="demo-badge"><span /> Local demo</span>
      </header>
      <main>{screen.element}</main>
      <footer>Prototype only · Cash-only demo · Not for live restaurant use</footer>
    </div>
  );
}
