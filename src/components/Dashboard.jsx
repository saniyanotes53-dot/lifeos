import React from "react";
import {
  Home, Moon, Wallet, ChevronLeft, Clock, Calendar, CheckSquare, Sparkles
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis } from "recharts";
import { dayName, PRI_KEY } from "../theme";
import { Card, SectionLabel, Empty, ThemeToggle, Hero, ProgressRing, StatChip } from "./primitives";
import { ProgressOverviewCard } from "./ProgressBars";

export default function Dashboard({ t, tasks = [], sleep = [], tx = [], name, setTab, theme, setTheme, onOpenProfile }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const openTasks = tasks.filter(x => !x.done);
  const pct = tasks.length ? Math.round((tasks.filter(x => x.done).length / tasks.length) * 100) : 0;
  const priVal = (p) => ({ High: 0, Med: 1, Low: 2 }[p] ?? 3);
  const top = [...openTasks].sort((a, b) => priVal(a.priority) - priVal(b.priority)).slice(0, 3);
  const lastSleep = sleep[0];
  const spentToday = tx.filter(x => x.date === todayStr && x.type === "expense").reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ position: "relative" }}>
      <Hero t={t} height={190} />
      <div style={{ position: "relative", padding: "20px 24px" }}>
        {/* Header greeting */}
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

        {/* Top Metric Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 16 }}>
          <Card t={t} style={{ display: "flex", alignItems: "center", gap: 16, margin: 0, padding: 18 }} onClick={() => setTab("tasks")}>
            <ProgressRing t={t} pct={pct} size={62}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{pct}%</div>
            </ProgressRing>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: t.text, fontWeight: 700 }}>{openTasks.length} tasks open today</div>
              <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>Tap to prioritise your focus</div>
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <StatChip t={t} icon={<Moon size={16} color={t.a2} />} label="Last sleep" value={lastSleep ? lastSleep.hours + "h" : "—"} onClick={() => setTab("health")} />
            <StatChip t={t} icon={<Wallet size={16} color={t.a5} />} label="Spent today" value={"₹" + spentToday.toLocaleString()} onClick={() => setTab("budget")} />
          </div>
        </div>

        {/* Weekly Progress Bars Overview */}
        <div style={{ marginBottom: 16 }}>
          <ProgressOverviewCard
            t={t}
            title="Weekly Goals & Habits"
            tasks={tasks}
            sleep={sleep}
            tx={tx}
            period="week"
            budgetLimit={10000}
          />
        </div>

        {/* Two-Column Grid for Day Management */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 14 }}>
          {/* Priorities */}
          <div>
            <SectionLabel t={t} text="Today's priorities" action="See all" onAction={() => setTab("tasks")} />
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
            <SectionLabel t={t} text="Sleep this week" action="Log" onAction={() => setTab("health")} />
            <Card t={t} style={{ minHeight: 140 }}>
              <div style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sleep}>
                    <XAxis dataKey="date" tickFormatter={dayName} tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Bar dataKey="hours" radius={[5, 5, 0, 0]} fill={t.a1} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        {/* Timetable link */}
        <SectionLabel t={t} text="Day Scheduling" />
        <Card t={t} onClick={() => setTab("timetable")} style={{ display: "flex", alignItems: "center", gap: 14, padding: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: t.surface2, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={20} color={t.a1} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: t.text, fontWeight: 700 }}>Timetable & Reminders</div>
            <div style={{ fontSize: 12, color: t.muted }}>Schedule time blocks and receive proactive push alerts</div>
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
