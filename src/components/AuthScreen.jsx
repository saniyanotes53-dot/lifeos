import React, { useState, useEffect, useRef } from "react";
import { Mail, Lock, User as UserIcon, Sparkles, Eye, EyeOff, CheckCircle2, ArrowLeft } from "lucide-react";
import { inputStyle } from "../theme";
import { Field, PrimaryButton, GhostButton, Hero } from "./primitives";
import {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  requestPasswordResetOTP,
  verifyPasswordResetOTP,
  confirmPasswordReset
} from "../auth";

function maskEmail(email) {
  if (!email || !email.includes("@")) return email || "";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export default function AuthScreen({ t, onLogin }) {
  const [mode, setMode] = useState(window.location.pathname === "/reset" ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("error"); // "error" | "info" | "success"
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP Reset Flow states: 1 (email) -> 2 (otp) -> 3 (new password) -> 4 (success)
  const [resetStep, setResetStep] = useState(1);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const otpInputsRef = useRef([]);

  // Auto countdown effect for resend cooldown
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Focus first OTP box when entering step 2
  useEffect(() => {
    if (mode === "reset" && resetStep === 2 && otpInputsRef.current[0]) {
      setTimeout(() => otpInputsRef.current[0]?.focus(), 80);
    }
  }, [mode, resetStep]);

  const clearResetState = () => {
    setResetStep(1);
    setOtp(["", "", "", "", "", ""]);
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setCountdown(0);
    setMsg("");
  };

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
        return "Password must be at least 8 characters long.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/popup-closed-by-user":
        return "Google sign-in popup was closed before completion.";
      case "auth/unauthorized-domain": {
        const hostname = typeof window !== "undefined" ? window.location.hostname : "this website";
        return `Firebase is blocking sign-in from ${hostname}. Add this domain in Firebase Console → Authentication → Settings → Authorized domains, then reload the website.`;
      }
      case "auth/too-many-requests":
        return "Too many attempts. Wait a few minutes before trying again.";
      case "auth/network-request-failed":
        return "Could not reach the server. Check your connection and try again.";
      default:
        return e.message || "Sign-in could not be completed. Please try again.";
    }
  };

  // Step 1: Send OTP to email
  const handleRequestOTP = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;
    setMsg("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMsgType("error");
      setMsg("Enter your email address.");
      return;
    }
    try {
      setLoading(true);
      await requestPasswordResetOTP(trimmedEmail);
      setResetStep(2);
      setCountdown(60);
      setMsgType("info");
      setMsg(`We sent a 6-digit verification code to ${maskEmail(trimmedEmail)}`);
    } catch (err) {
      setMsgType("error");
      setMsg(err.message || "Could not send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle OTP input changes
  const handleOtpChange = (index, val) => {
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      const next = [...otp];
      next[index] = "";
      setOtp(next);
      return;
    }
    // If pasted full code or multiple characters
    if (clean.length > 1) {
      handleOtpPaste(clean);
      return;
    }
    const next = [...otp];
    next[index] = clean[0];
    setOtp(next);
    if (index < 5 && clean[0]) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (pastedText) => {
    const digits = pastedText.replace(/\D/g, "").slice(0, 6).split("");
    if (!digits.length) return;
    const next = ["", "", "", "", "", ""];
    digits.forEach((d, i) => {
      if (i < 6) next[i] = d;
    });
    setOtp(next);
    const focusIdx = Math.min(digits.length, 5);
    otpInputsRef.current[focusIdx]?.focus();
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;
    const code = otp.join("");
    if (code.length !== 6) {
      setMsgType("error");
      setMsg("Enter the full 6-digit verification code.");
      return;
    }
    setMsg("");
    try {
      setLoading(true);
      const res = await verifyPasswordResetOTP(email.trim(), code);
      if (!res.resetToken) throw new Error("Invalid verification response.");
      setResetToken(res.resetToken);
      setResetStep(3);
      setMsg("");
    } catch (err) {
      setMsgType("error");
      setMsg(err.message || "That code is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Confirm new password
  const handleConfirmPassword = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;
    setMsg("");
    if (!newPassword || newPassword.length < 8) {
      setMsgType("error");
      setMsg("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsgType("error");
      setMsg("Passwords do not match.");
      return;
    }
    try {
      setLoading(true);
      await confirmPasswordReset(resetToken, newPassword);
      setResetStep(4);
      setMsg("");
      // Clear sensitive values immediately
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setOtp(["", "", "", "", "", ""]);
      // Auto-return to login after delay
      setTimeout(() => {
        setMode("login");
        clearResetState();
        if (window.location.pathname === "/reset") {
          window.history.replaceState({}, "", "/");
        }
      }, 3500);
    } catch (err) {
      setMsgType("error");
      setMsg(err.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Login / Register submit
  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setMsg("");
    setMsgType("error");

    if (!email || !pw) {
      setMsg("Enter an email and password to continue.");
      return;
    }
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
    setMsgType("error");
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
    <div className="auth-form-shell">
      <div className="auth-form-content">
        <div className="auth-form-heading">
          <span className="cinema-kicker">{mode === 'register' ? 'A FRESH START' : mode === 'reset' ? 'LET’S GET YOU BACK' : 'YOUR SPACE AWAITS'}</span>
          <h2>{mode === 'register' ? 'Begin your next chapter.' : mode === 'reset' ? 'Find your way back.' : 'Welcome back.'}</h2>
          <p>{mode === 'register' ? 'Create your account. Make room for what matters.' : mode === 'reset' ? 'A few simple steps to recover your account.' : 'Step into a calmer, more intentional day.'}</p>
        </div>

        {/* ----------------- RESET PASSWORD FLOW ----------------- */}
        {mode === "reset" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Step 1: Request OTP */}
            {resetStep === 1 && (
              <form onSubmit={handleRequestOTP} aria-label="Reset password">
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6 }}>Reset password</div>
                <div style={{ fontSize: 13, color: t.muted, marginBottom: 16 }}>
                  Enter your email address to receive a 6-digit verification code.
                </div>
                <Field t={t} label="Email">
                  <div style={{ position: "relative" }}>
                    <Mail size={15} color={t.muted} style={{ position: "absolute", left: 12, top: 12 }} />
                    <input
                      aria-label="you@example.com"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      style={{ ...inputStyle(t), paddingLeft: 34 }}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                </Field>

                {msg && (
                  <div role="status" aria-live="polite" style={{ fontSize: 13, color: msgType === "error" ? (t.bad || t.a1) : t.good, marginBottom: 12 }}>
                    {msg}
                  </div>
                )}

                <PrimaryButton t={t} type="submit" disabled={loading} style={{ marginBottom: 10 }}>
                  {loading ? "Sending code…" : "Send verification code"}
                </PrimaryButton>
              </form>
            )}

            {/* Step 2: Enter & Verify 6-digit OTP */}
            {resetStep === 2 && (
              <form onSubmit={handleVerifyOTP} aria-label="Enter verification code">
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>Enter verification code</div>
                <div style={{ fontSize: 13, color: t.muted, marginBottom: 18 }}>
                  We sent a 6-digit verification code to <strong style={{ color: t.text }}>{maskEmail(email.trim())}</strong>
                </div>

                <div
                  style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 16 }}
                  onPaste={e => {
                    e.preventDefault();
                    handleOtpPaste(e.clipboardData.getData("text"));
                  }}
                >
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => (otpInputsRef.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      autoFocus={i === 0}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      aria-label={`Digit ${i + 1} of 6`}
                      style={{
                        ...inputStyle(t),
                        height: 52,
                        textAlign: "center",
                        fontSize: 22,
                        fontWeight: 700,
                        padding: 0,
                        borderRadius: 10,
                        border: `1.5px solid ${digit ? t.a1 : t.line}`
                      }}
                    />
                  ))}
                </div>

                {msg && (
                  <div role="status" aria-live="polite" style={{ fontSize: 13, color: msgType === "error" ? (t.bad || t.a1) : t.good, marginBottom: 12 }}>
                    {msg}
                  </div>
                )}

                <PrimaryButton t={t} type="submit" disabled={loading || otp.join("").length !== 6} style={{ marginBottom: 12 }}>
                  {loading ? "Verifying…" : "Verify code"}
                </PrimaryButton>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  {countdown > 0 ? (
                    <span style={{ color: t.muted }}>Resend code in {countdown}s</span>
                  ) : (
                    <button
                      type="button"
                      className="link-button"
                      disabled={loading}
                      onClick={handleRequestOTP}
                      style={{ color: t.a1, fontWeight: 600, cursor: "pointer" }}
                    >
                      Resend code
                    </button>
                  )}
                  <button
                    type="button"
                    className="link-button"
                    disabled={loading}
                    onClick={() => {
                      setResetStep(1);
                      setOtp(["", "", "", "", "", ""]);
                      setMsg("");
                    }}
                    style={{ color: t.muted, cursor: "pointer" }}
                  >
                    Change email
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Set New Password */}
            {resetStep === 3 && (
              <form onSubmit={handleConfirmPassword} aria-label="Create new password">
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>Create new password</div>
                <div style={{ fontSize: 13, color: t.muted, marginBottom: 16 }}>
                  Choose a new password with at least 8 characters.
                </div>

                <Field t={t} label="New password">
                  <div style={{ position: "relative" }}>
                    <Lock size={15} color={t.muted} style={{ position: "absolute", left: 12, top: 12 }} />
                    <input
                      aria-label="New password"
                      name="new-password"
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      style={{ ...inputStyle(t), paddingLeft: 34, paddingRight: 48 }}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                      aria-pressed={showNewPassword}
                      onClick={() => setShowNewPassword(v => !v)}
                      className="action-reset"
                      style={{ position: "absolute", right: 0, top: 0, width: 44, height: 44, color: t.muted, cursor: "pointer" }}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </Field>

                <Field t={t} label="Confirm password">
                  <div style={{ position: "relative" }}>
                    <Lock size={15} color={t.muted} style={{ position: "absolute", left: 12, top: 12 }} />
                    <input
                      aria-label="Confirm password"
                      name="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      style={{ ...inputStyle(t), paddingLeft: 34, paddingRight: 48 }}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      aria-pressed={showConfirmPassword}
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="action-reset"
                      style={{ position: "absolute", right: 0, top: 0, width: 44, height: 44, color: t.muted, cursor: "pointer" }}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </Field>

                {msg && (
                  <div role="status" aria-live="polite" style={{ fontSize: 13, color: msgType === "error" ? (t.bad || t.a1) : t.good, marginBottom: 12 }}>
                    {msg}
                  </div>
                )}

                <PrimaryButton t={t} type="submit" disabled={loading} style={{ marginBottom: 10 }}>
                  {loading ? "Updating password…" : "Reset password"}
                </PrimaryButton>
              </form>
            )}

            {/* Step 4: Success */}
            {resetStep === 4 && (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ width: 52, height: 52, borderRadius: 26, background: `${t.good}22`, color: t.good, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <CheckCircle2 size={30} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 8 }}>
                  Password changed successfully.
                </div>
                <div style={{ fontSize: 13.5, color: t.muted, marginBottom: 20 }}>
                  You can now log in to Life OS with your new password. Returning to login shortly…
                </div>
                <PrimaryButton
                  t={t}
                  type="button"
                  onClick={() => {
                    setMode("login");
                    clearResetState();
                    if (window.location.pathname === "/reset") window.history.replaceState({}, "", "/");
                  }}
                >
                  Back to login
                </PrimaryButton>
              </div>
            )}

            {/* Back to login link if not on step 4 */}
            {resetStep !== 4 && (
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <button
                  type="button"
                  className="link-button"
                  disabled={loading}
                  onClick={() => {
                    setMode("login");
                    clearResetState();
                    if (window.location.pathname === "/reset") window.history.replaceState({}, "", "/");
                  }}
                  style={{ color: t.a1, cursor: "pointer", fontSize: 14 }}
                >
                  Remembered it? Back to login
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ----------------- LOGIN / REGISTER FLOW ----------------- */
          <form onSubmit={submit} aria-label={mode === "register" ? "Create account" : "Log in"}>
            {mode === "register" && (
              <Field t={t} label="Name">
                <div style={{ position: "relative" }}>
                  <UserIcon size={15} color={t.muted} style={{ position: "absolute", left: 12, top: 12 }} />
                  <input
                    aria-label="Your name"
                    name="name"
                    autoComplete="name"
                    required
                    style={{ ...inputStyle(t), paddingLeft: 34 }}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
              </Field>
            )}
            <Field t={t} label="Email">
              <div style={{ position: "relative" }}>
                <Mail size={15} color={t.muted} style={{ position: "absolute", left: 12, top: 12 }} />
                <input
                  aria-label="you@example.com"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  style={{ ...inputStyle(t), paddingLeft: 34 }}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </Field>

            <Field t={t} label="Password">
              <div style={{ position: "relative" }}>
                <Lock size={15} color={t.muted} style={{ position: "absolute", left: 12, top: 12 }} />
                <input
                  aria-label="Enter your password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "register" ? 8 : undefined}
                  aria-describedby={mode === "register" ? "password-help" : undefined}
                  style={{ ...inputStyle(t), paddingLeft: 34, paddingRight: 48 }}
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(v => !v)}
                  className="action-reset"
                  style={{ position: "absolute", right: 0, top: 0, width: 44, height: 44, color: t.muted, cursor: "pointer" }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            {mode === "register" && <p id="password-help" style={{ fontSize: 13, color: t.muted }}>Use at least 8 characters.</p>}
            {msg && <div role="status" aria-live="polite" style={{ fontSize: 14, color: t.a1, marginBottom: 12 }}>{msg}</div>}

            <PrimaryButton t={t} type="submit" disabled={loading} style={{ marginBottom: 10 }}>
              {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </PrimaryButton>

            <GhostButton t={t} disabled={loading} onClick={google} style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.4 29.4 35.5 24 35.5c-6.9 0-12.5-5.6-12.5-12.5S17.1 10.5 24 10.5c3.2 0 6 1.2 8.2 3.1l6-6C34.6 4.1 29.6 2 24 2 11.9 2 2 11.9 2 24s9.9 22 22 22c11 0 21-8 21-22 0-1.2-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.2 0 6 1.2 8.2 3.1l6-6C34.6 4.1 29.6 2 24 2c-7.7 0-14.3 4.4-17.7 10.7z" /><path fill="#4CAF50" d="M24 46c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.5 37.1 26.9 38 24 38c-5.3 0-9.8-3.4-11.4-8.1l-6.6 5.1C9.6 41.5 16.2 46 24 46z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3 5.3-5.7 6.9l6.6 5.4C39.9 37.6 44 31.7 44 24c0-1.2-.1-2.4-.4-3.5z" /></svg>
              Continue with Google
            </GhostButton>

            <div style={{ textAlign: "center", fontSize: 14, color: t.muted }}>
              {mode === "login" && (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    className="link-button"
                    disabled={loading}
                    onClick={() => {
                      setShowPassword(false);
                      setMode("register");
                      setMsg("");
                    }}
                    style={{ color: t.a1, cursor: "pointer" }}
                  >
                    Create an account
                  </button>
                </>
              )}
              {mode === "register" && (
                <>
                  Have an account?{" "}
                  <button
                    type="button"
                    className="link-button"
                    disabled={loading}
                    onClick={() => {
                      setShowPassword(false);
                      setMode("login");
                      setMsg("");
                    }}
                    style={{ color: t.a1, cursor: "pointer" }}
                  >
                    Log in
                  </button>
                </>
              )}
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="link-button"
                  disabled={loading}
                  onClick={() => {
                    setShowPassword(false);
                    clearResetState();
                    setMode("reset");
                  }}
                  style={{ color: t.muted, cursor: "pointer", textDecoration: "underline" }}
                >
                  Forgot password?
                </button>
              </div>
            </div>
          </form>
        )}

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: t.muted, opacity: 0.85 }}>
          This website is designed by <strong style={{ color: t.a1 }}>Buraq Studios</strong> · Copyright all rights reserved
        </div>
      </div>
    </div>
  );
}
