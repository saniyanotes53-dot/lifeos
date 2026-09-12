import React, { useState } from "react";
import { Mail, Lock, User as UserIcon, Sparkles, Eye, EyeOff } from "lucide-react";
import { inputStyle } from "../theme";
import { Field, PrimaryButton, GhostButton, Hero } from "./primitives";
import { registerWithEmail, loginWithEmail, loginWithGoogle, resetPassword } from "../auth";

export default function AuthScreen({ t, onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const formatAuthError = (e) => {
    const msg = e?.message || "";
    if (msg.includes("Invalid login credentials")) return "Invalid email or password. If you haven't registered yet, tap 'Create an account'.";
    if (msg.includes("User already registered")) return "This email is already registered. Please log in instead.";
    if (msg.includes("Password should be at least")) return "Password must be at least 6 characters long.";
    if (msg.includes("Unable to validate email address")) return "Please enter a valid email address.";
    if (msg.includes("Email not confirmed")) return "Check your inbox for a confirmation email before logging in.";
    return msg || "Sign-in could not be completed. Please try again.";
  };

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setMsg("");
    if (mode === "reset") {
      if (!email) { setMsg("Enter your email address."); return; }
      try {
        setLoading(true);
        await resetPassword(email.trim());
        setMsg("Password reset link sent to " + email + ". Check your inbox.");
      } catch (e) {
        setMsg(formatAuthError(e));
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!email || !pw) { setMsg("Enter an email and password to continue."); return; }
    try {
      setLoading(true);
      if (mode === "register") {
        const user = await registerWithEmail(name.trim(), email.trim(), pw);
        onLogin(user);
      } else {
        const user = await loginWithEmail(email.trim(), pw);
        onLogin(user);
      }
    } catch (e) {
      setMsg(formatAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setMsg("");
    try {
      setLoading(true);
      const user = await loginWithGoogle();
      onLogin(user);
    } catch (e) {
      setMsg(formatAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      <Hero t={t} height={220} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", padding: "28px" }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div className="pulse" style={{
            width: 58, height: 58, margin: "0 auto 16px", borderRadius: 18,
            background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`, display: "flex", alignItems: "center",
            justifyContent: "center", boxShadow: `0 10px 26px -8px ${t.a1}aa`
          }}>
            <Sparkles size={26} color={t.onAccent} />
          </div>
          <h1 style={{ fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 27, color: t.text, margin: "0 0 4px" }}>Life OS</h1>
          <div style={{ fontSize: 13, color: t.muted }}>Your day, budget, and body — one calm screen</div>
        </div>

        <form onSubmit={submit} aria-label={mode === "reset" ? "Reset password" : mode === "register" ? "Create account" : "Log in"}>
        {mode === "register" && (
          <Field t={t} label="Name">
            <div style={{ position: "relative" }}>
              <UserIcon size={15} color={t.muted} style={{ position: "absolute", left: 12, top: 12 }} />
              <input aria-label="Your name" name="name" autoComplete="name" required style={{ ...inputStyle(t), paddingLeft: 34 }} value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
            </div>
          </Field>
        )}
        <Field t={t} label="Email">
          <div style={{ position: "relative" }}>
            <Mail size={15} color={t.muted} style={{ position: "absolute", left: 12, top: 12 }} />
            <input aria-label="you@example.com" name="email" type="email" autoComplete="username" required style={{ ...inputStyle(t), paddingLeft: 34 }} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
        </Field>
        {mode !== "reset" && (
          <Field t={t} label="Password">
            <div style={{ position: "relative" }}>
              <Lock size={15} color={t.muted} style={{ position: "absolute", left: 12, top: 12 }} />
              <input aria-label="Enter your password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 6 : undefined} aria-describedby={mode === "register" ? "password-help" : undefined} style={{ ...inputStyle(t), paddingLeft: 34, paddingRight: 48 }} value={pw} onChange={e => setPw(e.target.value)} placeholder="Enter your password" />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)} className="action-reset" style={{ position: "absolute", right: 0, top: 0, width: 44, height: 44, color: t.muted, cursor: "pointer" }}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </Field>
        )}

        {mode === "register" && <p id="password-help" style={{ fontSize: 14, color: t.muted }}>Use at least 6 characters.</p>}
        {msg && <div role="status" aria-live="polite" style={{ fontSize: 14, color: t.a1, marginBottom: 12 }}>{msg}</div>}

        <PrimaryButton t={t} type="submit" disabled={loading} style={{ marginBottom: 10 }}>
          {loading ? "Please wait…" : mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Send reset link"}
        </PrimaryButton>

        </form>
        {mode !== "reset" && (
          <GhostButton t={t} disabled={loading} onClick={google} style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.4 29.4 35.5 24 35.5c-6.9 0-12.5-5.6-12.5-12.5S17.1 10.5 24 10.5c3.2 0 6 1.2 8.2 3.1l6-6C34.6 4.1 29.6 2 24 2 11.9 2 2 11.9 2 24s9.9 22 22 22c11 0 21-8 21-22 0-1.2-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.2 0 6 1.2 8.2 3.1l6-6C34.6 4.1 29.6 2 24 2c-7.7 0-14.3 4.4-17.7 10.7z" /><path fill="#4CAF50" d="M24 46c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.5 37.1 26.9 38 24 38c-5.3 0-9.8-3.4-11.4-8.1l-6.6 5.1C9.6 41.5 16.2 46 24 46z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3 5.3-5.7 6.9l6.6 5.4C39.9 37.6 44 31.7 44 24c0-1.2-.1-2.4-.4-3.5z" /></svg>
            Continue with Google
          </GhostButton>
        )}

        <div style={{ textAlign: "center", fontSize: 14, color: t.muted }}>
          {mode === "login" && <>New here? <button type="button" className="link-button" disabled={loading} onClick={() => { setShowPassword(false); setMode("register"); setMsg(""); }} style={{ color: t.a1, cursor: "pointer" }}>Create an account</button></>}
          {mode === "register" && <>Have an account? <button type="button" className="link-button" disabled={loading} onClick={() => { setShowPassword(false); setMode("login"); setMsg(""); }} style={{ color: t.a1, cursor: "pointer" }}>Log in</button></>}
          {mode === "reset" && <>Remembered it? <button type="button" className="link-button" disabled={loading} onClick={() => { setShowPassword(false); setMode("login"); setMsg(""); }} style={{ color: t.a1, cursor: "pointer" }}>Back to login</button></>}
          {mode !== "reset" && <div style={{ marginTop: 8 }}><button type="button" className="link-button" disabled={loading} onClick={() => { setShowPassword(false); setMode("reset"); setMsg(""); }} style={{ color: t.muted, cursor: "pointer", textDecoration: "underline" }}>Forgot password?</button></div>}
        </div>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: t.muted, opacity: 0.85 }}>
          This website is designed by <strong style={{ color: t.a1 }}>Buraq Studios</strong> · Copyright all rights reserved
        </div>
      </div>
    </div>
  );
}
