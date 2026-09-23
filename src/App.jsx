import BrandLogo from './components/BrandLogo';
import AuthExperience from './components/AuthExperience';
import EmailActionScreen from './components/EmailActionScreen';
import AssistantPanel from './components/AssistantPanel';
import {Modal,Card,IconBtn,Screen,GhostButton} from './components/primitives';
import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  HouseIcon as Home, ListChecksIcon as ListChecks, MoonIcon as Moon, WalletIcon as Wallet,
  ChartBarIcon as BarChart3, ClockIcon as Clock, UserCircleIcon as User, SignOutIcon as LogOut,
  SparkleIcon as Sparkles, SunIcon as Sun, SlidersHorizontalIcon as Settings,
  CaretRightIcon as ChevronRight, HeadphonesIcon as Headphones, MagnifyingGlassIcon as Search,
  CurrencyDollarIcon as DollarSign, MedalIcon as Award, LightningIcon as Zap,
  ChatCircleDotsIcon as MessageCircle, DotsThreeIcon as MoreHorizontal
} from "@phosphor-icons/react";
import { useLocalDay } from "./useLocalDay";
import { useT, PALETTES } from "./theme";
import { onAuthChange, logout } from "./auth";
import { ensureUserProfile, watchCollection, updateItem } from "./firestore";

import Dashboard from "./components/Dashboard";
import TasksScreen from "./components/TasksScreen";
const FocusStudio=lazy(()=>import("./components/FocusStudio"));
const HealthScreen=lazy(()=>import("./components/HealthScreen"));
const BudgetScreen=lazy(()=>import("./components/BudgetScreen"));
import TimetableScreen from "./components/TimetableScreen";
const ReportsScreen=lazy(()=>import("./components/ReportsScreen"));
import ProfileScreen from "./components/ProfileScreen";
import UserGuideModal from "./components/UserGuideModal";
import CommandPalette from "./components/CommandPalette";
import WealthSimulatorModal from "./components/WealthSimulatorModal";
import { ToastProvider } from "./components/Toast";
import AssistantScreen from "./components/AssistantScreen";
import ScreenErrorBoundary from "./components/ScreenErrorBoundary";
import { disableReminders, watchReminders } from "./notifications";
import CopyrightFooter from "./components/CopyrightFooter";

