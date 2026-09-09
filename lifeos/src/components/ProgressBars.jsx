import React from "react";
import { Check, Moon, Wallet, Flame } from "lucide-react";
import { Card } from "./primitives";

export function HorizontalProgressBar({ t, value = 0, max = 100, label, sublabel, color, icon: Icon, unit = "" }) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  const barColor = color || t.a1;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: t.text, fontWeight: 600 }}>
          {Icon && <Icon size={14} color={barColor} />}
          <span>{label}</span>
        </div>
        <div style={{ fontSize: 12, color: t.muted }}>
          <span style={{ color: t.text, fontWeight: 700 }}>{value}{unit}</span> / {max}{unit} ({percentage}%)
        </div>
      </div>
      <div style={{
        width: "100%", height: 8, background: t.surface2, borderRadius: 6, overflow: "hidden",
        position: "relative"
      }}>
        <div style={{
          width: `${percentage}%`, height: "100%",
          background: `linear-gradient(90deg, ${barColor}, ${t.a2 || barColor})`,
          borderRadius: 6, transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
        }} />
      </div>
      {sublabel && (
        <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{sublabel}</div>
      )}
    </div>
  );
}

export function ProgressOverviewCard({ t, title = "Progress Overview", tasks = [], sleep = [], tx = [], budgetLimit = 30000, period = "week" }) {
  const now = new Date();
  const daysCount = period === "week" ? 7 : 30;
  const cutoff = new Date(now.getTime() - daysCount * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Filter items in period
  const periodTasks = tasks.filter(x => !x.date || x.date >= cutoffStr);
  const doneTasks = periodTasks.filter(x => x.done).length;
  const totalTasks = periodTasks.length;

  const periodSleep = sleep.filter(x => !x.date || x.date >= cutoffStr);
  const goodSleepNights = periodSleep.filter(x => (x.hours || 0) >= 7).length;

  const spent = tx
    .filter(x => (!x.date || x.date >= cutoffStr) && x.type === "expense")
    .reduce((s, x) => s + (Number(x.amount) || 0), 0);

  return (
    <Card t={t} style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{title}</div>
        <div style={{ fontSize: 11.5, color: t.a1, textTransform: "capitalize", fontWeight: 600 }}>
          Past {daysCount} Days
        </div>
      </div>

      <HorizontalProgressBar
        t={t}
        label="Tasks Completed"
        value={doneTasks}
        max={totalTasks > 0 ? totalTasks : 1}
        color={t.a1}
        icon={Check}
        sublabel={`${doneTasks} of ${totalTasks} tasks finished`}
      />

      <HorizontalProgressBar
        t={t}
        label="Sleep Goal (7h+ nights)"
        value={goodSleepNights}
        max={daysCount}
        color={t.a2}
        icon={Moon}
        sublabel={`${goodSleepNights} nights met 7+ hours target`}
      />

      <HorizontalProgressBar
        t={t}
        label="Budget Spending"
        value={spent}
        max={budgetLimit}
        color={spent > budgetLimit ? t.warm : t.good}
        icon={Wallet}
        unit="₹"
        sublabel={`₹${spent} spent vs ₹${budgetLimit} limit`}
      />
    </Card>
  );
}
