import React from "react";
import {
  ChevronLeft, Moon, Sun, Check
} from "lucide-react";

export function IconBtn({ children, onClick, t, style }) {
  return (
    <button onClick={onClick} className="press" style={{
      width: 36, height: 36, borderRadius: 12, border: `1px solid ${t.line}`,
      background: t.surface, display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", transition: "transform .12s ease, background .2s ease", ...style
    }}>{children}</button>
  );
}

export function Screen({ title, t, onBack, right, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onBack && <IconBtn t={t} onClick={onBack}><ChevronLeft size={18} color={t.text} /></IconBtn>}
          <h1 style={{ fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 21, fontWeight: 600, color: t.text, margin: 0 }}>{title}</h1>
        </div>
        {right}
      </div>
      <div className="fade-in" style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>{children}</div>
    </div>
  );
}

export function Card({ t, children, style, onClick }) {
  return (
    <div onClick={onClick} className={onClick ? "press card-hover" : "card-hover"} style={{
      background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16,
      padding: 16, marginBottom: 10, cursor: onClick ? "pointer" : "default",
      transition: "transform .15s ease, border-color .2s ease", ...style
    }}>{children}</div>
  );
}

export function Field({ label, t, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, color: t.muted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

export function PrimaryButton({ t, children, onClick, style, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="press" style={{
      width: "100%", background: disabled ? t.surface2 : `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
      color: disabled ? t.muted : t.onAccent, border: "none", borderRadius: 12, padding: "12px 16px",
      fontSize: 14, fontWeight: 600, cursor: disabled ? "default" : "pointer",
      boxShadow: disabled ? "none" : `0 6px 16px -6px ${t.a1}88`, transition: "transform .12s ease", ...style
    }}>{children}</button>
  );
}

export function GhostButton({ t, children, onClick, style }) {
  return (
    <button onClick={onClick} className="press" style={{
      width: "100%", background: "transparent", color: t.text, border: `1px solid ${t.line}`,
      borderRadius: 12, padding: "12px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer", ...style
    }}>{children}</button>
  );
}

export function SectionLabel({ t, text, action, onAction }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 2px 8px" }}>
      <div style={{ fontSize: 13, color: t.text, fontWeight: 700 }}>{text}</div>
      {action && <div onClick={onAction} style={{ fontSize: 12, color: t.a1, cursor: "pointer" }}>{action}</div>}
    </div>
  );
}

export function Empty({ t, text }) {
  return <div style={{ fontSize: 12.5, color: t.muted, textAlign: "center", padding: "16px 0" }}>{text}</div>;
}

export function ThemeToggle({ theme, setTheme, t }) {
  const dark = theme === "dark";
  return (
    <div onClick={() => setTheme(dark ? "light" : "dark")} className="press" style={{
      width: 52, height: 30, borderRadius: 15, background: t.surface2, border: `1px solid ${t.line}`,
      position: "relative", cursor: "pointer", flexShrink: 0
    }}>
      <div style={{
        position: "absolute", top: 2, left: dark ? 24 : 2, width: 24, height: 24, borderRadius: 12,
        background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`, display: "flex", alignItems: "center",
        justifyContent: "center", transition: "left .25s cubic-bezier(.4,0,.2,1)"
      }}>
        {dark ? <Moon size={13} color={t.onAccent} /> : <Sun size={13} color={t.onAccent} />}
      </div>
    </div>
  );
}

export function Hero({ t, height = 130 }) {
  return (
    <svg width="100%" height={height} viewBox="0 0 400 160" style={{ position: "absolute", top: 0, left: 0, borderRadius: "28px 28px 0 0" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={t.heroFrom} />
          <stop offset="100%" stopColor={t.heroTo} />
        </linearGradient>
        <radialGradient id="glow1" cx="80%" cy="10%" r="60%">
          <stop offset="0%" stopColor={t.a1} stopOpacity="0.35" />
          <stop offset="100%" stopColor={t.a1} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow2" cx="10%" cy="90%" r="50%">
          <stop offset="0%" stopColor={t.a5} stopOpacity="0.28" />
          <stop offset="100%" stopColor={t.a5} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="160" fill="url(#heroGrad)" />
      <rect width="400" height="160" fill="url(#glow1)" />
      <rect width="400" height="160" fill="url(#glow2)" />
      <path d="M0,120 C100,90 300,150 400,110 L400,160 L0,160 Z" fill={t.a1} opacity="0.08" />
      <path d="M0,140 C120,120 280,160 400,130 L400,160 L0,160 Z" fill={t.a3} opacity="0.14" />
    </svg>
  );
}

export function ProgressRing({ t, pct, size = 64, stroke = 7, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={t.surface2} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={t.a1} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

export function Segmented({ t, options, value, onChange }) {
  const idx = options.findIndex(o => o[0] === value);
  return (
    <div style={{ position: "relative", display: "flex", background: t.surface2, borderRadius: 12, padding: 4, marginBottom: 14, border: `1px solid ${t.line}` }}>
      <div style={{
        position: "absolute", top: 4, bottom: 4, left: `calc(${idx} * (100% / ${options.length}) + 4px)`,
        width: `calc(100% / ${options.length} - 8px)`, background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
        borderRadius: 9, transition: "left .25s cubic-bezier(.4,0,.2,1)"
      }} />
      {options.map(([k, l, Icon]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          flex: 1, position: "relative", zIndex: 1, padding: "8px 0", border: "none", background: "transparent",
          color: value === k ? t.onAccent : t.muted, fontSize: 12, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 5, cursor: "pointer", transition: "color .2s ease"
        }}><Icon size={13} />{l}</button>
      ))}
    </div>
  );
}

export function StatChip({ t, icon, label, value, onClick }) {
  return (
    <div onClick={onClick} className="press card-hover" style={{
      background: t.surface, border: `1px solid ${t.line}`, borderRadius: 14, padding: "12px 12px",
      cursor: onClick ? "pointer" : "default", transition: "transform .15s ease"
    }}>
      {icon}
      <div style={{ fontSize: 16, color: t.text, fontWeight: 700, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: t.muted, marginTop: 1 }}>{label}</div>
    </div>
  );
}
