import React, { useState } from "react";
import { Mail, Lock, User as UserIcon, Sparkles } from "lucide-react";
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

  const formatAuthError = (e) => {
    const code = e?.code || "";
    switch (code) {
      case "auth/configuration-not-found":
        return "Email/Password provider is not enabled in Firebase Console. Go to Firebase Console → Authentication → Sign-in method, click 'Email/Password' and enable it.";
      case "auth/operation-not-allowed":
        return "Sign-in method is not enabled in Firebase Console. Go to Authentication → Sign-in method to enable it.";
      case "auth/user-not-found":
        return "No account found with this email. Click 'Create an account' below to sign up.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Invalid email or password. If you haven't registered yet, tap 'Create an account'.";
      case "auth/email-already-in-use":
        return "This email is already registered. Please log in instead.";
      case "auth/weak-password":
        return "Password must be at least 6 characters long.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/popup-closed-by-user":
        return "Google sign-in popup was closed before completion.";
      case "auth/unauthorized-domain": {
        const hostname = typeof window !== "undefined" ? window.location.hostname : "this website";
        return `Firebase is blocking sign-in from ${hostname}. Add this domain in Firebase Console → Authentication → Settings → Authorized domains, then reload the website.`;
      }
      default:
        return "Sign-in could not be completed. Check your Firebase Authentication settings and try again.";
    }
  };

  const submit = async () => {
    setMsg("");
    if (mode === "reset") {
      if (!email) { setMsg("Enter your email address."); return; }
      try {
        setLoading(true);
        await resetPassword(email);
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
        const user = await registerWithEmail(name, email, pw);
        onLogin(user);
      } else {
        const user = await loginWithEmail(email, pw);
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
      <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", padding: "0 28px" }}>
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

        {mode === "register" && (
          <Field t={t} label="Name">
            <div style={{ position: "relative" }}>
              <UserIcon size={15} color={t.muted} style={{ position: "absolute", left: 12, top: 12 }} />
              <input style={{ ...inputStyle(t), paddingLeft: 34 }} value={name} onChange={e => setName(e.target.value)} placeholder="Murtaza" />
            </div>
          </Field>
        )}
        <Field t={t} label="Email">
          <div style={{ position: "relative" }}>
            <Mail size={15} color={t.muted} style={{ position: "absolute", left: 12, top: 12 }} />
            <input style={{ ...inputStyle(t), paddingLeft: 34 }} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
        </Field>
        {mode !== "reset" && (
          <Field t={t} label="Password">
            <div style={{ position: "relative" }}>
              <Lock size={15} color={t.muted} style={{ position: "absolute", left: 12, top: 12 }} />
              <input type="password" style={{ ...inputStyle(t), paddingLeft: 34 }} value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" />
            </div>
          </Field>
        )}

        {msg && <div style={{ fontSize: 12, color: t.a1, marginBottom: 12 }}>{msg}</div>}

        <PrimaryButton t={t} onClick={submit} disabled={loading} style={{ marginBottom: 10 }}>
          {loading ? "Please wait…" : mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Send reset link"}
        </PrimaryButton>

        {mode !== "reset" && (
          <GhostButton t={t} onClick={google} style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.4 29.4 35.5 24 35.5c-6.9 0-12.5-5.6-12.5-12.5S17.1 10.5 24 10.5c3.2 0 6 1.2 8.2 3.1l6-6C34.6 4.1 29.6 2 24 2 11.9 2 2 11.9 2 24s9.9 22 22 22c11 0 21-8 21-22 0-1.2-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.2 0 6 1.2 8.2 3.1l6-6C34.6 4.1 29.6 2 24 2c-7.7 0-14.3 4.4-17.7 10.7z" /><path fill="#4CAF50" d="M24 46c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.5 37.1 26.9 38 24 38c-5.3 0-9.8-3.4-11.4-8.1l-6.6 5.1C9.6 41.5 16.2 46 24 46z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3 5.3-5.7 6.9l6.6 5.4C39.9 37.6 44 31.7 44 24c0-1.2-.1-2.4-.4-3.5z" /></svg>
            Continue with Google
          </GhostButton>
        )}

        <div style={{ textAlign: "center", fontSize: 12.5, color: t.muted }}>
          {mode === "login" && <>New here? <span onClick={() => { setMode("register"); setMsg(""); }} style={{ color: t.a1, cursor: "pointer" }}>Create an account</span></>}
          {mode === "register" && <>Have an account? <span onClick={() => { setMode("login"); setMsg(""); }} style={{ color: t.a1, cursor: "pointer" }}>Log in</span></>}
          {mode === "reset" && <>Remembered it? <span onClick={() => { setMode("login"); setMsg(""); }} style={{ color: t.a1, cursor: "pointer" }}>Back to login</span></>}
          {mode !== "reset" && <div style={{ marginTop: 8 }}><span onClick={() => { setMode("reset"); setMsg(""); }} style={{ color: t.muted, cursor: "pointer", textDecoration: "underline" }}>Forgot password?</span></div>}
        </div>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: t.muted, opacity: 0.85 }}>
          This website is designed by <strong style={{ color: t.a1 }}>Buraq Studios</strong> · Copyright all rights reserved
        </div>
      </div>
    </div>
  );
}
