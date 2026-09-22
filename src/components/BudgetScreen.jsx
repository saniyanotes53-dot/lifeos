import React, {useState, useMemo, lazy, Suspense} from 'react';
import TransactionEditor, {DeleteTransaction} from './TransactionEditor';
import TransactionList, {TransactionRow} from './TransactionList';
const StatementImport=lazy(()=>import('./StatementImport'));
import EmailReminderToggle from './EmailReminderToggle';
import {validEmail} from '../assistant/budget-tools';
import EventBudget from './EventBudget';
import BudgetTools from './BudgetTools';
import { IconBtn } from "./primitives";
import { Modal } from "./primitives";
import {Upload, CreditCard, Banknote, Plus, Sparkles, X} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import { monthlyTransactions } from "../utils/analytics";
import { inputStyle, todayStr, CAT_PALETTE } from "../theme";
import { Card, Screen, PrimaryButton, GhostButton, Empty } from "./primitives";
import { addItem, deleteItem, updateItem } from "../firestore";
import { HorizontalProgressBar } from "./ProgressBars";

export default function BudgetScreen({ t, tx = [], userId, user, wallets = [], categoryBudgets = [], loans = [], subscriptions = [], billSplits = [], onAskAssistant }) {
  // Navigation view within Budget
  const [subView, setSubView] = useState("overview"); // overview, transactions, wallets, budgets, borrowLend, subscriptions, splits
  const [menuOpen, setMenuOpen] = useState(false);

  const [showAddTx,setShowAddTx]=useState(false),[editingTx,setEditingTx]=useState(null),[deletingTx,setDeletingTx]=useState(null);
  const [showImportModal,setShowImportModal]=useState(false),[notice,setNotice]=useState('');
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
  const [loanEmail,setLoanEmail]=useState(''),[loanError,setLoanError]=useState(''),[loanBusy,setLoanBusy]=useState(false);
  const [loanPerson, setLoanPerson] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanType, setLoanType] = useState("lend"); // "lend" (owed to me) or "borrow" (I owe)
  const [loanDueDate, setLoanDueDate] = useState("");

  const CATS = ["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Income", "Other"];

  const activeWallets = wallets;

  // Calculations
  const currentDay = todayStr();
  const currentMonthStr = currentDay.slice(0, 7); // "YYYY-MM"
  const thisMonthTx = useMemo(() => tx.filter(x => (x.date || "").startsWith(currentMonthStr) && x.date <= currentDay), [tx, currentMonthStr, currentDay]);
  const thisMonthSpent = thisMonthTx.filter(x => x.type === "expense").reduce((s, x) => s + Number(x.amount || 0), 0);
  const thisMonthIncome = thisMonthTx.filter(x => x.type === "income").reduce((s, x) => s + Number(x.amount || 0), 0);

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
    if(loanBusy)return;
    setLoanError('');
    if(!loanPerson.trim()||!Number.isFinite(Number(loanAmount))||Number(loanAmount)<=0){setLoanError('Enter a name and positive amount.');return;}
    if(loanEmail&&!validEmail(loanEmail)){setLoanError('Check the email address.');return;}
    setLoanBusy(true);try{
    await addItem(userId, "loans", {
      person: loanPerson.trim(),
      email: loanEmail.trim(),
      amount: Number(loanAmount),
      type: loanType,
      dueDate: loanDueDate || todayStr(),
      settled: false,
      createdAt: todayStr()
    });
    setLoanPerson("");
    setLoanAmount("");
    setShowAddLoan(false);setLoanEmail('');
    }catch(e){setLoanError(e.message);}finally{setLoanBusy(false);}
  };

  const generateAiInsights = () => onAskAssistant?.('Analyze my recorded spending this month, explain patterns, and suggest realistic category budgets. Do not change anything yet.');

  return (
    <Screen t={t} title="Budget" right={<GhostButton t={t} onClick={generateAiInsights}><Sparkles size={16}/> Ask Gemini</GhostButton>}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>

        <div className="budget-toolbar">
          <div style={{display:'flex',gap:8}}>{[['overview','Overview'],['transactions','Transactions']].map(([key,label])=><GhostButton key={key} t={t} aria-pressed={subView===key} style={{width:'auto',borderColor:subView===key?t.a1:t.line}} onClick={()=>setSubView(key)}>{label}</GhostButton>)}<GhostButton t={t} style={{width:'auto'}} onClick={()=>setMenuOpen(true)}>More</GhostButton></div>
          <div style={{display:'flex',gap:8}}><GhostButton t={t} onClick={()=>setShowImportModal(true)} style={{width:'auto'}}><Upload size={16}/> Import CSV / PDF</GhostButton><PrimaryButton t={t} onClick={()=>{setEditingTx(null);setShowAddTx(true);}} style={{width:'auto'}}><Plus size={16}/> Add transaction</PrimaryButton></div>
        </div>
        {notice&&<p role="status" style={{color:t.good}}>{notice} <button className="link-button" onClick={()=>setNotice('')}>Dismiss</button></p>}

        {/* ================= OVERVIEW VIEW ================= */}
        {subView === "overview" && (
          <div>
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

            {/* 6. RECENT TRANSACTIONS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 2px 8px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Recent Transactions</div>
              <button type="button" onClick={() => setSubView("transactions")} style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },  fontSize: 12, color: t.a1, cursor: "pointer", fontWeight: 600 }}>
                View all ({tx.length}) →
              </button>
            </div>

            {tx.length === 0 && <Empty t={t} text="No transactions logged yet." />}
            {[...tx].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,6).map(row=><TransactionRow key={row.id} t={t} row={row} onEdit={row=>{setEditingTx(row);setShowAddTx(true);}} onDelete={setDeletingTx}/>)}
          </div>
        )}

        {/* ================= TRANSACTIONS FULL VIEW ================= */}
        {subView === "events" && <EventBudget t={t} tx={tx} userId={userId} onAskAssistant={onAskAssistant}/>}
        {subView === 'transactions' && <TransactionList t={t} tx={tx} onEdit={row=>{setEditingTx(row);setShowAddTx(true);}} onDelete={setDeletingTx}/>}

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

            {categoryBudgets.filter(b=>!b.month||b.month===currentMonthStr).length === 0 ? (
              <Empty t={t} text="No category budgets set for this month. Click '+ Set Budget' to get started." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {categoryBudgets.filter(b=>!b.month||b.month===currentMonthStr).map(b => {
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

            {loanError&&<p role="alert">{loanError}</p>}{loans.length === 0 ? (
              <Empty t={t} text="No debt or credit records found. Add one to track money lent or borrowed." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {loans.map(ln => (
                  <Card t={t} key={ln.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{ln.person}</div>
                      <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>
                        {ln.type === "lend" ? "Owed to you" : "You owe"} · Due: {ln.dueDate || "N/A"}<p>{ln.email}</p><EmailReminderToggle userId={userId} collection="loans" record={ln}/>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: ln.type === "lend" ? t.good : t.warm }}>
                        {ln.settled?"Paid":`${ln.type === "lend" ? "+" : "-"}₹${Number(ln.amount || 0).toLocaleString()}`}
                      </div>
                      <button onClick={async()=>{try{await updateItem(userId,"loans",ln.id,{settled:!ln.settled});}catch(e){setLoanError(e.message);}}}>{ln.settled?"Reopen":"Mark paid"}</button><IconBtn t={t} label="Delete entry" onClick={() => deleteItem(userId, "loans", ln.id)}><X size={15} color={t.muted} style={{ cursor: "pointer" }}  /></IconBtn>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {['subscriptions','splits'].includes(subView)&&<BudgetTools key={subView} t={t} userId={userId} mode={subView} subscriptions={subscriptions} billSplits={billSplits} onAskAssistant={onAskAssistant}/>}

        {/* ================= MODALS ================= */}

        {showAddTx&&<TransactionEditor t={t} userId={userId} transaction={editingTx} wallets={wallets} onClose={()=>setShowAddTx(false)} onSaved={setNotice}/>}
        {deletingTx&&<DeleteTransaction t={t} userId={userId} transaction={deletingTx} onClose={()=>setDeletingTx(null)} onDeleted={setNotice}/>}
        {showImportModal&&<Suspense fallback={<p role="status">Opening statement import…</p>}><StatementImport t={t} user={user} tx={tx} wallets={wallets} onClose={()=>setShowImportModal(false)} onImported={message=>{setNotice(message);setSubView('transactions');}}/></Suspense>}

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
              <input aria-label="Contact email" type="email" placeholder="Contact email (optional)" value={loanEmail} onChange={e=>setLoanEmail(e.target.value)} style={inputStyle(t)}/>{loanError&&<p role="alert">{loanError}</p>}<PrimaryButton t={t} disabled={loanBusy} onClick={handleAddLoan}>Save Record</PrimaryButton>
            </Card>
          </Modal>
        )}

        {menuOpen&&<Modal title="More budget tools" onClose={()=>setMenuOpen(false)}><Card t={t} style={{width:'100%',maxWidth:440}}>
          <div className="dialog-heading"><h2>More budget tools</h2><IconBtn t={t} label="Close budget tools" onClick={()=>setMenuOpen(false)}>×</IconBtn></div>
          <div style={{display:'grid',gap:8}}>{[['budgets','Category budgets'],['events','Event tags'],['wallets','Wallets & accounts'],['borrowLend','Borrow & lend'],['splits','Bill splits'],['subscriptions','Subscriptions']].map(([key,label])=><GhostButton key={key} t={t} onClick={()=>{setSubView(key);setMenuOpen(false);}}>{label}</GhostButton>)}</div>
        </Card></Modal>}

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11.5, color: t.muted, opacity: 0.85, paddingBottom: 16 }}>
          This website is designed by <strong style={{ color: t.a1, fontWeight: 700 }}>Buraq Studios</strong> · Copyright all rights reserved.
        </div>
      </div>
    </Screen>
  );
}
