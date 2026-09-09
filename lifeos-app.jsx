import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Home, ListChecks, Moon, Wallet, BarChart3, Plus, Check, X,
  Sun, Dumbbell, Utensils, Bell, Upload, Download, ChevronLeft,
  Clock, Flame, TrendingUp, LogOut, Mail, Lock, User as UserIcon, Sparkles
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import Papa from "papaparse";

/* ============================================================
   LIFE OS — personal day / health / budget manager
   All-blue palette · dark & light · animated, minimal UI
============================================================ */

const THEME = {
  dark: {
    bg: "#0A0F1E", surface: "#121A2E", surface2: "#1B2740", line: "#233355",
    text: "#EAF2FF", muted: "#7E90B8", onAccent: "#04102A",
    a1: "#4C8DFF", a2: "#7FB2FF", a3: "#2451A6", a4: "#1B3B78", a5: "#9FC6FF",
    good: "#6FE3C6", warm: "#5B6B8C",
    heroFrom: "#13224A", heroTo: "#0A0F1E",
  },
  light: {
    bg: "#EEF3FC", surface: "#FFFFFF", surface2: "#F4F8FE", line: "#DDE7F8",
    text: "#0E1B33", muted: "#5C6E92", onAccent: "#FFFFFF",
    a1: "#2F6FED", a2: "#5B93F5", a3: "#163172", a4: "#B9D2FA", a5: "#0E3FA6",
    good: "#0E9C7F", warm: "#7C8DB0",
    heroFrom: "#DCE8FF", heroTo: "#EEF3FC",
  }
};
const CAT_PALETTE = ["a1", "a2", "a5", "a3", "a4", "warm"];

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);
const dayName = (d) => new Date(d).toLocaleDateString(undefined, { weekday: "short" });

function seedTasks() {
  return [
    { id: uid(), title: "Edit client reel — final cut", priority: "High", done: false, date: todayStr() },
    { id: uid(), title: "Buraq Studios — send quote", priority: "Med", done: false, date: todayStr() },
    { id: uid(), title: "Seminary reading, Tazrut chapter", priority: "Med", done: false, date: todayStr() },
    { id: uid(), title: "Reply to vendor emails", priority: "Low", done: true, date: todayStr() },
  ];
}
function seedSleep() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    out.push({ id: uid(), date: d, bed: "00:30", wake: "07:00", hours: +(6.5 + Math.random()).toFixed(1) });
  }
  return out;
}
function seedTx() {
  return [
    { id: uid(), date: todayStr(), amount: 450, category: "Food", note: "Lunch", type: "expense" },
    { id: uid(), date: todayStr(), amount: 1200, category: "Transport", note: "Cab", type: "expense" },
    { id: uid(), date: todayStr(), amount: 15000, category: "Income", note: "Client payment", type: "income" },
    { id: uid(), date: todayStr(), amount: 800, category: "Shopping", note: "Supplies", type: "expense" },
  ];
}

const PRI_KEY = { High: "a1", Med: "a2", Low: "muted" };

/* ---------- primitives ---------- */
function useT(theme) { return THEME[theme]; }

