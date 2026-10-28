"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Bootstrap, Community } from "@/lib/types";
import AsciiField from "./ascii-field";
import { api, Icon, Loading, Notice, Spinner, Wordmark } from "./ui";

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
  const [weekly, setWeekly] = useState<Community["weekly"]>(null);
  useEffect(() => { api<Community>("/api/v1/community").then(d => setWeekly(d.weekly)).catch(() => undefined); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("token");
    if (resetToken && (params.get("reset") === "1" || window.location.pathname.includes("reset"))) { setToken(resetToken); setMode("reset"); }
    if (params.has("verified")) setMessage("Your email is verified. Sign in to continue.");
    if (params.get("passwordReset") === "1") setMessage("Password updated. Sign in with your new password.");
    if (params.get("error")) setError("This link could not be used. Request a new email and try again.");
  }, []);

  useEffect(() => { setMode(m => m === "reset" || m === "mfa" ? m : initialMode); }, [initialMode]);

  function changeMode(next: AuthMode) {
    if (mode === "reset" && next === "signin") { window.location.replace("/?auth=signin"); return; }
    setMode(next); setError(""); setMessage(""); setPassword("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "forgot") {
        await api("/api/auth/request-password-reset", { method: "POST", body: JSON.stringify({ email, redirectTo: `${window.location.origin}/?reset=1` }) });
        setMessage("If this address has an account, a reset link is on its way. Check your email.");
      } else if (mode === "reset") {
        await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword: password }) });
        window.location.replace("/?auth=signin&passwordReset=1");
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
    signin: "Pick up where you left off. Your solves, points, and rank are saved to your account.",
    signup: "You’ll verify your email, then pick the codename that appears on the leaderboard.",
    forgot: "Enter your account email and we’ll send a link to set a new password.",
    reset: "Use at least 15 characters. A memorable passphrase works well.",
    mfa: "Enter the 6-digit code from your authenticator app.",
  }[mode];
  const action = { signin: "Sign in", signup: "Create account", forgot: "Send reset link", reset: "Update password", mfa: "Verify and continue" }[mode];
  const brand = back ? <button className="brand-link" onClick={back} aria-label="Back to the dfCTF home page"><Wordmark /></button> : <Wordmark />;

  return <div className="auth">
    <aside className="auth-brand" aria-label="About dfCTF">
      <AsciiField className="auth-ascii" ox={0.6} oy={1.05} rx={0.7} ry={0.6} fadeFrom={-1} fadeTo={0} />
      <div className="auth-brand-top">{brand}</div>
      <div className="auth-pitch"><h1>Every challenge<br />hides a flag.</h1><p>Find it, submit it, and climb the leaderboard. Wrong answers never cost points.</p>
        {weekly ? <span className="live-chip"><i aria-hidden="true" />This week<span className="mono muted">{weekly.title}, {weekly.xp} pts</span></span> : null}</div>
    </aside>
    <main className="auth-main" id="main-content">
      <div className="auth-mobile-top">{brand}</div>
      <div className="auth-form">
        {back && (mode === "signin" || mode === "signup") ? <button className="text-button back-link" onClick={back}><Icon name="back" size={16} />Home</button> : null}
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
        {mode === "signin" || mode === "signup" ? <div className="segmented block" role="group" aria-label="Choose an option">
          <button type="button" aria-pressed={mode === "signin"} onClick={() => changeMode("signin")}>Sign in</button>
          <button type="button" aria-pressed={mode === "signup"} onClick={() => changeMode("signup")}>Create account</button>
        </div> : null}
        {message ? <Notice type="success">{message}</Notice> : null}{error ? <Notice type="error">{error}</Notice> : null}
        <form onSubmit={submit} className="stack">
          {mode !== "mfa" && mode !== "reset" ? <label className="field"><span>Email</span><input type="email" name="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={busy} /></label> : null}
          {mode === "signin" || mode === "signup" || mode === "reset" ? <div className="field">
            <div className="label-row"><label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</label>{mode === "signin" ? <button type="button" className="text-button" onClick={() => changeMode("forgot")}>Forgot password?</button> : null}</div>
            <div className="password-input"><input id="password" type={showPassword ? "text" : "password"} name="password" required minLength={mode === "signin" ? 1 : 15} maxLength={128} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} aria-describedby={mode !== "signin" ? "password-help" : undefined} /><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button></div>
            {mode !== "signin" ? <small id="password-help">At least 15 characters, up to 128. {password.length ? <span className="mono">{password.length} so far.</span> : null}</small> : null}
          </div> : null}
          {mode === "mfa" ? <div className="field"><label htmlFor="mfa-code">{backup ? "Backup code" : "Authenticator code"}</label><input id="mfa-code" className={backup ? "mono" : "mono code-input"} autoComplete="one-time-code" inputMode={backup ? "text" : "numeric"} value={code} onChange={e => setCode(e.target.value)} required placeholder={backup ? "One unused backup code" : "000000"} pattern={backup ? undefined : "[0-9]{6}"} maxLength={backup ? 50 : 6} /><button type="button" className="text-button" onClick={() => { setBackup(v => !v); setCode(""); }}>{backup ? "Use your authenticator app instead" : "Use a backup code instead"}</button></div> : null}
          <button className="button button-primary w-full" type="submit" disabled={busy}>{busy ? <><Spinner />Working</> : action}</button>
        </form>
        {mode === "signin" || mode === "signup" ? <>
          <div className="divider"><span>or continue with</span></div>
          <div className="social" role="group" aria-label="Social sign-in options" aria-describedby={!bootstrap.providers.github || !bootstrap.providers.google ? "social-availability" : undefined}>
            {(["github", "google"] as const).map(provider => <button key={provider} type="button" className="button button-secondary social-button" onClick={() => social(provider)} disabled={busy || !bootstrap.providers[provider]}>
              <SocialIcon provider={provider} />
              <span>Continue with {provider === "google" ? "Google" : "GitHub"}</span>
              {!bootstrap.providers[provider] ? <small className="social-status">Coming soon</small> : null}
            </button>)}
          </div>
          {!bootstrap.providers.github || !bootstrap.providers.google ? <p className="fine social-help" id="social-availability">Social sign-in options are still being configured. You can continue with email and password.</p> : null}
        </> : null}
        {mode === "forgot" || mode === "reset" || mode === "mfa" ? <button className="text-button back-link" onClick={() => changeMode("signin")}><Icon name="back" size={16} />Back to sign in</button> : null}
        {mode === "signin" ? <p className="fine">New here? Create an account, verify your email, and pick a codename. It takes about a minute.</p> : null}
        {bootstrap.localMail ? <div className="dev-box"><p>Verification and password-reset emails are saved locally in development. Account records use the database configured for this app.</p><LocalInbox /></div> : null}
      </div>
    </main>
  </div>;
}

