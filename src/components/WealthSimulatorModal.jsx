import { Modal } from "./primitives";
import React, { useState, useMemo } from "react";
import {
  DollarSign, TrendingUp, ShieldCheck, AlertTriangle, Sparkles, X, Sliders, ArrowUpRight
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { filterPeriod } from "../utils/analytics";
import { localDateKey } from "../utils/dates";
import { Card, PrimaryButton, GhostButton } from "./primitives";

export default function WealthSimulatorModal({
  isOpen,
  onClose,
  t,
  wallets = [],
  tx = []
}) {
  // Total liquid cash in user's wallets
  const totalLiquidCash = useMemo(() => {
    return wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0);
  }, [wallets]);

  const today = localDateKey();
  const recentExpenses = filterPeriod(tx, 30, today).filter(x => x.type === "expense");
  const dailyBurn = recentExpenses.reduce((sum, x) => sum + (Number(x.amount) || 0), 0) / 30;
  const runwayMonths = wallets.length && dailyBurn > 0 ? Number((Math.max(0, totalLiquidCash) / (dailyBurn * 30)).toFixed(1)) : null;

  // Simulation controls
  const [initialCapital, setInitialCapital] = useState(() => totalLiquidCash > 0 ? String(totalLiquidCash) : "100000");
  const [monthlyContribution, setMonthlyContribution] = useState("10000");
  const [expectedReturn, setExpectedReturn] = useState(12); // 12% per year
  const [years, setYears] = useState(5);

  // Projection series calculation
  const chartData = useMemo(() => {
    const p0 = parseFloat(initialCapital) || 0;
    const pM = parseFloat(monthlyContribution) || 0;
    const r = Math.pow(1 + expectedReturn / 100, 1 / 12) - 1; // effective monthly rate from CAGR

    const data = [];
    let currentTotal = p0;
    let totalInvested = p0;

    data.push({
      year: "Today",
      balance: Math.round(currentTotal),
      invested: Math.round(totalInvested),
      interest: 0
    });

    for (let yr = 1; yr <= years; yr++) {
      for (let m = 1; m <= 12; m++) {
        currentTotal = currentTotal * (1 + r) + pM; // contribution at month end
        totalInvested += pM;
      }
      data.push({
        year: `Yr ${yr}`,
        balance: Math.round(currentTotal),
        invested: Math.round(totalInvested),
        interest: Math.round(Math.max(0, currentTotal - totalInvested))
      });
    }

    return data;
  }, [initialCapital, monthlyContribution, expectedReturn, years]);

  const finalMetric = chartData[chartData.length - 1] || { balance: 0, interest: 0 };

  if (!isOpen) return null;

  return (
    <Modal title="Wealth projector" onClose={onClose}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="pop-in"
        style={{
          width: "100%",
          maxWidth: 680,
          background: t.surface,
          border: `1px solid ${t.line}`,
          borderRadius: 24,
          boxShadow: `0 24px 60px -12px rgba(0,0,0,0.5)`,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24
        }}
      >
        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: t.onAccent
            }}>
              <DollarSign size={22} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                Wealth Runway & 5-Year Compound Projector
                <span style={{ fontSize: 10.5, background: t.a1, color: t.onAccent, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                  PRO
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: t.muted }}>
                Simulate long-term financial independence and emergency reserves.
              </div>
            </div>
          </div>
          <button aria-label="Close dialog"
            onClick={onClose}
            style={{ background: t.surface2, border: `1px solid ${t.line}`, color: t.muted, borderRadius: 10, padding: 6, cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Emergency Runway Metric Card */}
        <div style={{
          background: runwayMonths >= 6 ? `${t.good}15` : `${t.a1}15`,
          border: `1px solid ${runwayMonths >= 6 ? t.good : t.a1}44`,
          borderRadius: 16,
          padding: "16px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20
        }}>
          <div>
            <div style={{ fontSize: 12, color: t.text, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              {runwayMonths >= 6 ? <ShieldCheck size={16} color={t.good} /> : <AlertTriangle size={16} color="#f59e0b" />}
              Runway from saved balances
            </div>
            <div style={{ fontSize: 11.5, color: t.muted, marginTop: 3 }}>
              Logged average: ₹{dailyBurn.toLocaleString("en-IN", { maximumFractionDigits: 2 })}/day over the past 30 days
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: runwayMonths >= 6 ? t.good : t.text }}>
              {runwayMonths === null ? "Not enough data" : `${runwayMonths} months`}
            </div>
            <div style={{ fontSize: 10.5, color: t.muted }}>
              {runwayMonths === null ? "Add wallet balances and expense records." : "An estimate from logged expenses, not a guarantee."}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 14, color: t.muted }}>Only saved balances and logged expenses are included; missing expenses can overstate runway. The projection below uses example inputs, assumes month-end contributions, and excludes fees and taxes.</p>
        {/* Controls Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
          <div>
            <label style={{ fontSize: 11.5, color: t.muted, fontWeight: 600, display: "block", marginBottom: 5 }}>
              Initial Investment (₹)
            </label>
            <input aria-label="Initial investment in rupees"
              type="number"
              value={initialCapital}
              onChange={e => setInitialCapital(e.target.value)}
              style={{
                width: "100%", background: t.surface2, border: `1px solid ${t.line}`,
                borderRadius: 10, padding: "9px 12px", color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box"
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11.5, color: t.muted, fontWeight: 600, display: "block", marginBottom: 5 }}>
              Monthly Contribution (₹)
            </label>
            <input aria-label="Monthly contribution in rupees"
              type="number"
              value={monthlyContribution}
              onChange={e => setMonthlyContribution(e.target.value)}
              style={{
                width: "100%", background: t.surface2, border: `1px solid ${t.line}`,
                borderRadius: 10, padding: "9px 12px", color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box"
              }}
            />
          </div>
        </div>

        {/* Sliders */}
        <div style={{ background: t.surface2, borderRadius: 14, padding: "14px 16px", border: `1px solid ${t.line}`, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: t.muted, fontWeight: 600 }}>Assumed annual return:</span>
            <span style={{ color: t.a1, fontWeight: 700 }}>{expectedReturn}% CAGR</span>
          </div>
          <input aria-label="Assumed annual return percentage"
            type="range"
            min="5"
            max="20"
            step="0.5"
            value={expectedReturn}
            onChange={e => setExpectedReturn(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: t.a1, cursor: "pointer", marginBottom: 12 }}
          />

          {/* Quick Presets */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              [7, "7% scenario"],
              [12, "12% scenario"],
              [15, "15% scenario"]
            ].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setExpectedReturn(val)}
                style={{
                  background: expectedReturn === val ? t.a1 : t.surface,
                  color: expectedReturn === val ? t.onAccent : t.muted,
                  border: `1px solid ${t.line}`,
                  borderRadius: 8,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Projection Chart */}
        <div style={{ height: 180, marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={t.a1} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={t.a1} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.line} vertical={false} />
              <XAxis dataKey="year" tick={{ fill: t.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: t.muted, fontSize: 10 }}
                tickFormatter={val => `₹${(val / 100000).toFixed(0)}L`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 8, fontSize: 12 }}
                formatter={(val) => [`₹${Number(val).toLocaleString()}`, "Net Worth"]}
              />
              <Area type="monotone" dataKey="balance" stroke={t.a1} strokeWidth={2.5} fillOpacity={1} fill="url(#wealthGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Result Summary Bar */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
          padding: "12px 16px", background: t.surface2, borderRadius: 14, border: `1px solid ${t.line}`
        }}>
          <div>
            <div style={{ fontSize: 11, color: t.muted }}>Projected Portfolio ({years} Yrs)</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: t.text }}>
              ₹{finalMetric.balance.toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: t.good, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
              <TrendingUp size={13} /> Wealth Multiplier
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, color: t.good }}>
              +₹{finalMetric.interest.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