function IconBtn({ children, onClick, t, style }) {
  return (
    <button onClick={onClick} className="press" style={{
      width: 36, height: 36, borderRadius: 12, border: `1px solid ${t.line}`,
      background: t.surface, display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", transition: "transform .12s ease, background .2s ease", ...style
    }}>{children}</button>
  );
}
function Screen({ title, t, onBack, right, children }) {
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
function Card({ t, children, style, onClick }) {
  return (
    <div onClick={onClick} className={onClick ? "press card-hover" : "card-hover"} style={{
      background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16,
      padding: 16, marginBottom: 10, cursor: onClick ? "pointer" : "default",
      transition: "transform .15s ease, border-color .2s ease", ...style
    }}>{children}</div>
  );
}
function Field({ label, t, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, color: t.muted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
function inputStyle(t) {
  return {
    width: "100%", background: t.surface2, border: `1px solid ${t.line}`, borderRadius: 10,
    padding: "10px 12px", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box",
    transition: "border-color .15s ease"
  };
}
function PrimaryButton({ t, children, onClick, style, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="press" style={{
      width: "100%", background: disabled ? t.surface2 : `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
      color: disabled ? t.muted : t.onAccent, border: "none", borderRadius: 12, padding: "12px 16px",
      fontSize: 14, fontWeight: 600, cursor: disabled ? "default" : "pointer",
      boxShadow: disabled ? "none" : `0 6px 16px -6px ${t.a1}88`, transition: "transform .12s ease", ...style
    }}>{children}</button>
  );
}
function GhostButton({ t, children, onClick, style }) {
  return (
    <button onClick={onClick} className="press" style={{
      width: "100%", background: "transparent", color: t.text, border: `1px solid ${t.line}`,
      borderRadius: 12, padding: "12px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer", ...style
    }}>{children}</button>
  );
}
function SectionLabel({ t, text, action, onAction }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 2px 8px" }}>
      <div style={{ fontSize: 13, color: t.text, fontWeight: 700 }}>{text}</div>
      {action && <div onClick={onAction} style={{ fontSize: 12, color: t.a1, cursor: "pointer" }}>{action}</div>}
    </div>
  );
}
function Empty({ t, text }) { return <div style={{ fontSize: 12.5, color: t.muted, textAlign: "center", padding: "16px 0" }}>{text}</div>; }

function ThemeToggle({ theme, setTheme, t }) {
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

/* decorative hero blob */
function Hero({ t, height = 130 }) {
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

/* animated ring */
function ProgressRing({ t, pct, size = 64, stroke = 7, children }) {
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

/* ---------- Auth ---------- */
function AuthScreen({ t, onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  const submit = () => {
    if (mode === "reset") { setMsg("If this were live, a reset link would be emailed to " + (email || "your address") + "."); return; }
    if (!email || !pw) { setMsg("Enter an email and password to continue."); return; }
    onLogin(name || email.split("@")[0]);
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

        <PrimaryButton t={t} onClick={submit} style={{ marginBottom: 10 }}>
          {mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Send reset link"}
        </PrimaryButton>

        {mode !== "reset" && (
          <GhostButton t={t} onClick={() => onLogin(name || "Murtaza")} style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
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
        <div style={{ marginTop: 20, fontSize: 10.5, color: t.muted, textAlign: "center", lineHeight: 1.5 }}>
          Demo sign-in for now — connect Firebase Auth to make accounts real.
        </div>
      </div>
    </div>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ t, tasks, sleep, tx, name, setTab, theme, setTheme }) {
  const openTasks = tasks.filter(x => !x.done);
  const pct = tasks.length ? Math.round((tasks.filter(x => x.done).length / tasks.length) * 100) : 0;
  const top = [...openTasks].sort((a, b) => ({ High: 0, Med: 1, Low: 2 }[a.priority] - { High: 0, Med: 1, Low: 2 }[b.priority])).slice(0, 3);
  const lastSleep = sleep[sleep.length - 1];
  const spentToday = tx.filter(x => x.date === todayStr() && x.type === "expense").reduce((s, x) => s + x.amount, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ position: "relative" }}>
      <Hero t={t} height={190} />
      <div style={{ position: "relative", padding: "18px 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12.5, color: t.muted }}>{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</div>
            <h1 style={{ fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 23, color: t.text, margin: "2px 0 0" }}>{greeting}, {name}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ThemeToggle theme={theme} setTheme={setTheme} t={t} />
          </div>
        </div>

        <Card t={t} style={{ display: "flex", alignItems: "center", gap: 14 }} onClick={() => setTab("tasks")}>
          <ProgressRing t={t} pct={pct} size={58}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{pct}%</div>
          </ProgressRing>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, color: t.text, fontWeight: 600 }}>{openTasks.length} tasks open today</div>
            <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>Tap to prioritise your list</div>
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
          <StatChip t={t} icon={<Moon size={15} color={t.a2} />} label="Last sleep" value={lastSleep ? lastSleep.hours + "h" : "—"} onClick={() => setTab("health")} />
          <StatChip t={t} icon={<Wallet size={15} color={t.a5} />} label="Spent today" value={"₹" + spentToday} onClick={() => setTab("budget")} />
        </div>

        <SectionLabel t={t} text="Today's priorities" action="See all" onAction={() => setTab("tasks")} />
        <Card t={t}>
          {top.length === 0 && <Empty t={t} text="Nothing pending — add a task to plan your day." />}
          {top.map((x, i) => (
            <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < top.length - 1 ? `1px solid ${t.line}` : "none" }}>
              <div style={{ width: 7, height: 7, borderRadius: 4, background: t[PRI_KEY[x.priority]] }} />
              <div style={{ fontSize: 13.5, color: t.text, flex: 1 }}>{x.title}</div>
              <div style={{ fontSize: 10.5, color: t.muted }}>{x.priority}</div>
            </div>
          ))}
        </Card>

        <SectionLabel t={t} text="Sleep this week" action="Log" onAction={() => setTab("health")} />
        <Card t={t}>
          <div style={{ height: 100 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sleep}>
                <XAxis dataKey="date" tickFormatter={dayName} tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Bar dataKey="hours" radius={[5, 5, 0, 0]} fill={t.a1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <SectionLabel t={t} text="Plan your day" />
        <Card t={t} onClick={() => setTab("timetable")} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: t.surface2, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={18} color={t.a1} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, color: t.text, fontWeight: 600 }}>Timetable & reminders</div>
            <div style={{ fontSize: 11.5, color: t.muted }}>Schedule blocks, get notified</div>
          </div>
          <ChevronLeft size={16} color={t.muted} style={{ transform: "rotate(180deg)" }} />
        </Card>
      </div>
    </div>
  );
}
function StatChip({ t, icon, label, value, onClick }) {
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

/* ---------- Tasks ---------- */
function TasksScreen({ t, tasks, setTasks }) {
  const [title, setTitle] = useState("");
  const [pri, setPri] = useState("Med");
  const order = { High: 0, Med: 1, Low: 2 };
  const sorted = [...tasks].sort((a, b) => (a.done - b.done) || (order[a.priority] - order[b.priority]));

  const add = () => { if (!title.trim()) return; setTasks([...tasks, { id: uid(), title: title.trim(), priority: pri, done: false, date: todayStr() }]); setTitle(""); };
  const toggle = (id) => setTasks(tasks.map(x => x.id === id ? { ...x, done: !x.done } : x));
  const remove = (id) => setTasks(tasks.filter(x => x.id !== id));

  return (
    <Screen t={t} title="Tasks">
      <Card t={t}>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inputStyle(t), flex: 1 }} placeholder="Add a task…" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
          <select style={{ ...inputStyle(t), width: 84 }} value={pri} onChange={e => setPri(e.target.value)}>
            <option>High</option><option>Med</option><option>Low</option>
          </select>
          <button onClick={add} className="press" style={{ width: 40, borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Plus size={18} color={t.onAccent} />
          </button>
        </div>
      </Card>

      {sorted.length === 0 && <Empty t={t} text="No tasks yet. Add your first one above." />}
      {sorted.map(x => (
        <Card t={t} key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, opacity: x.done ? 0.5 : 1 }}>
          <div onClick={() => toggle(x.id)} className="press" style={{
            width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${t[PRI_KEY[x.priority]]}`,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
            background: x.done ? t[PRI_KEY[x.priority]] : "transparent", transition: "background .15s ease"
          }}>{x.done && <Check size={14} color={t.bg} />}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: t.text, textDecoration: x.done ? "line-through" : "none" }}>{x.title}</div>
            <div style={{ fontSize: 10.5, color: t[PRI_KEY[x.priority]], marginTop: 2 }}>{x.priority} priority</div>
          </div>
          <X size={16} color={t.muted} style={{ cursor: "pointer" }} onClick={() => remove(x.id)} />
        </Card>
      ))}
    </Screen>
  );
}

