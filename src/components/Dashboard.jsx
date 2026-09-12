import React, { useState, useEffect } from "react";
import {
  Home, Moon, Wallet, ChevronLeft, Clock, Calendar, CheckSquare, Sparkles,
  Headphones, DollarSign, Flame, CheckCircle2, Circle, Zap, ArrowRight, ShieldCheck
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis } from "recharts";
import { todayStr as getToday, dayName, PRI_KEY } from "../theme";
import { Card, SectionLabel, Empty, ThemeToggle, Hero, ProgressRing, StatChip } from "./primitives";
import { ProgressOverviewCard } from "./ProgressBars";
import AiCoachCard from "./AiCoachCard";
import { dateRange } from "../utils/dates";
import { sleepByDay } from "../utils/analytics";
import { useToast } from "./Toast";

export default function Dashboard({
  t,
  tasks = [],
  sleep = [],
  tx = [],
  workouts = [],
  name,
  setTab,
  theme,
  setTheme,
  onOpenProfile,
  onOpenWealth,
  onOpenFocus,
  blocks = [],
  onOpenHealthView
}) {
  const toast = useToast();
  const todayStr = getToday();
  const openTasks = tasks.filter(x => !x.done);
  const pct = tasks.length ? Math.round((tasks.filter(x => x.done).length / tasks.length) * 100) : 0;
  const priVal = (p) => ({ High: 0, Med: 1, Low: 2 }[p] ?? 3);
  const top = [...openTasks].sort((a, b) => priVal(a.priority) - priVal(b.priority)).slice(0, 3);
  const sleepWeek = sleepByDay(sleep, dateRange(7, todayStr));
  const lastSleep = sleepByDay(sleep).filter(x => x.date <= todayStr).at(-1);
  const currentTime = new Date().toTimeString().slice(0, 5);
  const upcoming = blocks.filter(x => !x.done && x.date === todayStr && x.time >= currentTime).sort((a, b) => a.time.localeCompare(b.time))[0];
  const spentToday = tx.filter(x => x.date === todayStr && x.type === "expense").reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Daily Habits Tracker state (stored in localStorage with date key)
  const habitStorageKey = `lifeos_habits_${todayStr}`;
  const [habits, setHabits] = useState(() => {
    try {
      const saved = localStorage.getItem(habitStorageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: "h1", label: "Hydrate 2.5L Water", done: false, xp: 15 },
      { id: "h2", label: "30 Min Exercise / Walk", done: false, xp: 30 },
      { id: "h3", label: "20 Min Deep Focus Sprint", done: false, xp: 25 },
      { id: "h4", label: "15 Min Reading / Journaling", done: false, xp: 20 },
      { id: "h5", label: "Zero Unplanned Spending", done: false, xp: 25 },
    ];
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(habitStorageKey) || "null");
      setHabits(previous => Array.isArray(saved) ? saved : previous.map(h => ({ ...h, done: false })));
    } catch {
      setHabits(previous => previous.map(h => ({ ...h, done: false })));
    }
  }, [habitStorageKey]);

  const toggleHabit = (id) => {
    const next = habits.map(h => {
      if (h.id === id) {
        const nextDone = !h.done;
        if (nextDone) {
          const newXP = Number(localStorage.getItem("lifeos_user_xp") || 250) + h.xp;
          localStorage.setItem("lifeos_user_xp", String(newXP));
          toast(`✨ Habit checked: ${h.label} (+${h.xp} XP)`, "sparkle", 3000);
        }
        return { ...h, done: nextDone };
      }
      return h;
    });
    setHabits(next);
    localStorage.setItem(habitStorageKey, JSON.stringify(next));
  };

  const habitsDone = habits.filter(h => h.done).length;

  return (
    <div style={{ position: "relative" }}>
      <Hero t={t} height={190} />
      <div className="dashboard-content" style={{ position: "relative", padding: "20px 24px" }}>
        {/* Header greeting & Theme Toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: t.muted }}>
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <h1 style={{ fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 26, color: t.text, margin: "2px 0 0" }}>
              {greeting}, {name}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ThemeToggle theme={theme} setTheme={setTheme} t={t} />
          </div>
        </div>

        {/* Two-Column Grid for Priorities & Sleep */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14, marginBottom: 14 }}>
          {/* Priorities */}
          <div>
            <SectionLabel t={t} text="Your next priorities" action="See all" onAction={() => setTab("tasks")} />
            <Card t={t} style={{ minHeight: 140 }}>
              {top.length === 0 && <Empty t={t} text="Nothing pending — add a task to plan your day." />}
              {top.map((x, i) => (
                <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < top.length - 1 ? `1px solid ${t.line}` : "none" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: t[PRI_KEY[x.priority]] }} />
                  <div style={{ fontSize: 13.5, color: t.text, flex: 1 }}>{x.title}</div>
                  <div style={{ fontSize: 11, color: t.muted }}>{x.priority}</div>
                </div>
              ))}
            </Card>
          </div>

          {/* Sleep Graph */}
          <div>
            <SectionLabel t={t} text="Sleep · past 7 days" action="Log" onAction={() => onOpenHealthView ? onOpenHealthView("sleep") : setTab("health")} />
            <Card t={t} style={{ minHeight: 140 }}>
              {sleepWeek.length === 0 ? <Empty t={t} text="No sleep logged in the past 7 days." /> : <div style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sleepWeek}>
                    <XAxis dataKey="date" tickFormatter={dayName} tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Bar dataKey="hours" radius={[5, 5, 0, 0]} fill={t.a1} />
                  </BarChart>
                </ResponsiveContainer>
              </div>}
            </Card>
          </div>
        </div>

        <Card t={t} onClick={() => setTab("timetable")} style={{ marginBottom: 16 }}>
          <div style={{ color: t.muted, fontSize: 14 }}>Next on your timetable</div>
          <div style={{ marginTop: 6, fontWeight: 700 }}>{upcoming ? `${upcoming.time} — ${upcoming.label}` : "No upcoming blocks today. Plan your next activity."}</div>
        </Card>

        {/* Quick Launch Pro Bar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
          gap: 10,
          marginBottom: 16
        }}>
          <button type="button"
            onClick={onOpenFocus ? onOpenFocus : () => setTab("focus")}
            className="press card-hover"
            style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },
              background: `linear-gradient(135deg, ${t.a1}22, ${t.a3}15)`,
              border: `1px solid ${t.a1}44`,
              borderRadius: 14,
              padding: "12px 14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: t.a1,
              color: t.onAccent, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Headphones size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 4 }}>
                Focus Studio
                <span style={{ fontSize: 9, background: t.a1, color: t.onAccent, padding: "1px 5px", borderRadius: 10, fontWeight: 700 }}>
                  PRO
                </span>
              </div>
              <div style={{ fontSize: 11, color: t.muted }}>Binaural Beats & Timer</div>
            </div>
            <ArrowRight size={15} color={t.a1} />
          </button>

          <button type="button"
            onClick={onOpenWealth}
            className="press card-hover"
            style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },
              background: `linear-gradient(135deg, ${t.good}20, ${t.a1}12)`,
              border: `1px solid ${t.good}44`,
              borderRadius: 14,
              padding: "12px 14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: t.good,
              color: t.onAccent, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <DollarSign size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 4 }}>
                Wealth Runway
                <span style={{ fontSize: 9, background: t.good, color: t.onAccent, padding: "1px 5px", borderRadius: 10, fontWeight: 700 }}>
                  PRO
                </span>
              </div>
              <div style={{ fontSize: 11, color: t.muted }}>5-Year Compound Growth</div>
            </div>
            <ArrowRight size={15} color={t.good} />
          </button>
        </div>

        {/* Top Metric Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14, marginBottom: 16 }}>
          <Card t={t} style={{ display: "flex", alignItems: "center", gap: 16, margin: 0, padding: 18 }} onClick={() => setTab("tasks")}>
            <ProgressRing t={t} pct={pct} size={62}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{pct}%</div>
            </ProgressRing>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: t.text, fontWeight: 700 }}>{openTasks.length} open {openTasks.length === 1 ? "task" : "tasks"}</div>
              <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>Tap to prioritize your focus</div>
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <StatChip t={t} icon={<Moon size={16} color={t.a2} />} label="Last sleep" value={lastSleep ? lastSleep.hours + "h" : "—"} onClick={() => setTab("health")} />
            <StatChip t={t} icon={<Wallet size={16} color={t.a5} />} label="Spent today" value={"₹" + spentToday.toLocaleString()} onClick={() => setTab("budget")} />
          </div>
        </div>

        {/* Daily Habits & Momentum Checklist */}
        <div style={{ marginBottom: 16 }}>
          <SectionLabel
            t={t}
            text={`Daily Habits & Micro-Wins (${habitsDone}/${habits.length})`}
            action="Reset Today"
            onAction={() => {
              const reset = habits.map(h => ({ ...h, done: false }));
              setHabits(reset);
              localStorage.setItem(habitStorageKey, JSON.stringify(reset));
              toast("Daily habits reset for today", "info");
            }}
          />
          <Card t={t} style={{ padding: "14px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 10 }}>
              {habits.map(h => (
                <button type="button"
                  key={h.id}
                  onClick={() => toggleHabit(h.id)}
                  className="press"
                  style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 12,
                    background: h.done ? `${t.good}15` : t.surface2,
                    border: `1px solid ${h.done ? t.good : t.line}`,
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{
                    color: h.done ? t.good : t.muted,
                    display: "flex", alignItems: "center"
                  }}>
                    {h.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </div>
                  <div style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: h.done ? t.text : t.text,
                    textDecoration: h.done ? "line-through" : "none",
                    opacity: h.done ? 0.8 : 1,
                    flex: 1
                  }}>
                    {h.label}
                  </div>
                  <span style={{ fontSize: 10.5, color: h.done ? t.good : t.muted, fontWeight: 700 }}>
                    +{h.xp} XP
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* AI LIFE COACH INTELLIGENCE CARD (PRO FEATURE) */}
        <AiCoachCard
          t={t}
          tasks={tasks}
          sleep={sleep}
          tx={tx}
          workouts={workouts}
          onOpenFocus={onOpenFocus}
          setTab={setTab}
        />

        {/* Weekly Progress Bars Overview */}
        <div style={{ marginBottom: 16 }}>
          <ProgressOverviewCard
            t={t}
            title="Weekly Goals & Habits"
            tasks={tasks}
            sleep={sleep}
            tx={tx}
            period="week"
          />
        </div>

        {/* Timetable link */}
        <SectionLabel t={t} text="Day Scheduling" />
        <Card t={t} onClick={() => setTab("timetable")} style={{ display: "flex", alignItems: "center", gap: 14, padding: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: t.surface2, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={20} color={t.a1} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: t.text, fontWeight: 700 }}>Timetable & Reminders</div>
            <div style={{ fontSize: 12, color: t.muted }}>Plan time blocks and manage reminders</div>
          </div>
          <ChevronLeft size={18} color={t.muted} style={{ transform: "rotate(180deg)" }} />
        </Card>

        <div style={{ marginTop: 20 }}>
          <div style={{ textAlign: "center", fontSize: 11.5, color: t.muted, opacity: 0.85, padding: "12px 0" }}>
            This website is designed by <strong style={{ color: t.a1, fontWeight: 700 }}>Buraq Studios</strong> · Copyright all rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
