import CloudNotifications from './CloudNotifications';
import React, { useState, useEffect } from "react";
import { User, Mail, Lock, Palette, Bell, LogOut, Check, ShieldCheck, Sun, Moon } from "lucide-react";
import { PALETTES, inputStyle } from "../theme";
import { Card, Screen, PrimaryButton, GhostButton, SectionLabel } from "./primitives";
import { requestPasswordResetOTP, verifyPasswordResetOTP, confirmPasswordReset } from "../auth";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendEmailVerification } from "firebase/auth";
import { auth } from "../firebase";
import { enableReminders, disableReminders, remindersEnabled, enableBrowserAlerts, disableBrowserAlerts, browserAlertsEnabled } from "../notifications";

export default function ProfileScreen({ t, user, theme, setTheme, scheme, setScheme, onLogout, onOpenGuide }) {
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // OTP recovery mode within profile
  const [otpMode, setOtpMode] = useState(false); // false | true
  const [otpStep, setOtpStep] = useState(1); // 1 = enter code, 2 = enter new password
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [otpNewPassword, setOtpNewPassword] = useState("");
  const [otpConfirmPassword, setOtpConfirmPassword] = useState("");

  const [reminders, setReminders] = useState(() => remindersEnabled(user.uid));
  const [browserAlerts, setBrowserAlerts] = useState(() => browserAlertsEnabled(user.uid));
  const [notice, setNotice] = useState("");
  const [notificationBusy, setNotificationBusy] = useState(false);

  useEffect(() => {
    const update = () => {
      setReminders(remindersEnabled(user.uid));
      setBrowserAlerts(browserAlertsEnabled(user.uid));
    };
    window.addEventListener('lifeos-reminders-change', update);
    return () => window.removeEventListener('lifeos-reminders-change', update);
  }, [user.uid]);

  async function reminderChange() {
    setNotificationBusy(true);
    try {
      if (reminders) await disableReminders(user);
      else await enableReminders(user);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setNotificationBusy(false);
    }
  }

  async function alertChange() {
    setNotificationBusy(true);
    try {
      if (browserAlerts) {
        disableBrowserAlerts(user.uid);
        setBrowserAlerts(false);
      } else {
        await enableBrowserAlerts(user);
        setBrowserAlerts(true);
      }
    } catch (e) {
      setNotice(e.message);
    } finally {
      setNotificationBusy(false);
    }
  }

  async function sendAccountEmail(kind) {
    setPwLoading(true);
    setPwMsg('');
    try {
      if (kind === 'verify') {
        await sendEmailVerification(auth.currentUser);
        setPwMsg('Verification email sent. Check Inbox and Spam, and use the newest link.');
      }
    } catch (e) {
      setPwMsg(e.code === 'auth/too-many-requests' ? 'Please wait a few minutes before requesting another email.' : e.message);
    } finally {
      setPwLoading(false);
    }
  }

  const handleUpdatePassword = async () => {
    setPwMsg("");
    if (!newPassword || newPassword.length < 8) {
      setPwMsg("Password must be at least 8 characters.");
      return;
    }
    if (!user || !user.email) return;

    if (!currentPassword) {
      setPwMsg("Please enter your current password, or click 'Reset with verification code' below.");
      return;
    }

    try {
      setPwLoading(true);
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setPwMsg("Password updated successfully!");
      setNewPassword("");
      setCurrentPassword("");
    } catch (e) {
      if (e.code === "auth/requires-recent-login" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setPwMsg("Incorrect current password. If forgotten, use 'Reset with verification code' below.");
      } else {
        setPwMsg(e.message || "Failed to update password.");
      }
    } finally {
      setPwLoading(false);
    }
  };

  const startOtpRecovery = async () => {
    setPwMsg("");
    setPwLoading(true);
    try {
      await requestPasswordResetOTP(user.email);
      setOtpMode(true);
      setOtpStep(1);
      setOtpCode("");
      setResetToken("");
      setOtpNewPassword("");
      setOtpConfirmPassword("");
      setPwMsg(`Verification code sent to ${user.email}. Enter the 6-digit code below.`);
    } catch (e) {
      setPwMsg(e.message || "Could not request verification code.");
    } finally {
      setPwLoading(false);
    }
  };

  const handleVerifyOtpInProfile = async () => {
    setPwMsg("");
    if (!otpCode || otpCode.trim().length !== 6) {
      setPwMsg("Enter the full 6-digit verification code.");
      return;
    }
    setPwLoading(true);
    try {
      const res = await verifyPasswordResetOTP(user.email, otpCode.trim());
      if (!res.resetToken) throw new Error("Invalid verification response.");
      setResetToken(res.resetToken);
      setOtpStep(2);
      setPwMsg("Code verified. Enter your new password below.");
    } catch (e) {
      setPwMsg(e.message || "That code is invalid or has expired.");
    } finally {
      setPwLoading(false);
    }
  };

  const handleConfirmOtpNewPassword = async () => {
    setPwMsg("");
    if (!otpNewPassword || otpNewPassword.length < 8) {
      setPwMsg("Password must be at least 8 characters.");
      return;
    }
    if (otpNewPassword !== otpConfirmPassword) {
      setPwMsg("Passwords do not match.");
      return;
    }
    setPwLoading(true);
    try {
      await confirmPasswordReset(resetToken, otpNewPassword);
      setPwMsg("Password updated successfully!");
      setOtpMode(false);
      setResetToken("");
      setOtpCode("");
      setOtpNewPassword("");
      setOtpConfirmPassword("");
    } catch (e) {
      setPwMsg(e.message || "Failed to update password. Please try again.");
    } finally {
      setPwLoading(false);
    }
  };

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const email = user?.email || "No email";

  return (
    <Screen t={t} title="Profile & Settings">
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* User Identity Card */}
        <Card t={t} style={{ padding: 22, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 58, height: 58, borderRadius: 20,
            background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: t.onAccent, fontSize: 24, fontWeight: 700
          }}>
            {displayName[0]?.toUpperCase() || <User size={28} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{displayName}</div>
            <div style={{ fontSize: 13, color: t.muted, display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <Mail size={13} /> {email}
            </div>
          </div>
          <div style={{
            padding: "4px 10px", borderRadius: 8, background: t.surface2,
            fontSize: 11, fontWeight: 600, color: t.a1, border: `1px solid ${t.line}`
          }}>
            Account Active
          </div>
        </Card>

        {/* Theme Settings */}
        <SectionLabel t={t} text="Appearance & Colors" />
        <Card t={t} style={{ padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>
            Color Palette
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
            {Object.entries(PALETTES).map(([key, p]) => {
              const isSelected = scheme === key;
              return (
                <button type="button"
                  key={key}
                  onClick={() => {
                    setScheme(key);
                    localStorage.setItem("lifeos_scheme", key);
                  }}
                  className="press card-hover"
                  style={{
                    padding: "14px 12px", borderRadius: 14,
                    background: isSelected ? t.surface2 : "transparent",
                    border: `2px solid ${isSelected ? t.a1 : t.line}`,
                    cursor: "pointer", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 8, textAlign: "center"
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 16,
                    background: p.accentColor, boxShadow: `0 4px 12px ${p.accentColor}55`,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {isSelected && <Check size={16} color="#FFFFFF" />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? t.a1 : t.text }}>
                    {p.name}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>Light / Dark Mode</div>
              <div style={{ fontSize: 11.5, color: t.muted }}>Switch between ambient dark and crisp light canvas</div>
            </div>
            <button type="button"
              onClick={() => {
                const nextMode = theme === "dark" ? "light" : "dark";
                setTheme(nextMode);
                localStorage.setItem("lifeos_theme", nextMode);
              }}
              className="press"
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                borderRadius: 12, background: t.surface2, border: `1px solid ${t.line}`,
                cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: t.text
              }}
            >
              {theme === "dark" ? <Moon size={15} color={t.a1} /> : <Sun size={15} color={t.a1} />}
              <span>{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
            </button>
          </div>
        </Card>

        {/* Security & Password */}
        <SectionLabel t={t} text="Security" />
        <Card t={t} style={{ padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>
            Change Password
          </div>

          {!otpMode ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input
                  aria-label="Current password"
                  type="password"
                  style={inputStyle(t)}
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <input
                  aria-label="New password (min 8 chars)"
                  type="password"
                  style={inputStyle(t)}
                  placeholder="New password (min 8 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              {pwMsg && (
                <div style={{ fontSize: 12, color: pwMsg.includes("success") ? t.good : t.a1, marginBottom: 10 }}>
                  {pwMsg}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <PrimaryButton t={t} onClick={handleUpdatePassword} disabled={pwLoading} style={{ width: "auto", padding: "10px 18px", fontSize: 13 }}>
                  {pwLoading ? "Updating…" : "Update Password"}
                </PrimaryButton>
                <button
                  type="button"
                  onClick={startOtpRecovery}
                  disabled={pwLoading}
                  className="link-button"
                  style={{ fontSize: 13, color: t.a1, cursor: "pointer" }}
                >
                  Forgot current password? Reset with verification code
                </button>
              </div>
            </>
          ) : (
            <div style={{ background: t.surface2, padding: 14, borderRadius: 12, border: `1px solid ${t.line}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                Password Reset via Verification Code
              </div>

              {otpStep === 1 && (
                <div>
                  <div style={{ fontSize: 12.5, color: t.muted, marginBottom: 10 }}>
                    Enter the 6-digit verification code sent to <strong style={{ color: t.text }}>{email}</strong>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <input
                      aria-label="6-digit verification code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      style={{ ...inputStyle(t), width: 140, letterSpacing: 4, fontWeight: 700, fontSize: 16 }}
                      placeholder="123456"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                    <PrimaryButton t={t} onClick={handleVerifyOtpInProfile} disabled={pwLoading || otpCode.length !== 6} style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}>
                      {pwLoading ? "Verifying…" : "Verify Code"}
                    </PrimaryButton>
                    <GhostButton t={t} onClick={() => { setOtpMode(false); setPwMsg(""); }} style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}>
                      Cancel
                    </GhostButton>
                  </div>
                </div>
              )}

              {otpStep === 2 && (
                <div>
                  <div style={{ fontSize: 12.5, color: t.muted, marginBottom: 10 }}>
                    Code verified. Enter your new password (minimum 8 characters).
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <input
                      aria-label="New password (min 8 chars)"
                      type="password"
                      style={inputStyle(t)}
                      placeholder="New password (min 8 chars)"
                      value={otpNewPassword}
                      onChange={e => setOtpNewPassword(e.target.value)}
                    />
                    <input
                      aria-label="Confirm new password"
                      type="password"
                      style={inputStyle(t)}
                      placeholder="Confirm new password"
                      value={otpConfirmPassword}
                      onChange={e => setOtpConfirmPassword(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <PrimaryButton t={t} onClick={handleConfirmOtpNewPassword} disabled={pwLoading} style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}>
                      {pwLoading ? "Updating…" : "Save New Password"}
                    </PrimaryButton>
                    <GhostButton t={t} onClick={() => { setOtpMode(false); setPwMsg(""); }} style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}>
                      Cancel
                    </GhostButton>
                  </div>
                </div>
              )}

              {pwMsg && (
                <div style={{ fontSize: 12, color: pwMsg.includes("success") ? t.good : t.a1, marginTop: 10 }}>
                  {pwMsg}
                </div>
              )}
            </div>
          )}
        </Card>

        <SectionLabel t={t} text="Email & Reminders" />
        <Card t={t} style={{ padding: 18, display: 'grid', gap: 14 }}>
          {!user.emailVerified && (
            <GhostButton t={t} disabled={pwLoading} onClick={() => sendAccountEmail('verify')}>
              Send email verification
            </GhostButton>
          )}
          <label><input type="checkbox" checked={reminders} disabled={notificationBusy} onChange={reminderChange} /> Timetable reminders while Life OS is open</label>
          <label><input type="checkbox" checked={browserAlerts} disabled={notificationBusy} onChange={alertChange} /> Show browser notifications for due reminders</label>
          {notice && <p role="status">{notice}</p>}
          <p style={{ fontSize: 13, color: t.muted }}>The two controls above work while a Life OS tab is open. Use the background delivery controls below for email and closed-tab push.</p>
          <CloudNotifications t={t} user={user} />
        </Card>

        {/* Help & Guide */}
        <SectionLabel t={t} text="Help & Resources" />
        <Card t={t} style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>Life OS User Guide</div>
              <div style={{ fontSize: 11.5, color: t.muted }}>Interactive tour of features, timetable planning, and wealth tools</div>
            </div>
            {onOpenGuide && (
              <button
                onClick={onOpenGuide}
                className="press"
                style={{
                  padding: "7px 14px", borderRadius: 10, background: t.surface2,
                  border: `1px solid ${t.a1}`, color: t.a1, fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}
              >
                View Guide
              </button>
            )}
          </div>
        </Card>

        {/* Logout Card */}
        <div style={{ marginTop: 24, marginBottom: 20 }}>
          <GhostButton
            t={t}
            onClick={onLogout}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, borderColor: `${t.a1}55`, color: t.a1, fontWeight: 600
            }}
          >
            <LogOut size={16} /> Sign out of Life OS
          </GhostButton>
        </div>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11.5, color: t.muted, opacity: 0.85, paddingBottom: 24 }}>
          This website is designed by <strong style={{ color: t.a1, fontWeight: 700 }}>Buraq Studios</strong> · Copyright all rights reserved.
        </div>
      </div>
    </Screen>
  );
}
