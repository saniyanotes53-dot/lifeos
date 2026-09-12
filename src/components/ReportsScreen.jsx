import React, { useState } from "react";
import {
  Check, Moon, Wallet, Download, BarChart3, TrendingUp
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, LineChart, Line, CartesianGrid, YAxis, Tooltip
} from "recharts";
import { dateRange, formatDate } from "../utils/dates";
import { filterPeriod, sleepByDay, dailySpending } from "../utils/analytics";
import { dayName } from "../theme";
import { Card, Screen, SectionLabel, Segmented, StatChip } from "./primitives";
import { ProgressOverviewCard } from "./ProgressBars";

export default function ReportsScreen({ t, tasks = [], sleep = [], tx = [] }) {
  const [range, setRange] = useState("week");
  const daysCount = range === "week" ? 7 : 30;
  const periodTasks = filterPeriod(tasks, daysCount);
  const periodSleep = sleepByDay(sleep, dateRange(daysCount));
  const periodTx = filterPeriod(tx, daysCount);
  const doneCount = periodTasks.filter(x => x.done).length;
  const avgSleep = periodSleep.length ? (periodSleep.reduce((sum, x) => sum + x.hours, 0) / periodSleep.length).toFixed(1) : null;
  const spent = periodTx.filter(x => x.type === "expense").reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
  const income = periodTx.filter(x => x.type === "income").reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
  const daily = dailySpending(periodTx);
  const rangeDates = dateRange(daysCount);

  return (
    <Screen t={t} title="Analytics & Reports" right={
      <button
        type="button" aria-label="Print / Save as PDF" title="Print / Save as PDF"
        onClick={() => window.print()}
        className="press"
        style={{
          minHeight: 44, padding: "10px 14px", gap: 8, color: t.onAccent, fontSize: 14, borderRadius: 12, border: "none",
          background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
        }}
      >
        <Download size={16} color={t.onAccent} /> Print / Save as PDF
      </button>
    }>
      <div id="print-area" style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div className="print-only" style={{ display: "none", marginBottom: 16 }}>
          <h1 style={{ fontFamily: "Georgia, serif" }}>Life OS — {range === "week" ? "Weekly" : "Monthly"} Report</h1>
          <div style={{ color: "#555", fontSize: 12 }}>{new Date().toLocaleDateString()}</div>
        </div>

        <div className="no-print" style={{ width: "100%", maxWidth: 300, marginBottom: 14 }}>
          <Segmented t={t} value={range} onChange={setRange} options={[["week", "Weekly", BarChart3], ["month", "Monthly", TrendingUp]]} />
        </div>

        <p style={{ color: t.muted, fontSize: 14 }}>{formatDate(rangeDates.start)} – {formatDate(rangeDates.end)} · Past {daysCount} days, including today</p>
        {/* Quick KPI stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12, marginBottom: 16 }}>
          <StatChip t={t} icon={<Check size={16} color={t.a1} />} label="Tasks done" value={doneCount} />
          <StatChip t={t} icon={<Moon size={16} color={t.a2} />} label="Avg sleep" value={avgSleep === null ? "Not logged" : avgSleep + "h"} />
          <StatChip t={t} icon={<Wallet size={16} color={t.a5} />} label="Spent" value={"₹" + spent.toLocaleString()} />
          <StatChip t={t} icon={<TrendingUp size={16} color={t.good} />} label="Income" value={"₹" + income.toLocaleString()} />
        </div>

        {/* Weekly & Monthly Progress Overview side-by-side */}
        <SectionLabel t={t} text="Goal Adherence & Performance" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14, marginBottom: 16 }}>
          <ProgressOverviewCard
            t={t}
            title="Weekly Progress (7-Day)"
            tasks={tasks}
            sleep={sleep}
            tx={tx}
            period="week"
          />
          <ProgressOverviewCard
            t={t}
            title="Monthly Progress (30-Day)"
            tasks={tasks}
            sleep={sleep}
            tx={tx}
            period="month"
          />
        </div>

        {/* Charts Section */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14, marginBottom: 16 }}>
          <div>
            <SectionLabel t={t} text="Sleep trend" />
            <p style={{ fontSize: 13, color: t.muted }}>One point per wake-up date. Older duplicate entries are averaged.</p>
            <Card t={t} style={{ padding: 18 }}>
              {periodSleep.length === 0 && <p style={{ color: t.muted }}>No sleep logged in this period.</p>}
              <div className="report-chart" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={periodSleep}>
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
              {daily.length === 0 && <p style={{ color: t.muted }}>No expenses logged in this period.</p>}
              <div className="report-chart" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily}>
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
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
          Choose “Print / Save as PDF”, then select “Save as PDF” in the print dialog.
        </div>

        <div style={{ textAlign: "center", fontSize: 11.5, color: t.muted, opacity: 0.85, paddingBottom: 24 }}>
          This website is designed by <strong style={{ color: t.a1, fontWeight: 700 }}>Buraq Studios</strong> · Copyright all rights reserved.
        </div>
      </div>
    </Screen>
  );
}
