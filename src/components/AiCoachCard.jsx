import React, { useMemo, useState } from "react";
import {
  Sparkles, Zap, ShieldAlert, Award, ChevronRight, CheckCircle2,
  TrendingUp, Moon, Wallet, ListChecks, Flame
} from "lucide-react";
import { Card, ProgressRing } from "./primitives";

export default function AiCoachCard({
  t,
  tasks = [],
  sleep = [],
  tx = [],
  workouts = [],
  onOpenFocus,
  setTab
}) {
  const [expanded, setExpanded] = useState(false);

  // Life Balance Index Algorithm (0 - 100)
  const audit = useMemo(() => {
    // 1. Task Score (0-100)
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(x => x.done).length;
    const taskScore = totalTasks === 0 ? 80 : Math.round((completedTasks / totalTasks) * 100);

    // 2. Sleep Score (0-100)
    const lastSleep = sleep[0];
    const sleepHours = lastSleep ? (parseFloat(lastSleep.hours) || 7) : 7;
    const sleepScore = Math.min(100, Math.round((sleepHours / 8) * 100));

    // 3. Finance Discipline Score (0-100)
    const todayStr = new Date().toISOString().slice(0, 10);
    const todaySpent = tx.filter(x => x.date === todayStr && x.type === "expense").reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const financeScore = todaySpent > 3000 ? 65 : todaySpent > 1000 ? 85 : 95;

    // 4. Fitness / Health Score (0-100)
    const workoutScore = workouts.length > 0 ? 95 : 70;

    // Composite Life Balance Index (0-100)
    const overallScore = Math.round(
      (taskScore * 0.35) + (sleepScore * 0.25) + (financeScore * 0.25) + (workoutScore * 0.15)
    );

    let tier = "High Velocity";
    let badgeColor = t.good;
    if (overallScore >= 90) {
      tier = "Elite Flow State";
      badgeColor = "#10b981";
    } else if (overallScore >= 75) {
      tier = "High Velocity Achiever";
      badgeColor = t.a1;
    } else if (overallScore >= 55) {
      tier = "Steady Momentum";
      badgeColor = "#f59e0b";
    } else {
      tier = "Recovery Required";
      badgeColor = "#ef4444";
    }

    // Dynamic AI Insights & Tips
    const insights = [];

    if (sleepHours < 6.5) {
      insights.push({
        type: "alert",
        icon: Moon,
        title: "Sleep Deficit Detected",
        desc: `Logged ${sleepHours}h of sleep. Schedule a 25m Focus Sprint before 2 PM to avoid afternoon cognitive fatigue.`
      });
    } else {
      insights.push({
        type: "good",
        icon: Moon,
        title: "Optimal Recovery Engine",
        desc: `Solid ${sleepHours}h sleep logged. Your cognitive focus capacity is operating at peak threshold.`
      });
    }

    if (tasks.filter(x => !x.done && x.priority === "High").length > 0) {
      insights.push({
        type: "action",
        icon: ListChecks,
        title: "High-Priority Task Pressure",
        desc: "You have critical high-priority tasks pending. Activate a 25-minute Deep Work sprint in Focus Studio."
      });
    } else {
      insights.push({
        type: "good",
        icon: ListChecks,
        title: "Pacing On Track",
        desc: "All high-priority items handled or distributed. Excellent operational rhythm."
      });
    }

    if (todaySpent > 2500) {
      insights.push({
        type: "alert",
        icon: Wallet,
        title: "Budget Burn Velocity Warning",
        desc: `Spent ₹${todaySpent.toLocaleString()} today. Review non-essential expenses to maintain monthly runway.`
      });
    }

    return {
      overallScore,
      tier,
      badgeColor,
      insights,
      taskScore,
      sleepScore,
      financeScore,
      workoutScore
    };
  }, [tasks, sleep, tx, workouts, t]);

  // Gamification XP from localStorage
  const userXP = Number(localStorage.getItem("lifeos_user_xp") || 250);
  const userLevel = Math.floor(userXP / 200) + 1;
  const xpInCurrentLevel = userXP % 200;

  return (
    <Card t={t} style={{
      margin: "0 0 16px 0",
      padding: "20px 22px",
      background: `linear-gradient(135deg, ${t.surface}, ${t.surface2})`,
      border: `1px solid ${t.a1}33`,
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Background ambient glow */}
      <div style={{
        position: "absolute",
        top: -30,
        right: -30,
        width: 140,
        height: 140,
        borderRadius: "50%",
        background: `${t.a1}18`,
        filter: "blur(30px)",
        pointerEvents: "none"
      }} />

      {/* Card Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: t.onAccent,
            boxShadow: `0 6px 18px -4px ${t.a1}66`
          }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
              AI Life Intelligence Coach
              <span style={{
                fontSize: 10,
                background: `${t.a1}22`,
                color: t.a1,
                border: `1px solid ${t.a1}44`,
                padding: "2px 8px",
                borderRadius: 20,
                fontWeight: 700
              }}>
                SMART AUDIT
              </span>
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
              Synthesizing task execution, sleep architecture, and financial velocity.
            </div>
          </div>
        </div>

        {/* Level & XP Badge */}
        <div style={{
          background: t.surface,
          border: `1px solid ${t.line}`,
          borderRadius: 14,
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <Award size={18} color="#f59e0b" />
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: t.text }}>
              Tier {userLevel} · {userXP} XP
            </div>
            <div style={{ width: 80, height: 4, background: t.surface2, borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
              <div style={{ width: `${(xpInCurrentLevel / 200) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${t.a1}, ${t.good})` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Score & Metric Ring */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 20,
        alignItems: "center",
        background: t.surface,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: "16px 18px",
        marginBottom: 14
      }}>
        <ProgressRing t={t} pct={audit.overallScore} size={84} stroke={9}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.text, lineHeight: 1 }}>
              {audit.overallScore}
            </div>
            <div style={{ fontSize: 9.5, color: t.muted, fontWeight: 600 }}>INDEX</div>
          </div>
        </ProgressRing>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: audit.badgeColor }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: audit.badgeColor }}>
              {audit.tier}
            </span>
          </div>

          <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.4, marginBottom: 8 }}>
            Today's balance is optimized. Your habit execution velocity is beating your 7-day average.
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: t.muted }}>
            <span>Tasks: <strong style={{ color: t.text }}>{audit.taskScore}%</strong></span>
            <span>Sleep: <strong style={{ color: t.text }}>{audit.sleepScore}%</strong></span>
            <span>Budget: <strong style={{ color: t.text }}>{audit.financeScore}%</strong></span>
          </div>
        </div>
      </div>

      {/* Actionable Insights List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {audit.insights.slice(0, expanded ? undefined : 2).map((ins, i) => {
          const Icon = ins.icon;
          return (
            <div
              key={i}
              style={{
                background: t.surface2,
                border: `1px solid ${t.line}`,
                borderRadius: 12,
                padding: "10px 14px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: ins.type === "good" ? `${t.good}22` : `${t.a1}22`,
                color: ins.type === "good" ? t.good : t.a1,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, marginTop: 1
              }}>
                <Icon size={15} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>
                  {ins.title}
                </div>
                <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2, lineHeight: 1.4 }}>
                  {ins.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Card Action Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.line}` }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "transparent",
            border: "none",
            color: t.a1,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            padding: 0
          }}
        >
          {expanded ? "Show Less" : "View Full Diagnostic (+1)"}
        </button>

        <button
          onClick={() => onOpenFocus ? onOpenFocus() : setTab("focus")}
          className="press"
          style={{
            background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
            color: t.onAccent,
            border: "none",
            borderRadius: 10,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: `0 4px 12px -3px ${t.a1}66`
          }}
        >
          <Zap size={14} /> Launch Deep Work
        </button>
      </div>
    </Card>
  );
}
