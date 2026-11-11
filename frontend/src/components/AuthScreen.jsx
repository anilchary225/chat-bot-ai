import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, LoaderCircle, Mail, ShieldCheck, User } from "lucide-react";
import Orb from "./Orb";
import Aurora from "./Aurora";
import GoogleButton, { googleEnabled } from "./GoogleButton";
import { setToken } from "../auth";

const spring = { type: "spring", stiffness: 300, damping: 28 };

function CodeInput({ value, onChange, onComplete, disabled, error }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, " ").split("").slice(0, 6);

  const setAt = (index, char) => {
    const next = digits.map((d, i) => (i === index ? char : d)).join("").replace(/\s+$/, "");
    onChange(next);
    if (next.replace(/\s/g, "").length === 6 && !next.includes(" ")) onComplete(next);
  };

  const handleChange = (index, event) => {
    const raw = event.target.value.replace(/\D/g, "");
    if (!raw) return;
    if (raw.length > 1) {  // pasted or autofilled the whole code
      const code = raw.slice(0, 6);
      onChange(code);
      refs.current[Math.min(code.length, 5)]?.focus();
      if (code.length === 6) onComplete(code);
      return;
    }
    setAt(index, raw);
    if (index < 5) refs.current[index + 1]?.focus();
  };

  const handleKey = (index, event) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index].trim()) setAt(index, " ");
      else if (index > 0) { setAt(index - 1, " "); refs.current[index - 1]?.focus(); }
    } else if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    else if (event.key === "ArrowRight" && index < 5) refs.current[index + 1]?.focus();
  };

  useEffect(() => { refs.current[0]?.focus(); }, []);

  return (
    <motion.div
      className={`otp ${error ? "has-error" : ""}`}
      animate={error ? { x: [0, -10, 10, -7, 7, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      {digits.map((digit, i) => (
        <motion.input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className={digit.trim() ? "filled" : ""}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={i === 0 ? 6 : 1}
          value={digit.trim()}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.target.select()}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, scale: digit.trim() ? [1, 1.08, 1] : 1 }}
          transition={{ delay: i * 0.04 }}
        />
      ))}
    </motion.div>
  );
}

export default function AuthScreen({ api, onSignedIn }) {
  const [mode, setMode] = useState("signin");
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const fail = (message) => { setError(message); setShake((n) => n + 1); };

  const requestCode = async (event) => {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${api}/api/auth/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), mode, name: mode === "signup" ? name.trim() : undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof data.detail === "string" ? data.detail : "Enter a valid email address.";
        if (res.status === 404) setMode("signup");
        if (res.status === 409) setMode("signin");
        throw new Error(detail);
      }
      setCode("");
      setStep("code");
      setCooldown(data.resend_after || 60);
    } catch (err) {
      fail(err.message || "Couldn't send the code. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (busy || !/^\d{6}$/.test(value)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${api}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: value })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "That code isn't right.");
      setToken(data.token);
      onSignedIn(data.user);
    } catch (err) {
      setCode("");
      fail(err.message);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next) => { setMode(next); setError(""); };

  const googleSignIn = async (credential) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${api}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Google sign-in failed.");
      setToken(data.token);
      onSignedIn(data.user);
    } catch (err) {
      fail(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <Aurora />
      <div className="auth-grid">
        <motion.section
          className="auth-hero"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Orb size={120} track state={busy ? "thinking" : "idle"} />
          <h1>Meet <span className="rt-grad">Zenoxi</span></h1>
          <p>Your thinking partner on the web, WhatsApp and Instagram, with one conversation everywhere.</p>
          <ul>
            {["Live web search with sources", "Chat with your PDFs and documents", "Resume ATS match & one-page template"].map((item, i) => (
              <motion.li key={item} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }}>
                <ShieldCheck size={15} /> {item}
              </motion.li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          className="auth-card"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.1 }}
        >
          {/* Keyed swap with an enter animation only: a "wait" exit can stall while the
              outgoing form re-renders (busy/cooldown state), leaving the card blank. */}
          {step === "email" ? (
              <motion.form
                key="email"
                onSubmit={requestCode}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="auth-tabs" role="tablist">
                  {[["signin", "Sign in"], ["signup", "Sign up"]].map(([key, label]) => (
                    <button key={key} type="button" role="tab" aria-selected={mode === key} className={mode === key ? "on" : ""} onClick={() => switchMode(key)}>
                      {mode === key && <motion.span layoutId="auth-tab" className="auth-tab-bg" transition={spring} />}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
                <p className="auth-sub">{googleEnabled ? "Continue with Google, or get a 6-digit code by email." : "We'll email you a 6-digit code. No password needed."}</p>

                {googleEnabled && (
                  <>
                    <GoogleButton onCredential={googleSignIn} text={mode === "signup" ? "signup_with" : "continue_with"} />
                    <div className="auth-divider"><span>or use email</span></div>
                  </>
                )}

                <AnimatePresence initial={false}>
                  {mode === "signup" && (
                    <motion.label
                      className="auth-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <span>Name</span>
                      <div><User size={16} /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" maxLength={60} required /></div>
                    </motion.label>
                  )}
                </AnimatePresence>
                <label className="auth-field">
                  <span>Email</span>
                  <div><Mail size={16} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required autoFocus /></div>
                </label>

                <AnimatePresence>
                  {error && (
                    <motion.p key={shake} className="auth-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0, x: [0, -6, 6, -3, 3, 0] }} exit={{ opacity: 0 }}>
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button className="auth-primary" type="submit" disabled={busy} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  {busy ? <LoaderCircle size={17} className="spin" /> : <>Send code <ArrowRight size={17} /></>}
                </motion.button>
                <p className="auth-switch">
                  {mode === "signin" ? "New to Zenoxi? " : "Already have an account? "}
                  <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>
                    {mode === "signin" ? "Create an account" : "Sign in"}
                  </button>
                </p>
              </motion.form>
            ) : (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <button type="button" className="auth-back" onClick={() => { setStep("email"); setError(""); }}>
                  <ArrowLeft size={15} /> Change email
                </button>
                <motion.div className="auth-mail-icon" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
                  <Mail size={24} />
                </motion.div>
                <h2>Check your email</h2>
                <p className="auth-sub">Enter the 6-digit code we sent to <strong>{email.trim()}</strong>. It expires in 10 minutes.</p>
                <CodeInput value={code} onChange={setCode} onComplete={verify} disabled={busy} error={shake} key={shake} />
                <AnimatePresence>
                  {error && (
                    <motion.p className="auth-error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{error}</motion.p>
                  )}
                </AnimatePresence>
                <motion.button className="auth-primary" type="button" disabled={busy || !/^\d{6}$/.test(code)} onClick={() => verify()} whileTap={{ scale: 0.97 }}>
                  {busy ? <LoaderCircle size={17} className="spin" /> : mode === "signup" ? "Create account" : "Sign in"}
                </motion.button>
                <p className="auth-switch">
                  Didn't get it? Check spam, or{" "}
                  <button type="button" disabled={cooldown > 0 || busy} onClick={requestCode}>
                    {cooldown > 0 ? `resend in ${cooldown}s` : "resend the code"}
                  </button>
                </p>
              </motion.div>
          )}
        </motion.section>
      </div>
    </div>
  );
}
