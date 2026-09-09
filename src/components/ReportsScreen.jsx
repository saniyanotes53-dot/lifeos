import React, { useState } from "react";
import {
  Check, Moon, Wallet, Download, BarChart3, TrendingUp
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, LineChart, Line, CartesianGrid, YAxis, Tooltip
} from "recharts";
import { dayName } from "../theme";
import { Card, Screen, SectionLabel, Segmented, StatChip } from "./primitives";
import { ProgressOverviewCard } from "./ProgressBars";

export default function ReportsScreen({ t, tasks = [], sleep = [], tx = [] }) {
  const [range, setRange] = useState("week");
  const daysCount = range === "week" ? 7 : 30;
  const cutoff = new Date(Date.now() - daysCount * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const periodTasks = tasks.filter(x => !x.date || x.date >= cutoff);
  const periodSleep = sleep.filter(x => !x.date || x.date >= cutoff);
  const periodTx = tx.filter(x => !x.date || x.date >= cutoff);

  const doneCount = periodTasks.filter(x => x.done).length;
  const avgSleep = periodSleep.length ? (periodSleep.reduce((s, x) => s + (Number(x.hours) || 0), 0) / periodSleep.length).toFixed(1) : 0;
  const spent = periodTx.filter(x => x.type === "expense").reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const income = periodTx.filter(x => x.type === "income").reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const daily = Object.values(periodTx.reduce((acc, x) => {
    if (x.type !== "expense") return acc;
    acc[x.date] = acc[x.date] || { date: x.date, amount: 0 };
    acc[x.date].amount += (Number(x.amount) || 0);
    return acc;
  }, {}));

  return (
    <Screen t={t} title="Analytics & Reports" right={
      <button
        onClick={() => window.print()}
        className="press"
        style={{
          width: 38, height: 38, borderRadius: 12, border: "none",
          background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
        }}
      >
        <Download size={16} color={t.onAccent} />
      </button>
    }>
      <div id="print-area" style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div className="print-only" style={{ display: "none", marginBottom: 16 }}>
          <h1 style={{ fontFamily: "Georgia, serif" }}>Life OS — {range === "week" ? "Weekly" : "Monthly"} Report</h1>
          <div style={{ color: "#555", fontSize: 12 }}>{new Date().toLocaleDateString()}</div>
        </div>

        <div style={{ width: 260, marginBottom: 14 }}>
          <Segmented t={t} value={range} onChange={setRange} options={[["week", "Weekly", BarChart3], ["month", "Monthly", TrendingUp]]} />
        </div>

        {/* Quick KPI stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
          <StatChip t={t} icon={<Check size={16} color={t.a1} />} label="Tasks done" value={doneCount} />
          <StatChip t={t} icon={<Moon size={16} color={t.a2} />} label="Avg sleep" value={avgSleep + "h"} />
          <StatChip t={t} icon={<Wallet size={16} color={t.a5} />} label="Spent" value={"₹" + spent.toLocaleString()} />
          <StatChip t={t} icon={<TrendingUp size={16} color={t.good} />} label="Income" value={"₹" + income.toLocaleString()} />
        </div>

        {/* Weekly & Monthly Progress Overview side-by-side */}
        <SectionLabel t={t} text="Goal Adherence & Performance" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 16 }}>
          <ProgressOverviewCard
            t={t}
            title="Weekly Progress (7-Day)"
            tasks={tasks}
            sleep={sleep}
            tx={tx}
            period="week"
            budgetLimit={10000}
          />
          <ProgressOverviewCard
            t={t}
            title="Monthly Progress (30-Day)"
            tasks={tasks}
            sleep={sleep}
            tx={tx}
            period="month"
            budgetLimit={40000}
          />
        </div>

        {/* Charts Section */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 16 }}>
          <div>
            <SectionLabel t={t} text="Sleep trend" />
            <Card t={t} style={{ padding: 18 }}>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sleep}>
                    <CartesianGrid stroke={t.line} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={dayName} tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ background: t.surface2, border: `1px solid ${t.line}`, borderRadius: 8, fontSize: 12, color: t.text }} />
                    <Line type="monotone" dataKey="hours" stroke={t.a1} strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div>
            <SectionLabel t={t} text="Spending by day" />
            <Card t={t} style={{ padding: 18 }}>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily}>
                    <XAxis dataKey="date" tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
                    <Tooltip contentStyle={{ background: t.surface2, border: `1px solid ${t.line}`, borderRadius: 8, fontSize: 12, color: t.text }} />
                    <Bar dataKey="amount" radius={[5, 5, 0, 0]} fill={t.a1} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        <div className="no-print" style={{ fontSize: 12, color: t.muted, textAlign: "center", marginTop: 12, paddingBottom: 12 }}>
          Tap the download icon to export this comprehensive report as a PDF via your browser's print dialog.
        </div>

        <div style={{ textAlign: "center", fontSize: 11.5, color: t.muted, opacity: 0.85, paddingBottom: 24 }}>
          This website is designed by <strong style={{ color: t.a1, fontWeight: 700 }}>Buraq Studios</strong> · Copyright all rights reserved.
        </div>
      </div>
    </Screen>
  );
}