/* ---------- Health ---------- */
function Segmented({ t, options, value, onChange }) {
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
function HealthScreen({ t, sleep, setSleep, workouts, setWorkouts, meals, setMeals }) {
  const [sub, setSub] = useState("sleep");
  const [bed, setBed] = useState("23:30");
  const [wake, setWake] = useState("07:00");
  const [exName, setExName] = useState("");
  const [exMin, setExMin] = useState("");
  const [mealName, setMealName] = useState("");
  const [mealCal, setMealCal] = useState("");

  const logSleep = () => {
    const [bh, bm] = bed.split(":").map(Number);
    const [wh, wm] = wake.split(":").map(Number);
    let mins = (wh * 60 + wm) - (bh * 60 + bm);
    if (mins < 0) mins += 24 * 60;
    setSleep([...sleep, { id: uid(), date: todayStr(), bed, wake, hours: +(mins / 60).toFixed(1) }]);
  };
  const avgSleep = sleep.length ? (sleep.reduce((s, x) => s + x.hours, 0) / sleep.length).toFixed(1) : 0;

  return (
    <Screen t={t} title="Health">
      <Segmented t={t} value={sub} onChange={setSub} options={[["sleep", "Sleep", Moon], ["workout", "Workout", Dumbbell], ["diet", "Diet", Utensils]]} />

      {sub === "sleep" && (
        <>
          <Card t={t}>
            <div style={{ fontSize: 12, color: t.muted, marginBottom: 8 }}>Average logged: <b style={{ color: t.a2 }}>{avgSleep}h</b> · aim for 7–8h for a steady cycle</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Field t={t} label="Bed time"><input type="time" style={inputStyle(t)} value={bed} onChange={e => setBed(e.target.value)} /></Field>
              <Field t={t} label="Wake time"><input type="time" style={inputStyle(t)} value={wake} onChange={e => setWake(e.target.value)} /></Field>
            </div>
            <PrimaryButton t={t} onClick={logSleep}>Log last night</PrimaryButton>
          </Card>
          <Card t={t}>
            <div style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sleep}>
                  <CartesianGrid stroke={t.line} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={dayName} tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip contentStyle={{ background: t.surface2, border: `1px solid ${t.line}`, borderRadius: 8, fontSize: 12, color: t.text }} />
                  <Line type="monotone" dataKey="hours" stroke={t.a1} strokeWidth={2.5} dot={{ r: 3, fill: t.a1 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      {sub === "workout" && (
        <>
          <Card t={t}>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inputStyle(t), flex: 1 }} placeholder="Exercise (e.g. Run, Gym)" value={exName} onChange={e => setExName(e.target.value)} />
              <input style={{ ...inputStyle(t), width: 66 }} placeholder="min" value={exMin} onChange={e => setExMin(e.target.value)} />
            </div>
            <PrimaryButton t={t} style={{ marginTop: 10 }} onClick={() => { if (!exName || !exMin) return; setWorkouts([...workouts, { id: uid(), date: todayStr(), name: exName, minutes: +exMin }]); setExName(""); setExMin(""); }}>Log workout</PrimaryButton>
          </Card>
          {workouts.length === 0 && <Empty t={t} text="No workouts logged yet." />}
          {[...workouts].reverse().map(w => (
            <Card t={t} key={w.id} style={{ display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 14, color: t.text }}>{w.name}</div><div style={{ fontSize: 11, color: t.muted }}>{w.date}</div></div>
              <div style={{ fontSize: 13, color: t.a2 }}>{w.minutes} min</div>
            </Card>
          ))}
        </>
      )}

      {sub === "diet" && (
        <>
          <Card t={t}>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inputStyle(t), flex: 1 }} placeholder="Meal" value={mealName} onChange={e => setMealName(e.target.value)} />
              <input style={{ ...inputStyle(t), width: 76 }} placeholder="kcal" value={mealCal} onChange={e => setMealCal(e.target.value)} />
            </div>
            <PrimaryButton t={t} style={{ marginTop: 10 }} onClick={() => { if (!mealName || !mealCal) return; setMeals([...meals, { id: uid(), date: todayStr(), name: mealName, cal: +mealCal }]); setMealName(""); setMealCal(""); }}>Log meal</PrimaryButton>
          </Card>
          {meals.length === 0 && <Empty t={t} text="No meals logged yet." />}
          {[...meals].reverse().map(m => (
            <Card t={t} key={m.id} style={{ display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 14, color: t.text }}>{m.name}</div><div style={{ fontSize: 11, color: t.muted }}>{m.date}</div></div>
              <div style={{ fontSize: 13, color: t.a5 }}>{m.cal} kcal</div>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

/* ---------- Budget ---------- */
function BudgetScreen({ t, tx, setTx }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const CATS = ["Food", "Transport", "Shopping", "Bills", "Income", "Other"];

  const add = () => { if (!amount) return; setTx([...tx, { id: uid(), date: todayStr(), amount: +amount, category, note, type: category === "Income" ? "income" : "expense" }]); setAmount(""); setNote(""); };
  const importCsv = (e) => {
    const file = e.target.files[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data.map(r => ({
          id: uid(), date: r.date || r.Date || todayStr(), amount: Math.abs(+(r.amount || r.Amount || 0)),
          category: r.category || r.Category || "Other", note: r.note || r.Note || r.description || r.Description || "",
          type: (+(r.amount || r.Amount || 0)) < 0 ? "expense" : (r.type || "expense")
        })).filter(r => r.amount);
        setTx([...tx, ...rows]);
      }
    });
  };

  const spent = tx.filter(x => x.type === "expense").reduce((s, x) => s + x.amount, 0);
  const income = tx.filter(x => x.type === "income").reduce((s, x) => s + x.amount, 0);
  const byCat = useMemo(() => {
    const m = {};
    tx.filter(x => x.type === "expense").forEach(x => { m[x.category] = (m[x.category] || 0) + x.amount; });
    return Object.entries(m).map(([name, value], i) => ({ name, value, colorKey: CAT_PALETTE[i % CAT_PALETTE.length] }));
  }, [tx]);

  return (
    <Screen t={t} title="Budget" right={
      <label className="press" style={{ width: 36, height: 36, borderRadius: 12, border: `1px solid ${t.line}`, background: t.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <Upload size={16} color={t.text} />
        <input type="file" accept=".csv" hidden onChange={importCsv} />
      </label>
    }>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <StatChip t={t} icon={<TrendingUp size={15} color={t.good} />} label="Income" value={"₹" + income} />
        <StatChip t={t} icon={<Flame size={15} color={t.a5} />} label="Spent" value={"₹" + spent} />
      </div>

      <Card t={t}>
        <div style={{ fontSize: 12, color: t.muted, marginBottom: 8 }}>Add a transaction, or import a bank/UPI CSV via ↑ above</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input style={{ ...inputStyle(t), width: 88 }} placeholder="₹ amount" value={amount} onChange={e => setAmount(e.target.value)} />
          <select style={{ ...inputStyle(t), flex: 1 }} value={category} onChange={e => setCategory(e.target.value)}>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <input style={{ ...inputStyle(t), marginBottom: 10 }} placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
        <PrimaryButton t={t} onClick={add}>Add transaction</PrimaryButton>
      </Card>

      {byCat.length > 0 && (
        <Card t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 104, height: 104, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={26} outerRadius={48} paddingAngle={3}>
                    {byCat.map((e, i) => <Cell key={i} fill={t[e.colorKey]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              {byCat.map(c => (
                <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: t[c.colorKey] }} />
                  <div style={{ color: t.text, flex: 1 }}>{c.name}</div>
                  <div style={{ color: t.muted }}>₹{c.value}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <SectionLabel t={t} text="Recent" />
      {[...tx].reverse().slice(0, 12).map(x => (
        <Card t={t} key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 13.5, color: t.text }}>{x.note || x.category}</div><div style={{ fontSize: 11, color: t.muted }}>{x.category} · {x.date}</div></div>
          <div style={{ fontSize: 13.5, color: x.type === "income" ? t.good : t.text, fontWeight: 700 }}>{x.type === "income" ? "+" : "-"}₹{x.amount}</div>
        </Card>
      ))}
    </Screen>
  );
}

/* ---------- Timetable ---------- */
function TimetableScreen({ t, blocks, setBlocks }) {
  const [time, setTime] = useState("09:00");
  const [label, setLabel] = useState("");
  const [permission, setPermission] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  const requestPerm = async () => { if (typeof Notification === "undefined") return; setPermission(await Notification.requestPermission()); };
  const scheduleReminder = (b) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const [h, m] = b.time.split(":").map(Number);
    const target = new Date(); target.setHours(h, m, 0, 0);
    if (target < new Date()) target.setDate(target.getDate() + 1);
    setTimeout(() => { try { new Notification("Life OS", { body: b.label }); } catch (e) {} }, Math.min(target - new Date(), 2147483000));
  };
  const add = () => { if (!label.trim()) return; const b = { id: uid(), time, label: label.trim() }; setBlocks([...blocks, b].sort((a, c) => a.time.localeCompare(c.time))); setLabel(""); scheduleReminder(b); };
  const remove = (id) => setBlocks(blocks.filter(b => b.id !== id));

  return (
    <Screen t={t} title="Timetable">
      <Card t={t} style={{ borderColor: permission === "granted" ? t.a1 : t.line }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bell size={16} color={permission === "granted" ? t.a1 : t.muted} />
          <div style={{ flex: 1, fontSize: 12, color: t.muted }}>
            {permission === "granted" ? "Reminders are on while this tab stays open." :
              permission === "unsupported" ? "This browser doesn't support notifications." : "Turn on reminders for scheduled blocks."}
          </div>
          {permission !== "granted" && permission !== "unsupported" && (
            <button onClick={requestPerm} className="press" style={{ border: "none", borderRadius: 9, padding: "7px 12px", background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`, color: t.onAccent, fontSize: 11, cursor: "pointer" }}>Enable</button>
          )}
        </div>
      </Card>

      <Card t={t}>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="time" style={{ ...inputStyle(t), width: 96 }} value={time} onChange={e => setTime(e.target.value)} />
          <input style={{ ...inputStyle(t), flex: 1 }} placeholder="What's scheduled?" value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
          <button onClick={add} className="press" style={{ width: 40, borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Plus size={18} color={t.onAccent} /></button>
        </div>
      </Card>

      {blocks.length === 0 && <Empty t={t} text="Build today's timetable — add your first block above." />}
      {blocks.map(b => (
        <Card t={t} key={b.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: t.a1, fontSize: 13, width: 56 }}><Clock size={13} />{b.time}</div>
          <div style={{ flex: 1, fontSize: 13.5, color: t.text }}>{b.label}</div>
          <X size={15} color={t.muted} style={{ cursor: "pointer" }} onClick={() => remove(b.id)} />
        </Card>
      ))}
    </Screen>
  );
}

/* ---------- Reports ---------- */
function ReportsScreen({ t, tasks, sleep, tx }) {
  const [range, setRange] = useState("week");
  const doneCount = tasks.filter(x => x.done).length;
  const avgSleep = sleep.length ? (sleep.reduce((s, x) => s + x.hours, 0) / sleep.length).toFixed(1) : 0;
  const spent = tx.filter(x => x.type === "expense").reduce((s, x) => s + x.amount, 0);
  const income = tx.filter(x => x.type === "income").reduce((s, x) => s + x.amount, 0);
  const daily = Object.values(tx.reduce((acc, x) => {
    if (x.type !== "expense") return acc;
    acc[x.date] = acc[x.date] || { date: x.date, amount: 0 }; acc[x.date].amount += x.amount; return acc;
  }, {}));

  return (
    <Screen t={t} title="Reports" right={
      <button onClick={() => window.print()} className="press" style={{ width: 36, height: 36, borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Download size={16} color={t.onAccent} /></button>
    }>
      <div id="print-area">
        <div className="print-only" style={{ display: "none", marginBottom: 16 }}>
          <h1 style={{ fontFamily: "Georgia, serif" }}>Life OS — {range === "week" ? "Weekly" : "Monthly"} Report</h1>
          <div style={{ color: "#555", fontSize: 12 }}>{new Date().toLocaleDateString()}</div>
        </div>

        <Segmented t={t} value={range} onChange={setRange} options={[["week", "Weekly", BarChart3], ["month", "Monthly", TrendingUp]]} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
          <StatChip t={t} icon={<Check size={15} color={t.a1} />} label="Tasks done" value={doneCount} />
          <StatChip t={t} icon={<Moon size={15} color={t.a2} />} label="Avg sleep" value={avgSleep + "h"} />
          <StatChip t={t} icon={<Wallet size={15} color={t.a5} />} label="Spent" value={"₹" + spent} />
          <StatChip t={t} icon={<TrendingUp size={15} color={t.good} />} label="Income" value={"₹" + income} />
        </div>

        <SectionLabel t={t} text="Sleep trend" />
        <Card t={t}>
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sleep}>
                <CartesianGrid stroke={t.line} vertical={false} />
                <XAxis dataKey="date" tickFormatter={dayName} tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                <Line type="monotone" dataKey="hours" stroke={t.a1} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <SectionLabel t={t} text="Spending by day" />
        <Card t={t}>
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <XAxis dataKey="date" tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Bar dataKey="amount" radius={[5, 5, 0, 0]} fill={t.a1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="no-print" style={{ fontSize: 11, color: t.muted, textAlign: "center", marginTop: 4 }}>
          Tap the download icon to save this report as a PDF via your browser's print dialog.
        </div>
      </div>
    </Screen>
  );
}

/* ---------- App shell ---------- */
export default function LifeOSApp() {
  const [theme, setTheme] = useState("dark");
  const t = useT(theme);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("home");
  const [tasks, setTasks] = useState(seedTasks());
  const [sleep, setSleep] = useState(seedSleep());
  const [workouts, setWorkouts] = useState([]);
  const [meals, setMeals] = useState([]);
  const [tx, setTx] = useState(seedTx());
  const [blocks, setBlocks] = useState([{ id: uid(), time: "06:30", label: "Wake + fajr" }, { id: uid(), time: "22:30", label: "Wind down for sleep" }]);

  const NAV = [["home", Home, "Home"], ["tasks", ListChecks, "Tasks"], ["health", Moon, "Health"], ["budget", Wallet, "Budget"], ["reports", BarChart3, "Reports"]];
  const navIdx = NAV.findIndex(n => n[0] === tab);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100%", background: theme === "dark" ? "#050810" : "#D8E3F7", padding: 20, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", transition: "background .3s ease" }}>
      <style>{`
        @keyframes pulseGlow { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        .pulse { animation: pulseGlow 3.5s ease-in-out infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn .32s ease; }
        .press:active { transform: scale(0.95); }
        .card-hover:hover { transform: translateY(-1px); }
        @media print {
          .phone-frame { box-shadow: none !important; border: none !important; width: 100% !important; height: auto !important; border-radius: 0 !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .bottom-nav { display: none !important; }
        }
        input:focus, select:focus { border-color: ${t.a1} !important; }
        ::-webkit-scrollbar { width: 0px; }
      `}</style>
      <div className="phone-frame" style={{
        width: 390, height: 780, background: t.bg, borderRadius: 36, border: `8px solid ${theme === "dark" ? "#050810" : "#0E1B33"}`,
        boxShadow: theme === "dark" ? "0 30px 70px -10px rgba(76,141,255,0.25)" : "0 30px 70px -10px rgba(47,111,237,0.3)",
        overflow: "hidden", position: "relative", display: "flex", flexDirection: "column", transition: "background .3s ease"
      }}>
        {!user ? (
          <AuthScreen t={t} onLogin={setUser} />
        ) : (
          <>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ height: "100%", overflowY: "auto" }} className="fade-in" key={tab}>
                {tab === "home" && (
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", top: 18, right: 20, zIndex: 2 }}>
                      <LogOut size={16} color={t.muted} style={{ cursor: "pointer" }} onClick={() => setUser(null)} />
                    </div>
                    <Dashboard t={t} tasks={tasks} sleep={sleep} tx={tx} name={user} setTab={setTab} theme={theme} setTheme={setTheme} />
                  </div>
                )}
                {tab === "tasks" && <TasksScreen t={t} tasks={tasks} setTasks={setTasks} />}
                {tab === "health" && <HealthScreen t={t} sleep={sleep} setSleep={setSleep} workouts={workouts} setWorkouts={setWorkouts} meals={meals} setMeals={setMeals} />}
                {tab === "budget" && <BudgetScreen t={t} tx={tx} setTx={setTx} />}
                {tab === "timetable" && <TimetableScreen t={t} blocks={blocks} setBlocks={setBlocks} />}
                {tab === "reports" && <ReportsScreen t={t} tasks={tasks} sleep={sleep} tx={tx} />}
              </div>
            </div>

            <div className="bottom-nav" style={{ position: "relative", display: "flex", borderTop: `1px solid ${t.line}`, background: t.surface, padding: "8px 6px 12px", flexShrink: 0 }}>
              <div style={{
                position: "absolute", top: 6, left: `calc(${navIdx} * (100% / 5) + 6px)`, width: `calc(100% / 5 - 12px)`,
                height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${t.a1}, ${t.a2})`, transition: "left .25s cubic-bezier(.4,0,.2,1)"
              }} />
              {NAV.map(([key, Icon, label]) => (
                <div key={key} onClick={() => setTab(key)} className="press" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", padding: "6px 0 0" }}>
                  <Icon size={19} color={tab === key ? t.a1 : t.muted} />
                  <div style={{ fontSize: 9.5, color: tab === key ? t.a1 : t.muted, fontWeight: tab === key ? 600 : 400 }}>{label}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
