import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, api, type StaffRole, type StaffSession } from "../api.js";

const roleLabels: Record<StaffRole, string> = {
  WAITER: "Waiter",
  KITCHEN: "Kitchen",
  ADMIN: "Admin",
};

export function StaffGate({
  role,
  children,
}: {
  role: StaffRole;
  children: ReactNode;
}) {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let active = true;
    api.getSession()
      .then((current) => {
        if (active) setSession(current);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (!(cause instanceof ApiError) || cause.status !== 401) {
          setError(cause instanceof Error ? cause.message : "Could not check staff access.");
        }
        setSession(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signingIn || !pin) return;
    setSigningIn(true);
    setError("");
    try {
      await api.login(role, pin);
      setSession(await api.getSession());
      setPin("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    try {
      await api.logout();
      setSession(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    }
  }

  if (checking) {
    return <section className="page staff-auth"><p className="muted">Checking staff access…</p></section>;
  }

  if (session?.role !== role) {
    return (
      <section className="page staff-auth">
        <p className="eyebrow">STAFF ACCESS</p>
        <h1>{roleLabels[role]} sign-in</h1>
        <p className="muted">
          Enter the shared {roleLabels[role].toLowerCase()} PIN to access this screen.
        </p>
        {session && (
          <p className="notice success">
            Signed in as {roleLabels[session.role]}. Enter the {roleLabels[role].toLowerCase()} PIN to switch roles.
          </p>
        )}
        {error && <p className="notice error" role="alert">{error}</p>}
        <form className="staff-login-form" onSubmit={(event) => void signIn(event)}>
          <label className="field-label" htmlFor={`staff-pin-${role.toLowerCase()}`}>
            {roleLabels[role]} PIN
            <input
              id={`staff-pin-${role.toLowerCase()}`}
              type="password"
              autoComplete="current-password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              maxLength={128}
              required
              autoFocus
            />
          </label>
          <button className="primary-button" type="submit" disabled={signingIn || pin.length === 0}>
            {signingIn ? "Signing in…" : `Open ${roleLabels[role]} screen`}
          </button>
        </form>
      </section>
    );
  }

  return (
    <>
      <div className="staff-session" role="status">
        <span>Signed in as {roleLabels[session.role]}</span>
        <button className="secondary-button" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
      {error && <div className="page"><p className="notice error" role="alert">{error}</p></div>}
      {children}
    </>
  );
}
