"use client";

import { useCallback, useEffect, useState } from "react";
import type { Bootstrap } from "@/lib/types";
import { api, formatDate, Icon, Loading, Notice, SettingsSection } from "./ui";

type Account = { id: string; providerId: string; createdAt: string };
type Session = { id: string; token: string; userAgent?: string; createdAt: string; expiresAt: string };

export default function AccountSecurity({ bootstrap, refresh }: { bootstrap: Bootstrap; refresh: () => Promise<void> }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const results = await Promise.allSettled([api<Account[]>("/api/auth/list-accounts"), api<Session[]>("/api/auth/list-sessions"), api<{ session?: { id: string } }>("/api/auth/get-session")]);
    if (results[0].status === "fulfilled") setAccounts(results[0].value); else setError(results[0].reason.message);
    if (results[1].status === "fulfilled") setSessions(results[1].value); else setError(results[1].reason.message);
    if (results[2].status === "fulfilled") setCurrent(results[2].value?.session?.id ?? "");
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function revoke(session: Session) {
    setBusy(true); setError(""); setMessage("");
    try { await api("/api/auth/revoke-session", { method: "POST", body: JSON.stringify({ token: session.token }) }); await load(); setMessage("Session signed out."); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not sign out that session. Sign in again and retry."); }
    finally { setBusy(false); }
  }
  async function connect(provider: "google" | "github") {
    setBusy(true); setError(""); setMessage("");
    try { const result = await api<{ url?: string }>("/api/auth/link-social", { method: "POST", body: JSON.stringify({ provider, callbackURL: `${window.location.origin}/?view=settings` }) }); if (!result.url) throw new Error("Could not start account linking. Sign in again and retry."); window.location.assign(result.url); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not connect your account."); setBusy(false); }
  }
  async function disconnect(account: Account) {
    setBusy(true); setError(""); setMessage("");
    try { await api("/api/auth/unlink-account", { method: "POST", body: JSON.stringify({ accountId: account.id }) }); await load(); setMessage("Sign-in provider disconnected."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not disconnect your account."); }
    finally { setBusy(false); }
  }
  const providers = (["google", "github"] as const).filter(provider => bootstrap.providers[provider]);
  const ordered = [...sessions].sort((a, b) => (b.id === current ? 1 : 0) - (a.id === current ? 1 : 0));

  return <SettingsSection title="Sessions and sign-in" description="Every browser where you’re signed in, and the providers you can sign in with. Sign out anything you don’t recognize.">
    {error ? <Notice type="error">{error}</Notice> : null}{message ? <Notice type="success">{message}</Notice> : null}
    {loading ? <Loading label="Loading your sessions"/> : <>
      <h3 className="sub-head">Active sessions</h3>
      <ul className="plain-list session-list">{ordered.map(session => <li key={session.id}>
        <span className="file-icon"><Icon name="terminal" size={18}/></span>
        <div className="grow"><strong>{deviceName(session.userAgent)}</strong><span className="muted">Signed in {formatDate(session.createdAt)}, expires {formatDate(session.expiresAt)}</span></div>
        {session.id === current ? <span className="pill pill-progress">This browser</span> : <button className="text-button danger-text" disabled={busy || !session.token} onClick={() => revoke(session)}>Sign out</button>}
      </li>)}</ul>
      {providers.length ? <>
        <h3 className="sub-head">Sign-in providers</h3>
        <p className="fine-print">Link only accounts you own. You can’t remove your last way to sign in.</p>
        <ul className="plain-list">{providers.map(provider => { const account = accounts.find(a => a.providerId === provider); return <li key={provider}>
          <div className="grow"><strong>{provider === "google" ? "Google" : "GitHub"}</strong><span className="muted">{account ? `Connected ${formatDate(account.createdAt)}` : "Not connected"}</span></div>
          <button className="button button-secondary button-small" onClick={() => account ? disconnect(account) : connect(provider)} disabled={busy || !!account && accounts.length < 2}>{account ? "Disconnect" : "Connect"}</button>
        </li>; })}</ul>
      </> : null}
    </>}
  </SettingsSection>;
}

function deviceName(agent?: string) {
  if (!agent) return "Browser session";
  const browser = agent.includes("Edg/") ? "Edge" : agent.includes("Firefox/") ? "Firefox" : agent.includes("Chrome/") ? "Chrome" : agent.includes("Safari/") ? "Safari" : "Browser";
  const system = agent.includes("Windows") ? "Windows" : agent.includes("Android") ? "Android" : agent.includes("iPhone") || agent.includes("iPad") ? "iOS" : agent.includes("Mac") ? "macOS" : agent.includes("Linux") ? "Linux" : "your device";
  return `${browser} on ${system}`;
}
