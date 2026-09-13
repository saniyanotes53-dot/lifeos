import EventBudget from './EventBudget';
import {normalizeTag} from '../assistant/event-tags';
import BudgetTools from './BudgetTools';
import { IconBtn } from "./primitives";
import { Modal } from "./primitives";
import React, { useState, useMemo } from "react";
import {
  Upload, TrendingUp, Flame, Wallet, CreditCard, Banknote, ArrowRight,
  Plus, Sparkles, PieChart as PieIcon, BarChart3, ChevronRight, X,
  ArrowUpRight, ArrowDownLeft, Sliders, Check, RefreshCw, AlertCircle
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import Papa from "papaparse";
import { parseLocalDate } from "../utils/dates";
import { monthlyTransactions } from "../utils/analytics";
import { inputStyle, todayStr, CAT_PALETTE } from "../theme";
import { Card, Screen, SectionLabel, StatChip, PrimaryButton, GhostButton, Empty } from "./primitives";
import { addItem, deleteItem, updateItem } from "../firestore";
import { HorizontalProgressBar } from "./ProgressBars";

export default function BudgetScreen({ t, tx = [], userId, wallets = [], categoryBudgets = [], loans = [], subscriptions = [], billSplits = [], onAskAssistant }) {
  // Navigation view within Budget
  const [subView, setSubView] = useState("overview"); // overview, transactions, wallets, budgets, borrowLend, subscriptions, splits
  const [menuOpen, setMenuOpen] = useState(false);

  // Form states
  const [showAddTx, setShowAddTx] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [eventTag,setEventTag]=useState("");
  const [txDate,setTxDate]=useState(todayStr());
  const [txError,setTxError]=useState("");
  const [txBusy,setTxBusy]=useState(false);
  const [type, setType] = useState("expense");
  const [selectedWallet, setSelectedWallet] = useState("");

  // AI Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [statementText, setStatementText] = useState("");
  const [importStatus, setImportStatus] = useState("");

  // AI Insights State
  const [aiInsights, setAiInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Wallet Management State
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [walletName, setWalletName] = useState("");
  const [walletType, setWalletType] = useState("Bank");
  const [walletInitialBalance, setWalletInitialBalance] = useState("");

  // Category Budget State
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [budgetCat, setBudgetCat] = useState("Food");
  const [budgetLimit, setBudgetLimit] = useState("");

  // Borrow/Lend State
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [loanPerson, setLoanPerson] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanType, setLoanType] = useState("lend"); // "lend" (owed to me) or "borrow" (I owe)
  const [loanDueDate, setLoanDueDate] = useState("");

  const CATS = ["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Income", "Other"];

  const activeWallets = wallets;

  // Calculations
  const currentDay = todayStr();
  const currentMonthStr = currentDay.slice(0, 7); // "YYYY-MM"
  const thisMonthTx = tx.filter(x => (x.date || "").startsWith(currentMonthStr) && x.date <= todayStr());
  const thisMonthSpent = thisMonthTx.filter(x => x.type === "expense").reduce((s, x) => s + Number(x.amount || 0), 0);
  const thisMonthIncome = thisMonthTx.filter(x => x.type === "income").reduce((s, x) => s + Number(x.amount || 0), 0);
  const totalBalance = activeWallets.reduce((s, w) => s + Number(w.balance || 0), 0);

  // Category Breakdown for current month
  const byCat = useMemo(() => {
    const m = {};
    thisMonthTx.filter(x => x.type === "expense").forEach(x => {
      m[x.category] = (m[x.category] || 0) + Number(x.amount || 0);
    });
    return Object.entries(m).map(([name, value], i) => ({
      name, value, colorKey: CAT_PALETTE[i % CAT_PALETTE.length]
    }));
  }, [thisMonthTx]);

  // Last 6 Months Trend
  const last6MonthsData = useMemo(() => monthlyTransactions(tx, currentDay), [tx, currentDay]);

  // Handlers
  const handleAddTx = async () => {
    if(txBusy)return;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || !parseLocalDate(txDate)) {setTxError("Enter a positive amount and a valid date.");return;}
    setTxBusy(true);setTxError("");
    try{
    const tag=normalizeTag(eventTag);
    await addItem(userId, "transactions", {
      date: txDate,
      eventTag:tag,
      amount: Number(amount),
      category: type === "income" ? "Income" : category,
      note: note.trim(),
      type,
      wallet: selectedWallet || "Unassigned"
    });
    setAmount("");
    setNote("");
    setShowAddTx(false);setEventTag("");
    }catch(e){setTxError(e.message);}finally{setTxBusy(false);}
  };

  const handleAddWallet = async () => {
    if (!walletName.trim()) return;
    await addItem(userId, "wallets", {
      name: walletName.trim(),
      type: walletType,
      balance: Number(walletInitialBalance) || 0,
      createdAt: todayStr()
    });
    setWalletName("");
    setWalletInitialBalance("");
    setShowAddWallet(false);
  };

  const handleAddBudget = async () => {
    if (!Number.isFinite(Number(budgetLimit)) || Number(budgetLimit) <= 0) return;
    await addItem(userId, "categoryBudgets", {
      category: budgetCat,
      limit: Number(budgetLimit),
      month: currentMonthStr
    });
    setBudgetLimit("");
    setShowAddBudget(false);
  };

  const handleAddLoan = async () => {
    if (!loanPerson.trim() || !loanAmount) return;
    await addItem(userId, "loans", {
      person: loanPerson.trim(),
      amount: Number(loanAmount),
      type: loanType,
      dueDate: loanDueDate || todayStr(),
      settled: false,
      createdAt: todayStr()
    });
    setLoanPerson("");
    setLoanAmount("");
    setShowAddLoan(false);
  };

  // AI / Statement Parser (supports text statements or uploaded CSV)
  const handleParseStatement = async () => {
    if (!statementText.trim()) return;
    setImportStatus("Parsing statement lines...");
    const lines = statementText.split("\n").filter(l => l.trim().length > 0);
    const parsed = [];

    lines.forEach(line => {
      // Regex search for amount (e.g. Rs. 450, INR 1200, 500.00, etc.)
      const amountMatch = line.match(/(?:rs\.?|inr|₹)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
      if (amountMatch) {
        const rawAmt = Number(amountMatch[1].replace(/,/g, ""));
        if (rawAmt > 0) {
          const isIncome = /(credit|received|refund|deposited|salary)/i.test(line);
          let cat = "Other";
          if (/(swiggy|zomato|restaurant|food|grocer|cafe)/i.test(line)) cat = "Food";
          else if (/(uber|ola|fuel|petrol|metro|flight)/i.test(line)) cat = "Transport";
          else if (/(amazon|flipkart|myntra|store|shopping)/i.test(line)) cat = "Shopping";
          else if (/(bill|electricity|wifi|recharge|rent)/i.test(line)) cat = "Bills";

          const dateMatch = line.match(/\b\d{4}-\d{2}-\d{2}\b/);
          if (dateMatch && !parseLocalDate(dateMatch[0])) return;
          parsed.push({
            date: dateMatch ? dateMatch[0] : todayStr(),
            amount: rawAmt,
            category: isIncome ? "Income" : cat,
            note: line.slice(0, 40).trim(),
            type: isIncome ? "income" : "expense",
            wallet: "Unassigned"
          });
        }
      }
    });

    if (parsed.length > 0) {
      for (const item of parsed) {
        await addItem(userId, "transactions", item);
      }
      setImportStatus(`Successfully imported ${parsed.length} transactions!`);
      setTimeout(() => {
        setImportStatus("");
        setStatementText("");
        setShowImportModal(false);
      }, 1400);
    } else {
      setImportStatus("No valid transactions found. Include ₹, Rs. or INR before each amount. Dates, when supplied, must use YYYY-MM-DD.");
    }
  };

  const handleCsvFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (res) => {
        const rows = res.data.map(r => ({
          date: r.date || r.Date || todayStr(),
          amount: Math.abs(Number(String(r.amount || r.Amount || 0).replace(/,/g, ""))),
          category: r.category || r.Category || "Other",
          note: r.note || r.Note || r.description || r.Description || "",
          type: (Number(r.amount || r.Amount || 0)) < 0 ? "expense" : (r.type || "expense"),
          wallet: "Unassigned"
        })).filter(r => Number.isFinite(r.amount) && r.amount > 0 && parseLocalDate(r.date));

        for (const row of rows) {
          await addItem(userId, "transactions", row);
        }
        setShowImportModal(false);
      }
    });
  };

  const generateAiInsights = () => onAskAssistant?.('Analyze my recorded spending this month, explain patterns, and suggest realistic category budgets. Do not change anything yet.');

  return (
    <Screen t={t} title="Budget & Wealth" right={<GhostButton t={t} onClick={generateAiInsights}><Sparkles size={16}/> Ask Gemini</GhostButton>}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>

        {/* Secondary Sub-navigation matching Hisaabat */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ maxWidth: "100%", display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {[
              ["overview", "Overview"],
              ["transactions", "Transactions"],
              ["events", "Event tags"],
              ["wallets", "Wallets"],
              ["budgets", "Budgets"],
              ["borrowLend", "Borrow / Lend"], ["subscriptions", "Subscriptions"], ["splits", "Bill splits"]
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSubView(k)}
                className="press"
                style={{
                  padding: "6px 14px", borderRadius: 10, border: `1px solid ${subView === k ? t.a1 : t.line}`,
                  background: subView === k ? t.surface2 : "transparent",
                  color: subView === k ? t.a1 : t.text, fontSize: 13, fontWeight: 600, cursor: "pointer"
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* More Menu (Hisaabat Groupings) */}
          <button
            onClick={() => setMenuOpen(true)}
            className="press"
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
              borderRadius: 10, background: t.surface2, border: `1px solid ${t.line}`,
              color: t.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer"
            }}
          >
            <Sliders size={14} color={t.a1} /> More Features
          </button>
        </div>

        {/* ================= OVERVIEW VIEW ================= */}
        {subView === "overview" && (
          <div>
            {/* 1. WALLETS CARD AT TOP */}
            <Card t={t} style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, color: t.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Saved Wallet Balances
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: t.text, marginTop: 2 }}>
                    ₹{totalBalance.toLocaleString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setShowAddWallet(true)}
                    className="press"
                    style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                      borderRadius: 10, background: t.surface2, border: `1px solid ${t.line}`,
                      color: t.a1, fontSize: 12, fontWeight: 600, cursor: "pointer"
                    }}
                  >
                    <Plus size={13} /> Add Wallet
                  </button>
                  <button
                    onClick={() => setSubView("wallets")}
                    className="press"
                    style={{
                      display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
                      borderRadius: 10, background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
                      color: t.onAccent, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer"
                    }}
                  >
                    Manage
                  </button>
                </div>
              </div>

              <p style={{ fontSize: 14, color: t.muted }}>Manually entered balances; logged transactions do not adjust these automatically.</p>
              {activeWallets.length === 0 && <Empty t={t} text="No wallets saved. Add a wallet to record its balance." />}
              {/* Sub-cards per wallet */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
                {activeWallets.map(w => (
                  <div
                    key={w.id}
                    style={{
                      background: t.surface2, border: `1px solid ${t.line}`, borderRadius: 12,
                      padding: "12px 14px", display: "flex", alignItems: "center", gap: 12
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, background: `${t.a1}22`,
                      display: "flex", alignItems: "center", justifyContent: "center", color: t.a1
                    }}>
                      {w.type === "Cash" ? <Banknote size={18} /> : <CreditCard size={18} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{w.name}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t.a1, marginTop: 1 }}>
                        ₹{Number(w.balance || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 2. QUICK ACTIONS ROW */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <PrimaryButton
                t={t}
                onClick={() => setShowAddTx(true)}
                style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Plus size={16} /> Add Transaction
              </PrimaryButton>

              <button
                onClick={() => setShowImportModal(true)}
                className="press"
                style={{
                  flex: 1, minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 8, padding: "12px 16px", borderRadius: 12, background: t.surface,
                  border: `1px solid ${t.a1}`, color: t.a1, fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                <Sparkles size={16} /> Statement / CSV Import
              </button>
            </div>

            {/* 3. THIS MONTH SUMMARY & 6-MONTH TREND */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14, marginBottom: 16 }}>
              {/* This Month Card */}
              <Card t={t} style={{ padding: 18 }}>
                <div style={{ fontSize: 12, color: t.muted, textTransform: "uppercase" }}>This Month's Spending</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: t.text, margin: "6px 0 14px" }}>
                  ₹{thisMonthSpent.toLocaleString()}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${t.line}` }}>
                  <div>
                    <div style={{ fontSize: 11, color: t.muted }}>Total Income</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.good, marginTop: 2 }}>
                      +₹{thisMonthIncome.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: t.muted }}>Net Savings</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: thisMonthIncome >= thisMonthSpent ? t.good : t.warm, marginTop: 2 }}>
                      ₹{(thisMonthIncome - thisMonthSpent).toLocaleString()}
                    </div>
                  </div>
                </div>
              </Card>

              {/* 6-Month Trend */}
              <Card t={t} style={{ padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Last 6 Months Trend</div>
                <div style={{ height: 110 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={last6MonthsData}>
                      <CartesianGrid stroke={t.line} vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: t.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip contentStyle={{ background: t.surface2, border: `1px solid ${t.line}`, borderRadius: 8, fontSize: 12, color: t.text }} />
                      <Bar dataKey="spent" name="Spent" fill={t.a1} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* 4. SPENDING BY CATEGORY (DONUT CHART) */}
            <Card t={t} style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 12 }}>
                Spending by Category (This Month)
              </div>
              {byCat.length === 0 ? (
                <Empty t={t} text="No expenses yet this month. Add a transaction to view category insights." />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                  <div style={{ width: 130, height: 130 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60} paddingAngle={3}>
                          {byCat.map((e, i) => <Cell key={i} fill={t[e.colorKey]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, minWidth: 200, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {byCat.map(c => (
                      <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                        <div style={{ width: 9, height: 9, borderRadius: 4, background: t[c.colorKey] }} />
                        <span style={{ color: t.text, flex: 1 }}>{c.name}</span>
                        <span style={{ fontWeight: 600, color: t.muted }}>₹{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* 5. AI INSIGHTS CARD */}
            <Card t={t} style={{ padding: 18, marginBottom: 16, borderColor: `${t.a1}44` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: t.text }}>
                  <Sparkles size={16} color={t.a1} /> Spending Summary
                </div>
                <button
                  onClick={generateAiInsights}
                  disabled={insightsLoading}
                  className="press"
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
                    borderRadius: 8, background: t.surface2, border: `1px solid ${t.line}`,
                    color: t.a1, fontSize: 11.5, fontWeight: 600, cursor: "pointer"
                  }}
                >
                  <RefreshCw size={12} className={insightsLoading ? "pulse" : ""} />
                  {insightsLoading ? "Analyzing..." : "Generate Summary"}
                </button>
              </div>

              {aiInsights ? (
                <div>
                  <div style={{ fontSize: 13, color: t.text, marginBottom: 6, lineHeight: 1.5 }}>
                    {aiInsights.summary} {aiInsights.categoryCreep}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: t.a1, marginBottom: 4 }}>Recommendations:</div>
                    {aiInsights.suggestions.map((sug, i) => (
                      <div key={i} style={{ fontSize: 12, color: t.muted, display: "flex", gap: 6, marginBottom: 3 }}>
                        <span>•</span> <span>{sug}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: t.muted }}>
                  Summarize the transactions you have logged this month.
                </div>
              )}
            </Card>

            {/* 6. RECENT TRANSACTIONS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 2px 8px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Recent Transactions</div>
              <button type="button" onClick={() => setSubView("transactions")} style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },  fontSize: 12, color: t.a1, cursor: "pointer", fontWeight: 600 }}>
                View all ({tx.length}) →
              </button>
            </div>

            {tx.length === 0 && <Empty t={t} text="No transactions logged yet." />}
            {[...tx].sort((a,b)=>(b.date||" ").localeCompare(a.date||" ")).slice(0, 6).map(x => (
              <Card t={t} key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, background: x.type === "income" ? `${t.good}22` : `${t.a1}22`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: x.type === "income" ? t.good : t.a1
                  }}>
                    {x.type === "income" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>{x.note || x.category}</div>
                    <div style={{ fontSize: 11, color: t.muted }}>{x.category} · {x.date} · {x.wallet || "Bank"}</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, color: x.type === "income" ? t.good : t.text, fontWeight: 700 }}>
                  {x.type === "income" ? "+" : "-"}₹{Number(x.amount || 0).toLocaleString()}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ================= TRANSACTIONS FULL VIEW ================= */}
        {subView === "events" && <EventBudget t={t} tx={tx} userId={userId} onAskAssistant={onAskAssistant}/>}
        {subView === "transactions" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>All Transactions</h2>
              <PrimaryButton t={t} onClick={() => setShowAddTx(true)} style={{ width: "auto", padding: "8px 16px" }}>
                + Add Transaction
              </PrimaryButton>
            </div>

            {tx.length === 0 && <Empty t={t} text="No transactions recorded." />}
            {[...tx].sort((a,b)=>(b.date||" ").localeCompare(a.date||" ")).map(x => (
              <Card t={t} key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{x.note || x.category}</div>
                  <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>
                    {x.category} · {x.date} · Wallet: {x.wallet || "Bank"} {x.eventTag?`· #${x.eventTag}`:""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ fontSize: 14.5, color: x.type === "income" ? t.good : t.text, fontWeight: 700 }}>
                    {x.type === "income" ? "+" : "-"}₹{Number(x.amount || 0).toLocaleString()}
                  </div>
                  <IconBtn t={t} label="Delete entry" onClick={() => deleteItem(userId, "transactions", x.id)}><X size={15} color={t.muted} style={{ cursor: "pointer" }}  /></IconBtn>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ================= WALLETS MANAGER VIEW ================= */}
        {subView === "wallets" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>Wallets & Accounts</h2>
              <PrimaryButton t={t} onClick={() => setShowAddWallet(true)} style={{ width: "auto", padding: "8px 16px" }}>
                + Add Wallet
              </PrimaryButton>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 12 }}>
              {activeWallets.map(w => (
                <Card t={t} key={w.id} style={{ padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, background: `${t.a1}22`,
                      display: "flex", alignItems: "center", justifyContent: "center", color: t.a1
                    }}>
                      {w.type === "Cash" ? <Banknote size={20} /> : <CreditCard size={20} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{w.name}</div>
                      <div style={{ fontSize: 11.5, color: t.muted }}>{w.type} Wallet</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: t.a1 }}>
                    ₹{Number(w.balance || 0).toLocaleString()}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ================= BUDGETS VIEW ================= */}
        {subView === "budgets" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>Category Budgets</h2>
                <div style={{ fontSize: 12, color: t.muted }}>Set spending targets per category to control outflow</div>
              </div>
              <PrimaryButton t={t} onClick={() => setShowAddBudget(true)} style={{ width: "auto", padding: "8px 16px" }}>
                + Set Budget
              </PrimaryButton>
            </div>

            {categoryBudgets.length === 0 ? (
              <Empty t={t} text="No category budgets set for this month. Click '+ Set Budget' to get started." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {categoryBudgets.map(b => {
                  const spentInCat = thisMonthTx
                    .filter(x => x.type === "expense" && x.category === b.category)
                    .reduce((s, x) => s + Number(x.amount || 0), 0);

                  return (
                    <Card t={t} key={b.id} style={{ padding: 16 }}>
                      <HorizontalProgressBar
                        t={t}
                        label={b.category}
                        value={spentInCat}
                        max={b.limit}
                        unit="₹"
                        color={spentInCat > b.limit ? t.warm : t.a1}
                        sublabel={`Limit: ₹${b.limit.toLocaleString()} · ${spentInCat > b.limit ? "Over budget!" : `₹${b.limit - spentInCat} remaining`}`}
                      />
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= BORROW / LEND VIEW ================= */}
        {subView === "borrowLend" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>Borrow & Lend Tracker</h2>
                <div style={{ fontSize: 12, color: t.muted }}>Keep track of debt & money owed by/to contacts</div>
              </div>
              <PrimaryButton t={t} onClick={() => setShowAddLoan(true)} style={{ width: "auto", padding: "8px 16px" }}>
                + Add Record
              </PrimaryButton>
            </div>

            {loans.length === 0 ? (
              <Empty t={t} text="No debt or credit records found. Add one to track money lent or borrowed." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {loans.map(ln => (
                  <Card t={t} key={ln.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{ln.person}</div>
                      <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>
                        {ln.type === "lend" ? "Owed to you" : "You owe"} · Due: {ln.dueDate || "N/A"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: ln.type === "lend" ? t.good : t.warm }}>
                        {ln.type === "lend" ? "+" : "-"}₹{Number(ln.amount || 0).toLocaleString()}
                      </div>
                      <IconBtn t={t} label="Delete entry" onClick={() => deleteItem(userId, "loans", ln.id)}><X size={15} color={t.muted} style={{ cursor: "pointer" }}  /></IconBtn>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {['subscriptions','splits'].includes(subView)&&<BudgetTools key={subView} t={t} userId={userId} mode={subView} subscriptions={subscriptions} billSplits={billSplits} onAskAssistant={onAskAssistant}/>}

        {/* ================= MODALS ================= */}

        {/* ADD TRANSACTION MODAL */}
        {showAddTx && (
          <Modal title="Add transaction" onClose={() => setShowAddTx(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          }}>
            <Card t={t} style={{ width: "100%", maxWidth: 440, padding: 22, background: t.surface }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>Add Transaction</h3>
                <IconBtn t={t} label="Close dialog" onClick={() => setShowAddTx(false)}><X size={18} color={t.muted} style={{ cursor: "pointer" }}  /></IconBtn>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  onClick={() => setType("expense")}
                  className="press"
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${type === "expense" ? t.a1 : t.line}`,
                    background: type === "expense" ? t.surface2 : "transparent", color: type === "expense" ? t.a1 : t.muted,
                    fontSize: 13, fontWeight: 600, cursor: "pointer"
                  }}
                >
                  Expense
                </button>
                <button
                  onClick={() => setType("income")}
                  className="press"
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${type === "income" ? t.good : t.line}`,
                    background: type === "income" ? t.surface2 : "transparent", color: type === "income" ? t.good : t.muted,
                    fontSize: 13, fontWeight: 600, cursor: "pointer"
                  }}
                >
                  Income
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input aria-label="Transaction amount"
                  style={{ ...inputStyle(t), width: 120 }}
                  placeholder="₹ Amount"
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
                {type === "expense" ? (
                  <select aria-label="Transaction category" style={{ ...inputStyle(t), flex: 1 }} value={category} onChange={e => setCategory(e.target.value)}>
                    {CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                ) : (
                  <input style={{ ...inputStyle(t), flex: 1 }} disabled value="Income" />
                )}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: t.muted, marginBottom: 4 }}>Wallet / Account</div>
                <select aria-label="Wallet or account" style={inputStyle(t)} value={selectedWallet} onChange={e => setSelectedWallet(e.target.value)}>
                  <option value="">Unassigned</option>
                  {activeWallets.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}
                </select>
              </div>

              <input aria-label="Transaction note"
                style={{ ...inputStyle(t), marginBottom: 16 }}
                placeholder="Note (optional, e.g. Lunch, Grocery)"
                value={note}
                onChange={e => setNote(e.target.value)}
              />

              <label style={{display:'block',marginBottom:10}}>Date<input aria-label="Transaction date" type="date" value={txDate} onChange={e=>setTxDate(e.target.value)} style={inputStyle(t)}/></label>
              <label style={{display:'block',marginBottom:10}}>Event tag (optional)<input aria-label="Transaction event tag" placeholder="#summer-vacation" maxLength={60} value={eventTag} onChange={e=>setEventTag(e.target.value)} style={inputStyle(t)} list="transaction-event-tags"/></label>
              <datalist id="transaction-event-tags">{[...new Set(tx.map(x=>x.eventTag).filter(Boolean))].map(tag=><option key={tag} value={tag}/>)}</datalist>
              {txError&&<p role="alert">{txError}</p>}
              <PrimaryButton t={t} disabled={txBusy} onClick={handleAddTx}>{txBusy?'Saving…':'Save Transaction'}</PrimaryButton>
            </Card>
          </Modal>
        )}

        {/* AI STATEMENT / CSV IMPORT MODAL */}
        {showImportModal && (
          <Modal title="Statement and CSV import" onClose={() => setShowImportModal(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          }}>
            <Card t={t} style={{ width: "100%", maxWidth: 520, padding: 22, background: t.surface }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: t.text }}>
                  <Sparkles size={18} color={t.a1} /> Statement & CSV Import
                </div>
                <IconBtn t={t} label="Close dialog" onClick={() => setShowImportModal(false)}><X size={18} color={t.muted} style={{ cursor: "pointer" }}  /></IconBtn>
              </div>

              <div style={{ fontSize: 12.5, color: t.muted, marginBottom: 14 }}>
                Paste transaction SMS, UPI notification texts, or bank statement lines below. Text is processed in your browser. Include ₹, Rs. or INR before amounts and YYYY-MM-DD dates; missing dates use today. This does not connect to Google Pay. Clicking Import saves the detected transactions.
              </div>

              <textarea aria-label="Transaction text"
                style={{ ...inputStyle(t), height: 120, resize: "vertical", marginBottom: 10 }}
                placeholder={`Paste lines like:\nPaid Rs. 450 to Swiggy\nReceived INR 15,000 from Client via UPI\nUber ride ₹340 on 2026-09-08`}
                value={statementText}
                onChange={e => setStatementText(e.target.value)}
              />

              {importStatus && (
                <div style={{ fontSize: 12, color: importStatus.includes("Success") ? t.good : t.a1, marginBottom: 10 }}>
                  {importStatus}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <PrimaryButton t={t} onClick={handleParseStatement} style={{ flex: 1 }}>
                  Import transaction text
                </PrimaryButton>
                <label
                  className="press"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px 14px", borderRadius: 12, border: `1px solid ${t.line}`,
                    background: t.surface2, color: t.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer"
                  }}
                >
                  <Upload size={14} /> Upload CSV
                  <input aria-label="Upload transaction CSV" type="file" accept=".csv" hidden onChange={handleCsvFile} />
                </label>
              </div>
            </Card>
          </Modal>
        )}

        {/* ADD WALLET MODAL */}
        {showAddWallet && (
          <Modal title="Add wallet" onClose={() => setShowAddWallet(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          }}>
            <Card t={t} style={{ width: "100%", maxWidth: 400, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>Add New Wallet</h3>
                <IconBtn t={t} label="Close dialog" onClick={() => setShowAddWallet(false)}><X size={18} color={t.muted} style={{ cursor: "pointer" }}  /></IconBtn>
              </div>
              <input aria-label="Wallet name"
                style={{ ...inputStyle(t), marginBottom: 10 }}
                placeholder="Wallet Name (e.g. HDFC Bank, Secret Stash)"
                value={walletName}
                onChange={e => setWalletName(e.target.value)}
              />
              <select aria-label="Wallet type" style={{ ...inputStyle(t), marginBottom: 10 }} value={walletType} onChange={e => setWalletType(e.target.value)}>
                <option value="Bank">Bank Account</option>
                <option value="Cash">Cash Wallet</option>
                <option value="Savings">Savings</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Investment">Investment</option>
              </select>
              <input aria-label="Wallet balance"
                style={{ ...inputStyle(t), marginBottom: 16 }}
                placeholder="Starting Balance (₹)"
                type="number"
                value={walletInitialBalance}
                onChange={e => setWalletInitialBalance(e.target.value)}
              />
              <PrimaryButton t={t} onClick={handleAddWallet}>Save Wallet</PrimaryButton>
            </Card>
          </Modal>
        )}

        {/* ADD BUDGET MODAL */}
        {showAddBudget && (
          <Modal title="Set category budget" onClose={() => setShowAddBudget(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          }}>
            <Card t={t} style={{ width: "100%", maxWidth: 380, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>Set Monthly Budget</h3>
                <IconBtn t={t} label="Close dialog" onClick={() => setShowAddBudget(false)}><X size={18} color={t.muted} style={{ cursor: "pointer" }}  /></IconBtn>
              </div>
              <select aria-label="Budget category" style={{ ...inputStyle(t), marginBottom: 10 }} value={budgetCat} onChange={e => setBudgetCat(e.target.value)}>
                {CATS.filter(c => c !== "Income").map(c => <option key={c}>{c}</option>)}
              </select>
              <input aria-label="Budget limit"
                style={{ ...inputStyle(t), marginBottom: 16 }}
                placeholder="Monthly Limit (₹)"
                type="number"
                value={budgetLimit}
                onChange={e => setBudgetLimit(e.target.value)}
              />
              <PrimaryButton t={t} onClick={handleAddBudget}>Set Budget</PrimaryButton>
            </Card>
          </Modal>
        )}

        {/* ADD BORROW/LEND MODAL */}
        {showAddLoan && (
          <Modal title="Borrow or lend" onClose={() => setShowAddLoan(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          }}>
            <Card t={t} style={{ width: "100%", maxWidth: 400, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>Track Borrow / Lend</h3>
                <IconBtn t={t} label="Close dialog" onClick={() => setShowAddLoan(false)}><X size={18} color={t.muted} style={{ cursor: "pointer" }}  /></IconBtn>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button
                  onClick={() => setLoanType("lend")}
                  className="press"
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${loanType === "lend" ? t.good : t.line}`,
                    background: loanType === "lend" ? t.surface2 : "transparent", color: loanType === "lend" ? t.good : t.muted,
                    fontSize: 12.5, fontWeight: 600, cursor: "pointer"
                  }}
                >
                  I Lent (They owe me)
                </button>
                <button
                  onClick={() => setLoanType("borrow")}
                  className="press"
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${loanType === "borrow" ? t.warm : t.line}`,
                    background: loanType === "borrow" ? t.surface2 : "transparent", color: loanType === "borrow" ? t.warm : t.muted,
                    fontSize: 12.5, fontWeight: 600, cursor: "pointer"
                  }}
                >
                  I Borrowed (I owe)
                </button>
              </div>
              <input aria-label="Person"
                style={{ ...inputStyle(t), marginBottom: 10 }}
                placeholder="Person's Name"
                value={loanPerson}
                onChange={e => setLoanPerson(e.target.value)}
              />
              <input aria-label="Loan amount"
                style={{ ...inputStyle(t), marginBottom: 10 }}
                placeholder="Amount (₹)"
                type="number"
                value={loanAmount}
                onChange={e => setLoanAmount(e.target.value)}
              />
              <input aria-label="Due date"
                style={{ ...inputStyle(t), marginBottom: 16 }}
                type="date"
                value={loanDueDate}
                onChange={e => setLoanDueDate(e.target.value)}
              />
              <PrimaryButton t={t} onClick={handleAddLoan}>Save Record</PrimaryButton>
            </Card>
          </Modal>
        )}

        {/* HISAABAT GROUPED MENU MODAL */}
        {menuOpen && (
          <Modal title="Budget features" onClose={() => setMenuOpen(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          }}>
            <Card t={t} style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: 0 }}>Budget & Wealth Features</h3>
                <IconBtn t={t} label="Close dialog" onClick={() => setMenuOpen(false)}><X size={18} color={t.muted} style={{ cursor: "pointer" }}  /></IconBtn>
              </div>

              {/* Group 1: Money */}
              <div style={{ fontSize: 11, fontWeight: 700, color: t.a1, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Money
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                <button type="button" onClick={() => { setSubView("transactions"); setMenuOpen(false); }} className="press card-hover" style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },  padding: 10, background: t.surface2, borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", color: t.text, fontSize: 13 }}>
                  <span>Transactions Ledger</span> <ArrowRight size={14} color={t.muted} />
                </button>
                <button type="button" onClick={() => { setSubView("wallets"); setMenuOpen(false); }} className="press card-hover" style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },  padding: 10, background: t.surface2, borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", color: t.text, fontSize: 13 }}>
                  <span>Wallets & Accounts</span> <ArrowRight size={14} color={t.muted} />
                </button>
              </div>

              {/* Group 2: Insights */}
              <div style={{ fontSize: 11, fontWeight: 700, color: t.a1, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Insights
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                <button type="button" onClick={() => { setSubView("overview"); setMenuOpen(false); generateAiInsights(); }} className="press card-hover" style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },  padding: 10, background: t.surface2, borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", color: t.text, fontSize: 13 }}>
                  <span>Spending Summary</span> <Sparkles size={14} color={t.a1} />
                </button>
                <button type="button" onClick={() => { onAskAssistant?.('Help me decide whether I can afford a purchase. Ask me what I want to buy and its price, then use my recorded budget.'); setMenuOpen(false); }} className="press card-hover" style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },  padding: 10, background: t.surface2, borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", color: t.text, fontSize: 13 }}>
                  <span>Purchase Advisor</span> <span style={{ fontSize: 10, color: t.muted, background: t.surface, padding: "2px 6px", borderRadius: 4 }}>Open</span>
                </button>
              </div>

              {/* Group 3: Planning */}
              <div style={{ fontSize: 11, fontWeight: 700, color: t.a1, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Planning
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                <button type="button" onClick={() => { setSubView("budgets"); setMenuOpen(false); }} className="press card-hover" style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },  padding: 10, background: t.surface2, borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", color: t.text, fontSize: 13 }}>
                  <span>Category Budgets & Targets</span> <ArrowRight size={14} color={t.muted} />
                </button>
                <button type="button" onClick={() => { setSubView("subscriptions"); setMenuOpen(false); }} className="press card-hover" style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },  padding: 10, background: t.surface2, borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", color: t.text, fontSize: 13 }}>
                  <span>Recurring Subscriptions</span> <span style={{ fontSize: 10, color: t.muted, background: t.surface, padding: "2px 6px", borderRadius: 4 }}>Open</span>
                </button>
              </div>

              {/* Group 4: Data & Setup */}
              <div style={{ fontSize: 11, fontWeight: 700, color: t.a1, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Data & Debt
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button type="button" onClick={() => { setSubView("borrowLend"); setMenuOpen(false); }} className="press card-hover" style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },  padding: 10, background: t.surface2, borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", color: t.text, fontSize: 13 }}>
                  <span>Borrow & Lend (Debt Tracker)</span> <ArrowRight size={14} color={t.muted} />
                </button>
                <button type="button" onClick={() => { setSubView("splits"); setMenuOpen(false); }} className="press card-hover" style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },  padding: 10, background: t.surface2, borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", color: t.text, fontSize: 13 }}>
                  <span>Bill Splits with Friends</span> <span style={{ fontSize: 10, color: t.muted, background: t.surface, padding: "2px 6px", borderRadius: 4 }}>Open</span>
                </button>
              </div>
            </Card>
          </Modal>
        )}

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11.5, color: t.muted, opacity: 0.85, paddingBottom: 16 }}>
          This website is designed by <strong style={{ color: t.a1, fontWeight: 700 }}>Buraq Studios</strong> · Copyright all rights reserved.
        </div>
      </div>
    </Screen>
  );
}
