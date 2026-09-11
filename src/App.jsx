import React, { useState, useEffect } from "react";
import {
  Home, ListChecks, Moon, Wallet, BarChart3, Clock, User, LogOut, Sparkles, Sun, Settings,
  ChevronRight, Headphones, Search, DollarSign, Award, Zap
} from "lucide-react";
import { useT, PALETTES } from "./theme";
import { onAuthChange, logout } from "./auth";
import { ensureUserProfile, watchCollection, updateItem } from "./firestore";

import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";
import TasksScreen from "./components/TasksScreen";
import FocusStudio from "./components/FocusStudio";
import HealthScreen from "./components/HealthScreen";
import BudgetScreen from "./components/BudgetScreen";
import TimetableScreen from "./components/TimetableScreen";
import ReportsScreen from "./components/ReportsScreen";
import ProfileScreen from "./components/ProfileScreen";
import UserGuideModal from "./components/UserGuideModal";
import CommandPalette from "./components/CommandPalette";
import WealthSimulatorModal from "./components/WealthSimulatorModal";
import { ToastProvider } from "./components/Toast";
import CopyrightFooter from "./components/CopyrightFooter";

export default function App() {
  // Theme state: scheme (blue, brown, peach) and mode (dark, light)
  const [scheme, setScheme] = useState(() => localStorage.getItem("lifeos_scheme") || "blue");
  const [theme, setTheme] = useState(() => localStorage.getItem("lifeos_theme") || "dark");
  const t = useT(theme, scheme);

  const [user, setUser] = useState(undefined); // undefined = checking, null = logged out, object = logged in
  const [tab, setTab] = useState("home"); // home, tasks, focus, health, budget, timetable, reports, profile
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

  useEffect(() => {
    if (user && user.uid) {
      const key = "lifeos_guide_seen_" + user.uid;
      const seen = localStorage.getItem(key);
      if (!seen) {
        setShowGuideModal(true);
      }
    }
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
      watchCollection(uid, "bodyMetrics", setBodyMetrics, "date")
    ];
    return () => unsubs.forEach(fn => fn && fn());
  }, [user]);

  const handleLogout = async () => {
    await logout();
    setTasks([]); setSleep([]); setWorkouts([]); setMeals([]);
    setTx([]); setBlocks([]); setWallets([]); setCategoryBudgets([]); setLoans([]); setBodyMetrics([]);
    setTab("home");
  };

  const displayName = user ? (user.displayName || user.email?.split("@")[0] || "User") : "";

  // Pro navigation items for desktop sidebar & mobile
  const NAV = [
    ["home", Home, "Home"],
    ["tasks", ListChecks, "Tasks"],
    ["focus", Headphones, "Focus Studio", "PRO"],
    ["timetable", Clock, "Timetable"],
    ["health", Moon, "Health"],
    ["budget", Wallet, "Budget"],
    ["reports", BarChart3, "Reports"],
  ];

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

  // Not logged in: Show Full-page Auth Screen
  if (!user) {
    return (
      <div style={{
        minHeight: "100vh", width: "100vw", background: t.bg, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      }}>
        <div style={{
          width: "100%", maxWidth: 440, background: t.surface, borderRadius: 28,
          border: `1px solid ${t.line}`, boxShadow: `0 24px 60px -12px ${t.a1}22`,
          overflow: "hidden"
        }}>
          <AuthScreen t={t} onLogin={() => {}} />
        </div>
      </div>
    );
  }

  // Logged In: Full Desktop / Tablet / Mobile Website Layout wrapped in ToastProvider
  return (
    <ToastProvider t={t}>
      <div style={{
        display: "flex", minHeight: "100vh", width: "100vw", background: t.bg,
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
          {/* Brand Header */}
          <div style={{ padding: "24px 22px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${t.line}` }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 8px 20px -6px ${t.a1}88`
            }}>
              <Sparkles size={20} color={t.onAccent} />
            </div>
            <div>
              <div style={{ fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 20, fontWeight: 700, color: t.text }}>
                Life OS
              </div>
              <div style={{ fontSize: 11, color: t.muted }}>Personal Operating System</div>
            </div>
          </div>

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
              <span style={{ fontSize: 10, background: t.surface, border: `1px solid ${t.line}`, padding: "2px 5px", borderRadius: 6, color: t.muted, fontWeight: 600 }}>
                ⌘K
              </span>
            </button>
          </div>

          {/* Sidebar Nav Items */}
          <nav style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
            {NAV.map(([key, Icon, label, badge]) => {
              const isActive = tab === key;
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
            <div
              onClick={() => setTab("profile")}
              className="press card-hover"
              style={{
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
            </div>
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
          {/* Desktop Top Header Bar */}
          <header style={{
            height: 64, borderBottom: `1px solid ${t.line}`, background: t.surface,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 28px", flexShrink: 0
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: "capitalize", color: t.text }}>
                {tab === "focus" ? "Focus Studio (Pro)" : tab}
              </h2>
              <span style={{ fontSize: 12, color: t.muted }}>
                {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Spotlight search pill */}
              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                className="press"
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
                  borderRadius: 10, border: `1px solid ${t.line}`, background: t.surface2,
                  color: t.muted, fontSize: 12.5, cursor: "pointer"
                }}
                title="Search and commands (Ctrl+K)"
              >
                <Search size={14} color={t.a1} />
                <span style={{ color: t.text, fontWeight: 500 }}>Search</span>
                <span style={{ fontSize: 10, background: t.surface, border: `1px solid ${t.line}`, padding: "2px 5px", borderRadius: 6, color: t.muted }}>
                  ⌘K
                </span>
              </button>

              {/* Wealth Simulator Trigger */}
              <button
                onClick={() => setIsWealthSimulatorOpen(true)}
                className="press"
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                  borderRadius: 10, border: `1px solid ${t.good}44`, background: `${t.good}15`,
                  color: t.good, fontSize: 12, fontWeight: 700, cursor: "pointer"
                }}
                title="Open Wealth Runway & Compound Growth Projector"
              >
                <DollarSign size={14} /> Wealth
              </button>

              {/* Guide modal trigger */}
              <button
                onClick={() => setShowGuideModal(true)}
                className="press"
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                  borderRadius: 10, border: `1px solid ${t.line}`, background: t.surface2,
                  color: t.a1, fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}
                title="Open Tour & Guide"
              >
                <Sparkles size={14} /> Guide
              </button>

              {/* Quick theme mode toggle */}
              <div
                onClick={() => {
                  const next = theme === "dark" ? "light" : "dark";
                  setTheme(next);
                  localStorage.setItem("lifeos_theme", next);
                }}
                className="press"
                style={{
                  width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.line}`,
                  background: t.surface2, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: t.a1
                }}
                title="Toggle Light/Dark"
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </div>

              {/* Profile Avatar button */}
              <button
                onClick={() => setTab("profile")}
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
                <span style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>
                  {displayName}
                </span>
              </button>
            </div>
          </header>

          {/* Scrollable View Content */}
          <main className="main-content" style={{ flex: 1, overflowY: "auto", position: "relative" }}>
            {tab === "home" && (
              <Dashboard
                t={t}
                tasks={tasks}
                sleep={sleep}
                tx={tx}
                workouts={workouts}
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
                userId={user.uid}
              />
            )}

            {tab === "health" && (
              <HealthScreen
                t={t}
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
                wallets={wallets}
                categoryBudgets={categoryBudgets}
                loans={loans}
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
          </main>

          {/* MOBILE BOTTOM NAVIGATION */}
          <nav className="mobile-nav" style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            background: t.surface, borderTop: `1px solid ${t.line}`,
            padding: "8px 8px 14px", display: "none", justifyContent: "space-around",
            alignItems: "center", zIndex: 50
          }}>
            {[
              ["home", Home, "Home"],
              ["tasks", ListChecks, "Tasks"],
              ["focus", Headphones, "Focus"],
              ["timetable", Clock, "Time"],
              ["health", Moon, "Health"],
              ["budget", Wallet, "Budget"],
              ["reports", BarChart3, "Reports"]
            ].map(([key, Icon, label]) => {
              const isActive = tab === key;
              return (
                <div
                  key={key}
                  onClick={() => setTab(key)}
                  className="press"
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    cursor: "pointer", flex: 1
                  }}
                >
                  <Icon size={19} color={isActive ? t.a1 : t.muted} />
                  <span style={{ fontSize: 9.5, fontWeight: isActive ? 700 : 500, color: isActive ? t.a1 : t.muted }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    </ToastProvider>
  );
}
