import React, { useState } from "react";
import { Sparkles, Moon, Wallet, ListChecks, Dumbbell } from "lucide-react";
import { Card, PrimaryButton } from "./primitives";
import { localDateKey, formatDate, dateRange } from "../utils/dates";
import { filterPeriod, sleepByDay, money, numeric } from "../utils/analytics";

export default function AiCoachCard({ t, tasks = [], sleep = [], tx = [], workouts = [], onOpenFocus, setTab }) {
  const [expanded, setExpanded] = useState(false);
  const today = localDateKey();
  const recentTasks = filterPeriod(tasks, 7, today);
  const done = recentTasks.filter(x => x.done).length;
  const nights = sleepByDay(sleep, dateRange(7, today));
  const lastNight = nights.at(-1);
  const todayTx = tx.filter(x => x.date === today);
  const spent = todayTx.filter(x => x.type === "expense").reduce((sum, x) => sum + numeric(x.amount), 0);
  const sessions = filterPeriod(workouts, 7, today);
  const pending = tasks.filter(x => !x.done && x.priority === "High").length;
  const insights = [
    { icon: ListChecks, title: "Tasks", text: recentTasks.length ? `${done} of ${recentTasks.length} tasks added in the past 7 days are complete.${pending ? ` ${pending} high-priority tasks remain open.` : ""}` : "No dated tasks in the past 7 days. Add a task to start tracking." },
    { icon: Moon, title: "Sleep", text: lastNight ? `Latest record: ${lastNight.hours}h on ${formatDate(lastNight.date)}. ${nights.length} wake-up dates logged in the past 7 days.` : "No sleep recorded in the past 7 days. Your sleep progress is unknown." },
    { icon: Wallet, title: "Spending", text: todayTx.length ? `${money(spent)} in expenses recorded today. Only logged transactions are included.` : "No transactions logged today. This does not necessarily mean you spent nothing." },
    { icon: Dumbbell, title: "Workouts", text: sessions.length ? `${sessions.length} sessions and ${sessions.reduce((sum, x) => sum + numeric(x.minutes), 0)} minutes logged in the past 7 days.` : "No workouts logged in the past 7 days." },
  ];
  return <Card t={t} style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}><Sparkles size={20} color={t.a1} /> Your weekly check-in</div>
      <button type="button" className="link-button" style={{ color: t.a1, fontSize: 14 }} aria-expanded={expanded} aria-controls="coach-details" onClick={() => setExpanded(v => !v)}>{expanded ? "Hide details" : "Show details"}</button>
    </div>
    <p style={{ color: t.muted, fontSize: 14, margin: "4px 0" }}>A summary of your recorded activity. Missing logs are left unknown.</p>
    {expanded && <div id="coach-details" style={{ marginTop: 16 }}>
      <div className="responsive-grid">
        {insights.map(({ icon: Icon, title, text }) => <div key={title} style={{ background: t.surface2, padding: 14, borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}><Icon size={17} color={t.a1} />{title}</div>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: t.muted, marginBottom: 0 }}>{text}</p>
        </div>)}
      </div>
      <PrimaryButton t={t} onClick={() => onOpenFocus ? onOpenFocus() : setTab("focus")} style={{ width: "auto", marginTop: 14 }}>Open Focus Studio</PrimaryButton>
    </div>}
  </Card>;
}