function SocialIcon({ provider }: { provider: "google" | "github" }) {
  return provider === "google" ? <svg className="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" />
    <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" />
  </svg> : <svg className="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M12 .5A11.5 11.5 0 0 0 8.36 22.91c.58.11.79-.25.79-.56v-2.02c-3.22.7-3.9-1.36-3.9-1.36-.53-1.34-1.3-1.7-1.3-1.7-1.06-.73.08-.72.08-.72 1.18.08 1.8 1.21 1.8 1.21 1.04 1.79 2.74 1.27 3.4.97.11-.75.41-1.27.75-1.56-2.57-.29-5.28-1.29-5.28-5.72 0-1.27.45-2.3 1.21-3.11-.12-.3-.52-1.48.12-3.08 0 0 .98-.31 3.21 1.2a11.16 11.16 0 0 1 5.84 0c2.23-1.51 3.21-1.2 3.21-1.2.64 1.6.24 2.78.12 3.08.76.81 1.21 1.84 1.21 3.11 0 4.44-2.71 5.42-5.29 5.71.42.36.79 1.05.79 2.12v3.13c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
  </svg>;
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
    <button className="text-button" onClick={open ? () => setOpen(false) : load} aria-expanded={open}><Icon name="mail" size={16} />{open ? "Close the local mailbox" : "Open the local mailbox"}</button>
    {open ? <div className="inbox">
      <div className="inbox-head"><strong>Development mail</strong><button className="text-button" onClick={load} disabled={busy}>Refresh</button></div>
      {busy ? <Loading label="Checking the mailbox" /> : error ? <Notice type="error">{error}</Notice> : messages.length ? messages.map(message => <div className="inbox-item" key={message.id}><strong>{message.subject}</strong><span className="muted">To {message.to}</span><a className="text-button" href={message.url}>Open the link in this email</a></div>) : <p className="muted">No messages yet. Request a verification or reset email and it will appear here.</p>}
    </div> : null}
  </div>;
}
