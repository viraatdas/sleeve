"use client";

import { ArrowLeft, ArrowRight, Check, LockKeyhole, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SleeveApiError, sleeveApi } from "./client-api";
import type { SessionUser } from "./types";

interface LoginScreenProps {
  allowDemo: boolean;
  onAuthenticated: (user: SessionUser) => void;
  onPreview: () => void;
}

export function LoginScreen({ allowDemo, onAuthenticated, onPreview }: LoginScreenProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await sleeveApi.requestCode(email.trim());
      setStep("code");
    } catch (caught) {
      setError(caught instanceof SleeveApiError ? caught.message : "We couldn’t send a code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const session = await sleeveApi.verifyCode(email.trim(), code.replace(/\D/g, ""), remember);
      if (!session.authenticated) throw new SleeveApiError("That code couldn’t be verified.", 401);
      onAuthenticated(session.user ?? { email });
    } catch (caught) {
      setError(caught instanceof SleeveApiError ? caught.message : "That code didn’t work. Check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-story" aria-labelledby="login-brand-title">
        <a className="wordmark wordmark--light" href="#login-form" aria-label="Sleeve home">
          <span className="wordmark__mark" aria-hidden="true"><span /></span>
          Sleeve
        </a>
        <div className="login-story__copy">
          <p className="login-story__note"><Check size={16} aria-hidden="true" /> Private by default</p>
          <h1 id="login-brand-title">Everything important,<br />kept close.</h1>
          <p>Health, identity, insurance, and family records—organized without making sensitive information feel casual.</p>
        </div>
        <div className="login-story__security">
          <LockKeyhole size={18} strokeWidth={1.6} aria-hidden="true" />
          <span><strong>Highly secure.</strong> Encrypted records, short-lived sharing, and private source files.</span>
        </div>
      </section>

      <section className="login-panel" id="login-form" aria-labelledby="login-title">
        <div className="login-panel__inner">
          <div className="mobile-wordmark"><span className="wordmark__mark" aria-hidden="true"><span /></span>Sleeve</div>
          {step === "email" ? (
            <>
              <div className="login-heading">
                <h2 id="login-title">Come on in.</h2>
                <p>Enter your email and we’ll send a one-time code. No password to remember.</p>
              </div>
              <form onSubmit={sendCode} noValidate>
                <label className="field-label" htmlFor="email">Email address</label>
                <div className="input-with-icon">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-describedby={error ? "login-error" : "email-help"}
                    aria-invalid={Boolean(error)}
                  />
                </div>
                <p className="field-help" id="email-help">The code expires after 10 minutes.</p>
                {error ? <p className="form-error" id="login-error" role="alert">{error}</p> : null}
                <button className="button button--primary button--full" type="submit" disabled={busy || !email.trim()}>
                  {busy ? "Sending…" : "Send one-time code"}<ArrowRight size={18} aria-hidden="true" />
                </button>
              </form>
            </>
          ) : (
            <>
              <button className="back-button" type="button" onClick={() => { setStep("email"); setError(""); }}>
                <ArrowLeft size={17} aria-hidden="true" /> Change email
              </button>
              <div className="login-heading">
                <h2 id="login-title">Check your inbox.</h2>
                <p>Enter the six-digit code sent to <strong>{email}</strong>.</p>
              </div>
              <form onSubmit={verifyCode} noValidate>
                <label className="field-label" htmlFor="code">One-time code</label>
                <input
                  className="code-input"
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={Boolean(error)}
                />
                <label className="check-row">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  <span><strong>Remember this device</strong><small>Stay signed in on this private device.</small></span>
                </label>
                {error ? <p className="form-error" id="login-error" role="alert">{error}</p> : null}
                <button className="button button--primary button--full" type="submit" disabled={busy || code.length !== 6}>
                  {busy ? "Verifying…" : "Open my Sleeve"}<ArrowRight size={18} aria-hidden="true" />
                </button>
              </form>
            </>
          )}
          {allowDemo ? (
            <div className="demo-preview">
              <span>Local development only</span>
              <button type="button" onClick={onPreview}>Preview the demo workspace</button>
            </div>
          ) : null}
          <p className="login-footnote">By continuing, you agree to keep access to this account private.</p>
        </div>
      </section>
    </main>
  );
}

