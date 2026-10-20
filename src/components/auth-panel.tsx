"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Bootstrap } from "@/lib/types";
import CampusScene from "./campus-scene";
import { api, Brand, Icon, Loading, Notice, ThemeToggle } from "./ui";

export type AuthMode = "signin" | "signup" | "forgot" | "reset" | "mfa";

export default function AuthPanel({ bootstrap, refresh, initialMode = "signin", back }: { bootstrap: Bootstrap; refresh: () => Promise<void>; initialMode?: AuthMode; back?: () => void }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [backup, setBackup] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("token");
    if (resetToken && (params.get("reset") === "1" || window.location.pathname.includes("reset"))) { setToken(resetToken); setMode("reset"); }
    if (params.has("verified")) setMessage("Your email is verified. Sign in to continue.");
    if (params.get("error")) setError("This link could not be used. Request a new email and try again.");
  }, []);

  useEffect(() => { setMode(m => m === "reset" || m === "mfa" ? m : initialMode); }, [initialMode]);

  function changeMode(next: AuthMode) { setMode(next); setError(""); setMessage(""); setPassword(""); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "forgot") {
        await api("/api/auth/request-password-reset", { method: "POST", body: JSON.stringify({ email, redirectTo: `${window.location.origin}/?reset=1` }) });
        setMessage("If this address has an account, a reset link is on its way. Check your email.");
      } else if (mode === "reset") {
        await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword: password }) });
        window.history.replaceState(null, "", "/?auth=signin"); setMode("signin"); setMessage("Password updated. Sign in with your new password."); setPassword("");
      } else if (mode === "mfa") {
        await api("/api/v1/auth/mfa/verify", { method: "POST", body: JSON.stringify({ code, method: backup ? "backup" : "totp" }) });
        await refresh();
      } else {
        const result = await api<{ twoFactorRedirect?: boolean }>(`/api/auth/${mode === "signup" ? "sign-up" : "sign-in"}/email`, { method: "POST", body: JSON.stringify({ email, password, ...(mode === "signup" ? { name: email.split("@")[0] } : {}), callbackURL: window.location.origin }) });
        if (result.twoFactorRedirect) { setMode("mfa"); setPassword(""); }
        else { await refresh(); if (mode === "signup") setMessage("Account created. Check your email to verify your address, then sign in."); }
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to continue. Please try again."); }
    finally { setBusy(false); }
  }

  async function social(provider: "google" | "github") {
    setBusy(true); setError("");
    try {
      const result = await api<{ url?: string }>("/api/auth/sign-in/social", { method: "POST", body: JSON.stringify({ provider, callbackURL: window.location.origin }) });
      if (result.url) window.location.assign(result.url); else throw new Error("The provider did not return a sign-in link.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to connect."); setBusy(false); }
  }

  const title = { signin: "Sign in to dfCTF", signup: "Create your account", forgot: "Reset your password", reset: "Choose a new password", mfa: "Verify it’s you" }[mode];
  const subtitle = {
    signin: "Pick up where you left off. Your progress is saved to your account.",
    signup: "Use the email your organizer added to the beta list. You’ll verify it, then choose a codename.",
    forgot: "Enter your account email and we’ll send a link to set a new password.",
    reset: "Use at least 15 characters. A memorable passphrase works well.",
    mfa: "Enter the 6-digit code from your authenticator app.",
  }[mode];
  const action = { signin: "Sign in", signup: "Create account", forgot: "Send reset link", reset: "Update password", mfa: "Verify and continue" }[mode];

  return <div className="auth-screen">
    <aside className="auth-art" aria-label="About dfCTF">
      <div className="auth-art-top">{back ? <button className="brand-link" onClick={back} aria-label="Back to the dfCTF home page"><Brand/></button> : <Brand/>}<ThemeToggle compact/></div>
      <div className="auth-art-copy"><h1 className="display display-auth">Every case starts with a closer look.</h1><p>Download the evidence, work it on your own machine, and bring back the flag.</p></div>
      <CampusScene width={300} height={150} className="auth-scene"/>
    </aside>

    <main className="auth-main" id="main-content">
      <div className="auth-mobile-top">{back ? <button className="brand-link" onClick={back} aria-label="Back to the dfCTF home page"><Brand/></button> : <Brand/>}<ThemeToggle compact/></div>
      <div className="auth-form-wrap">
        {back && (mode === "signin" || mode === "signup") ? <button className="text-button back-link" onClick={back}><Icon name="back" size={16}/>Home</button> : null}
        <h2 className="auth-title">{title}</h2>
        <p className="auth-description">{subtitle}</p>
        {mode === "signin" || mode === "signup" ? <div className="segmented" role="group" aria-label="Choose an option">
          <button type="button" aria-pressed={mode === "signin"} onClick={() => changeMode("signin")}>Sign in</button>
          <button type="button" aria-pressed={mode === "signup"} onClick={() => changeMode("signup")}>Create account</button>
        </div> : null}
        {message ? <Notice type="success">{message}</Notice> : null}{error ? <Notice type="error">{error}</Notice> : null}
        <form onSubmit={submit} className="form-stack">
          {mode !== "mfa" && mode !== "reset" ? <label className="field">Email address<input type="email" name="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.edu" disabled={busy}/></label> : null}
          {mode === "signin" || mode === "signup" || mode === "reset" ? <div className="field">
            <div className="label-row"><label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</label>{mode === "signin" ? <button type="button" className="text-button" onClick={() => changeMode("forgot")}>Forgot password?</button> : null}</div>
            <div className="password-input"><input id="password" type={showPassword ? "text" : "password"} name="password" required minLength={mode === "signin" ? 1 : 15} maxLength={128} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} aria-describedby={mode !== "signin" ? "password-help" : undefined}/><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}><Icon name="eye" size={17}/><span>{showPassword ? "Hide" : "Show"}</span></button></div>
            {mode !== "signin" ? <span className="field-help" id="password-help">At least 15 characters, up to 128. {password.length ? <span className="tabular">{password.length} so far.</span> : null}</span> : null}
          </div> : null}
          {mode === "mfa" ? <div className="field"><label htmlFor="mfa-code">{backup ? "Backup code" : "Authenticator code"}</label><input id="mfa-code" className={backup ? "" : "code-input"} autoComplete="one-time-code" inputMode={backup ? "text" : "numeric"} value={code} onChange={e => setCode(e.target.value)} required placeholder={backup ? "One unused backup code" : "000000"} pattern={backup ? undefined : "[0-9]{6}"} maxLength={backup ? 50 : 6}/><button type="button" className="text-button" onClick={() => { setBackup(v => !v); setCode(""); }}>{backup ? "Use your authenticator app instead" : "Use a backup code instead"}</button></div> : null}
          <button className="button button-primary button-block" type="submit" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true"/>Working…</> : action}</button>
        </form>
        {(mode === "signin" || mode === "signup") && (bootstrap.providers.google || bootstrap.providers.github) ? <><div className="divider-label"><span>or continue with</span></div><div className="social-buttons">{bootstrap.providers.google ? <button className="button button-secondary" onClick={() => social("google")} disabled={busy}>Google</button> : null}{bootstrap.providers.github ? <button className="button button-secondary" onClick={() => social("github")} disabled={busy}>GitHub</button> : null}</div></> : null}
        {mode === "forgot" || mode === "reset" || mode === "mfa" ? <button className="text-button back-link" onClick={() => changeMode("signin")}><Icon name="back" size={16}/>Back to sign in</button> : null}
        <p className="auth-fine-print"><Icon name="lock" size={15}/>dfCTF is in private beta. Your organizer manages who can enter.</p>
        {bootstrap.localMail ? <div className="dev-box"><p>Local development: the generated accounts are in <code>.data/bootstrap.txt</code>.</p><LocalInbox/></div> : null}
      </div>
    </main>
  </div>;
}

export function LocalInbox() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ id: string; to: string; subject: string; url: string; createdAt: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setOpen(true); setBusy(true); setError("");
    try { const data = await api<{ messages: typeof messages }>("/api/v1/auth/local-mail"); setMessages(data.messages ?? []); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load local mail."); }
    finally { setBusy(false); }
  }
  return <div className="local-inbox">
    <button className="text-button" onClick={open ? () => setOpen(false) : load} aria-expanded={open}><Icon name="mail" size={16}/>{open ? "Close the local mailbox" : "Open the local mailbox"}</button>
    {open ? <div className="inbox-messages">
      <div className="inbox-head"><strong>Development mail</strong><button className="text-button" onClick={load} disabled={busy}>Refresh</button></div>
      {busy ? <Loading label="Checking the mailbox"/> : error ? <Notice type="error">{error}</Notice> : messages.length ? messages.map(message => <div className="local-mail-item" key={message.id}><strong>{message.subject}</strong><span>To {message.to}</span><a className="text-button" href={message.url}>Open the link in this email</a></div>) : <p className="muted">No messages yet. Request a verification or reset email and it will appear here.</p>}
    </div> : null}
  </div>;
}