export default function App() {
  useLocalDay();
  const [assistantOpen,setAssistantOpen]=useState(false);
  const [assistantPrompt,setAssistantPrompt]=useState('');
  const askAssistant=(prompt='')=>{setAssistantPrompt(prompt);setAssistantOpen(true);};
  const [subscriptions,setSubscriptions]=useState([]),[billSplits,setBillSplits]=useState([]);
  const [pushNotice, setPushNotice] = useState("");
  const [dataErrors,setDataErrors]=useState({});
  useEffect(()=>{const handle=e=>setDataErrors(old=>({...old,[e.detail.collection]:e.detail.error}));window.addEventListener("lifeos-data-status",handle);return()=>window.removeEventListener("lifeos-data-status",handle);},[]);
  const [healthView, setHealthView] = useState("goals");
  // Theme state: scheme (blue, brown, peach) and mode (dark, light)
  const [scheme, setScheme] = useState(() => localStorage.getItem("lifeos_scheme") || "blue");
  const [theme, setTheme] = useState(() => localStorage.getItem("lifeos_theme") || "dark");
  const t = useT(theme, scheme);

  const [user, setUser] = useState(undefined); // undefined = checking, null = logged out, object = logged in
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get("view") === "timetable" ? "timetable" : "home"); // home, tasks, focus, health, budget, timetable, reports, profile
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Pro feature modal states
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isWealthSimulatorOpen, setIsWealthSimulatorOpen] = useState(false);
  const [targetFocusTaskId, setTargetFocusTaskId] = useState(null);

  // Firestore live collections state
  const [tasks, setTasks] = useState([]);
  const [sleep, setSleep] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [meals, setMeals] = useState([]);
  const [tx, setTx] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [categoryBudgets, setCategoryBudgets] = useState([]);
  const [loans, setLoans] = useState([]);
  const [bodyMetrics, setBodyMetrics] = useState([]);

  useEffect(() => watchReminders(user?.uid, blocks, tasks, setPushNotice), [user?.uid, blocks, tasks]);
  useEffect(() => { setPushNotice(""); setDataErrors({}); }, [user?.uid]);

  // Auth persistence listener
  useEffect(() => onAuthChange((firebaseUser) => {
    setUser(firebaseUser || null);
  }), []);

  // Global Keyboard Shortcuts (Ctrl+K or Cmd+K for Spotlight)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // First-time login guide trigger
  useEffect(() => {
    if (!user?.uid) return;
    ensureUserProfile(user).catch((error) => {
      console.error("Unable to create the Firestore user profile:", error);
    });
  }, [user]);

  const handleCloseGuide = () => {
    setShowGuideModal(false);
    if (user?.uid) {
      localStorage.setItem("lifeos_guide_seen_" + user.uid, "true");
    }
  };

  // Firestore subscriptions for active user
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const unsubs = [
      watchCollection(uid, "tasks", setTasks, "date"),
      watchCollection(uid, "sleep", setSleep, "date"),
      watchCollection(uid, "workouts", setWorkouts, "date"),
      watchCollection(uid, "meals", setMeals, "date"),
      watchCollection(uid, "transactions", setTx, "date"),
      watchCollection(uid, "timetable", setBlocks, "time"),
      watchCollection(uid, "wallets", setWallets),
      watchCollection(uid, "categoryBudgets", setCategoryBudgets),
      watchCollection(uid, "loans", setLoans),
      watchCollection(uid, "subscriptions", setSubscriptions),
      watchCollection(uid, "billSplits", setBillSplits),
      watchCollection(uid, "bodyMetrics", setBodyMetrics, "date")
    ];
    return () => unsubs.forEach(fn => fn && fn());
  }, [user]);

  const handleLogout = async () => {
    await disableReminders(user).catch(() => {});
    await logout();
    setAssistantOpen(false);setSubscriptions([]);setBillSplits([]);
    setTasks([]); setSleep([]); setWorkouts([]); setMeals([]);
    setTx([]); setBlocks([]); setWallets([]); setCategoryBudgets([]); setLoans([]); setBodyMetrics([]);
    setTab("home");
  };

  const assistantData={tasks,blocks,sleep,tx,workouts,wallets,categoryBudgets,subscriptions,billSplits,loans,dataErrors};
  const displayName = user ? (user.displayName || user.email?.split("@")[0] || "User") : "";

  const NAV = [
    ['home',Home,'Home'], ['tasks',ListChecks,'Tasks'], ['timetable',Clock,'Timetable'],
    ['budget',Wallet,'Budget'], ['assistant',MessageCircle,'Assistant'], ['more',MoreHorizontal,'More'],
  ];
  const MORE = [['timetable',Clock,'Timetable','Plan time blocks and reminders'],['health',Moon,'Health','Sleep, workouts and meals'],['reports',BarChart3,'Reports','Review progress and export'],['focus',Headphones,'Focus','Timer and focus sessions'],['profile',User,'Settings','Account, theme and notifications']];

  if(window.location.pathname === "/auth/action")return <EmailActionScreen t={t}/>;

  // Loading state
  if (user === undefined) {
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh",
        background: t.bg, color: t.muted, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div className="pulse" style={{ width: 48, height: 48, borderRadius: 16, background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 24px -6px ${t.a1}aa` }}>
            <Sparkles size={24} color={t.onAccent} />
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>Loading Life OS…</div>
        </div>
      </div>
    );
  }

  // Shared cinematic entry for login, registration and password recovery.
  if (!user || window.location.pathname === "/reset") {
    return <AuthExperience t={t} scheme={scheme} setScheme={setScheme}/>;
  }

  // Logged In: Full Desktop / Tablet / Mobile Website Layout wrapped in ToastProvider
  return (
    <ToastProvider t={t}>
      <div className="app-shell" style={{
        "--solid-surface": t.surface, "--focus-color": t.a1, "--glass-surface": t.glass, "--glass-edge": t.glassEdge, "--glass-shadow": t.glassShadow, "--glass-accent": t.a1 + "22", display: "flex", minHeight: "100vh", width: "100%", background: t.canvas,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: t.text, overflow: "hidden"
      }}>
        <style>{`
          input:focus, select:focus, textarea:focus { border-color: ${t.a1} !important; outline: none; }
          @media (max-width: 768px) {
            .desktop-sidebar { display: none !important; }
            .mobile-nav { display: flex !important; }
            .main-content { padding-bottom: 74px !important; }
          }
          @media (min-width: 769px) {
            .mobile-nav { display: none !important; }
          }
        `}</style>

        {assistantOpen&&<Modal title="Ask Gemini" onClose={()=>setAssistantOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:150,display:'flex',alignItems:'center',justifyContent:'center',padding:12}}><Card t={t} style={{width:'100%',maxWidth:720,maxHeight:'90vh',overflowY:'auto'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><strong>Gemini · {tab}</strong><IconBtn t={t} label="Close assistant" onClick={()=>setAssistantOpen(false)}>×</IconBtn></div><AssistantPanel key={user.uid} t={t} user={user} data={assistantData} page={tab} initialPrompt={assistantPrompt}/></Card></Modal>}
        {/* Global Command Palette Spotlight (Ctrl+K) */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          t={t}
          setTab={setTab}
          theme={theme}
          setTheme={setTheme}
          tasks={tasks}
          tx={tx}
          onOpenWealth={() => setIsWealthSimulatorOpen(true)}
          onOpenFocus={() => setTab("focus")}
        />

        {/* Wealth Runway & 5-Year Compound Growth Simulator Modal */}
        <WealthSimulatorModal
          isOpen={isWealthSimulatorOpen}
          onClose={() => setIsWealthSimulatorOpen(false)}
          t={t}
          wallets={wallets}
          tx={tx}
        />

        {/* First-time login guide modal */}
        <UserGuideModal
          t={t}
          isOpen={showGuideModal}
          onClose={handleCloseGuide}
        />

        {/* DESKTOP LEFT SIDEBAR */}
        <aside className="desktop-sidebar" style={{
          width: 260, background: t.surface, borderRight: `1px solid ${t.line}`,
          display: "flex", flexDirection: "column", flexShrink: 0, zIndex: 10
        }}>
          <div className="sidebar-brand"><BrandLogo scheme={scheme}/><span>PERSONAL OPERATING SYSTEM</span></div>

          {/* Quick Spotlight search button in sidebar */}
          <div style={{ padding: "14px 14px 6px" }}>
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="press"
              style={{
                width: "100%",
                background: t.surface2,
                border: `1px solid ${t.line}`,
                borderRadius: 12,
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: t.muted,
                fontSize: 12.5,
                cursor: "pointer",
                textAlign: "left"
              }}
            >
              <Search size={15} color={t.a1} />
              <span style={{ flex: 1, color: t.text, fontWeight: 500 }}>Spotlight…</span>
              <span className="header-shortcut" style={{ fontSize: 10, background: t.surface, border: `1px solid ${t.line}`, padding: "2px 5px", borderRadius: 6, color: t.muted, fontWeight: 600 }}>
                ⌘K
              </span>
            </button>
          </div>

          {/* Sidebar Nav Items */}
          <nav style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
            {NAV.map(([key, Icon, label, badge]) => {
              const isActive = tab === key || (key === "more" && ["health","reports","focus","profile"].includes(tab));
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="press"
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                    borderRadius: 12, border: "none",
                    background: isActive ? `linear-gradient(135deg, ${t.a1}22, ${t.a3}15)` : "transparent",
                    color: isActive ? t.a1 : t.muted, fontWeight: isActive ? 700 : 500,
                    fontSize: 13.5, cursor: "pointer", textAlign: "left", width: "100%",
                    transition: "background 0.15s ease, color 0.15s ease"
                  }}
                >
                  <Icon size={18} color={isActive ? t.a1 : t.muted} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {badge && (
                    <span style={{
                      fontSize: 9.5,
                      background: isActive ? t.a1 : t.surface2,
                      color: isActive ? t.onAccent : t.muted,
                      padding: "1px 6px",
                      borderRadius: 10,
                      fontWeight: 700
                    }}>
                      {badge}
                    </span>
                  )}
                  {isActive && <div style={{ width: 6, height: 6, borderRadius: 3, background: t.a1 }} />}
                </button>
              );
            })}
          </nav>

          {/* User Profile Widget at Sidebar Bottom */}
          <div style={{ padding: "12px 14px 8px", borderTop: `1px solid ${t.line}` }}>
            <button type="button"
              onClick={() => setTab("profile")}
              className="press card-hover"
              style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },
                padding: "10px 12px", borderRadius: 12, background: tab === "profile" ? t.surface2 : "transparent",
                border: `1px solid ${tab === "profile" ? t.a1 : t.line}`, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: t.onAccent, fontWeight: 700, fontSize: 14
              }}>
                {displayName[0]?.toUpperCase() || <User size={16} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 10.5, color: t.muted }}>Profile & Settings</div>
              </div>
              <Settings size={15} color={t.muted} />
            </button>
          </div>

          {/* Buraq Studios Copyright Tagline in Sidebar */}
          <div style={{
            padding: "8px 12px 14px", fontSize: 10.5, color: t.muted,
            textAlign: "center", lineHeight: 1.4, opacity: 0.8
          }}>
            This website is designed by <strong style={{ color: t.a1 }}>Buraq Studios</strong><br />
            Copyright all rights reserved.
          </div>
        </aside>

        {/* MAIN CONTENT AREA & TOP HEADER */}
        <div className="app-body" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
          {/* Desktop Top Header Bar */}
          <header className="app-header" style={{
            height: 64, borderBottom: `1px solid ${t.line}`, background: t.surface,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 28px", flexShrink: 0
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="mobile-brand"><BrandLogo scheme={scheme}/></span><h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: "capitalize", color: t.text }}>
                {tab === "focus" ? "Focus Studio" : tab}
              </h2>
              <span className="header-date" style={{ fontSize: 12, color: t.muted }}>
                {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </div>

            <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button aria-label="Ask Gemini" title="Ask Gemini about this screen" className="press" onClick={()=>askAssistant()} style={{border:`1px solid ${t.line}`,background:t.surface2,color:t.a1,borderRadius:12,padding:10}}><MessageCircle size={20}/></button>
              {/* Spotlight search pill */}
              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                className="press"
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
                  borderRadius: 10, border: `1px solid ${t.line}`, background: t.surface2,
                  color: t.muted, fontSize: 12.5, cursor: "pointer"
                }}
                aria-label="Search and commands" title="Search and commands (Ctrl+K)"
              >
                <Search size={14} color={t.a1} />
                <span className="header-label" style={{ color: t.text, fontWeight: 500 }}>Search</span>
                <span className="header-shortcut" style={{ fontSize: 10, background: t.surface, border: `1px solid ${t.line}`, padding: "2px 5px", borderRadius: 6, color: t.muted }}>
                  ⌘K
                </span>
              </button>

              {/* Quick theme mode toggle */}
              <button type="button"
                onClick={() => {
                  const next = theme === "dark" ? "light" : "dark";
                  setTheme(next);
                  localStorage.setItem("lifeos_theme", next);
                }}
                className="press"
                style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },
                  width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.line}`,
                  background: t.surface2, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: t.a1
                }}
                title="Toggle Light/Dark"
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </button>

              {/* Profile Avatar button */}
              <button
                aria-label="Profile and settings" onClick={() => setTab("profile")}
                className="press"
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 6px",
                  borderRadius: 20, border: `1px solid ${tab === "profile" ? t.a1 : t.line}`,
                  background: t.surface2, cursor: "pointer"
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: 13, background: t.a1,
                  color: t.onAccent, display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 12
                }}>
                  {displayName[0]?.toUpperCase() || <User size={13} />}
                </div>
                <span className="header-label" style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>
                  {displayName}
                </span>
              </button>
            </div>
          </header>

          {/* Scrollable View Content */}
          <main className="main-content" style={{ flex: 1, overflowY: "auto", position: "relative" }}>
            {pushNotice && <div role="status" style={{padding:12,background:t.surface2}}>{pushNotice} <button className="link-button" onClick={() => { setPushNotice(""); setTab("timetable"); }}>View timetable</button><button className="link-button" onClick={() => setPushNotice("")}>Dismiss</button></div>}
            <ScreenErrorBoundary
              t={t}
              resetKey={tab}
              onReturnToDashboard={() => setTab("home")}
            >
              <div key={tab} className="tab-scene"><Suspense fallback={<p role="status" style={{padding:24,color:t.muted}}>Loading…</p>}>
              {tab === "assistant" && <AssistantScreen key={user.uid} t={t} user={user} {...assistantData} setTab={setTab} />}
              {tab === "home" && (
                <Dashboard
                  t={t}
                  tasks={tasks}
                  sleep={sleep}
                  tx={tx}
                  workouts={workouts}
                  blocks={blocks}
                  onOpenHealthView={(view) => { setHealthView(view); setTab("health"); }}
                  name={displayName}
                  setTab={setTab}
                  theme={theme}
                  setTheme={setTheme}
                  onOpenProfile={() => setTab("profile")}
                  onOpenWealth={() => setIsWealthSimulatorOpen(true)}
                  onOpenFocus={() => setTab("focus")}
                />
              )}

              {tab === "tasks" && (
                <TasksScreen
                  t={t}
                  tasks={tasks}
                  userId={user.uid}
                  timetable={blocks}
                  onOpenFocusWithTask={(taskId) => {
                    setTargetFocusTaskId(taskId);
                    setTab("focus");
                  }}
                />
              )}

              {tab === "focus" && (
                <FocusStudio
                  t={t}
                  tasks={tasks}
                  initialTaskId={targetFocusTaskId}
                  onCompleteTask={async (taskId) => {
                    await updateItem(user.uid, "tasks", taskId, { done: true });
                  }}
                />
              )}

              {tab === "timetable" && (
                <TimetableScreen
                  t={t}
                  blocks={blocks}
                  tasks={tasks}
                  user={user}
                  userId={user.uid}
                />
              )}

              {tab === "health" && (
                <HealthScreen
                  t={t}
                  initialView={healthView}
                  sleep={sleep}
                  workouts={workouts}
                  meals={meals}
                  userId={user.uid}
                  bodyMetrics={bodyMetrics}
                />
              )}

              {tab === "budget" && (
                <BudgetScreen
                  t={t}
                  tx={tx}
                  userId={user.uid}
                  user={user}
                  wallets={wallets}
                  categoryBudgets={categoryBudgets}
                  loans={loans}
                  subscriptions={subscriptions}
                  billSplits={billSplits}
                  onAskAssistant={askAssistant}
                />
              )}

              {tab === "reports" && (
                <ReportsScreen
                  t={t}
                  tasks={tasks}
                  sleep={sleep}
                  tx={tx}
                />
              )}

              {tab === 'more' && <Screen t={t} title="More"><div style={{maxWidth:720,margin:'0 auto',display:'grid',gap:10}}>{MORE.map(([key,Icon,label,description])=><Card key={key} t={t} onClick={()=>setTab(key)} style={{display:'flex',alignItems:'center',gap:16}}><Icon color={t.a1} size={22}/><div style={{flex:1}}><strong>{label}</strong><div style={{color:t.muted,fontSize:13,marginTop:4}}>{description}</div></div><ChevronRight color={t.muted} size={18}/></Card>)}<details><summary style={{cursor:'pointer',color:t.muted,padding:12}}>Additional tools</summary><div style={{display:'flex',gap:10}}><GhostButton t={t} onClick={()=>setIsWealthSimulatorOpen(true)}>Wealth calculator</GhostButton><GhostButton t={t} onClick={()=>setShowGuideModal(true)}>Help & guide</GhostButton></div></details></div></Screen>}

              {tab === "profile" && (
                <ProfileScreen
                  t={t}
                  user={user}
                  theme={theme}
                  setTheme={setTheme}
                  scheme={scheme}
                  setScheme={setScheme}
                  onLogout={handleLogout}
                  onOpenGuide={() => setShowGuideModal(true)}
                />
              )}
              </Suspense></div>
            </ScreenErrorBoundary>
          </main>

          {/* MOBILE BOTTOM NAVIGATION */}
          <nav className="mobile-nav" style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            background: t.surface, borderTop: `1px solid ${t.line}`,
            padding: "8px 8px 14px", display: "none", justifyContent: "space-around",
            alignItems: "center", zIndex: 50
          }}>
            {[
              ['home',Home,'Home'],['tasks',ListChecks,'Tasks'],['budget',Wallet,'Budget'],
              ['assistant',MessageCircle,'Assistant'],['more',MoreHorizontal,'More']
            ].map(([key, Icon, label]) => {
              const isActive = tab === key || (key === "more" && ["timetable","health","reports","focus","profile"].includes(tab));
              return (
                <button type="button"
                  key={key}
                  onClick={() => setTab(key)}
                  className="press"
                  aria-current={isActive ? "page" : undefined}
                  style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    cursor: "pointer", flex: 1
                  }}
                >
                  <Icon weight={isActive ? "fill" : "duotone"} size={23} color={isActive ? t.a1 : t.muted} />
                  <span style={{ fontSize: 9.5, fontWeight: isActive ? 700 : 500, color: isActive ? t.a1 : t.muted }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </ToastProvider>
  );
}
