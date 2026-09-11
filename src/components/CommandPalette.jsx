import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, ArrowRight, Home, ListChecks, Clock, Moon, Wallet,
  BarChart3, User, Sparkles, Sun, Headphones, DollarSign, FileText, X
} from "lucide-react";

export default function CommandPalette({
  isOpen,
  onClose,
  t,
  setTab,
  theme,
  setTheme,
  tasks = [],
  tx = [],
  onOpenWealth,
  onOpenFocus
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  const actions = useMemo(() => {
    const list = [
      { id: "nav-home", title: "Go to Dashboard", category: "Navigation", icon: Home, action: () => { setTab("home"); onClose(); } },
      { id: "nav-tasks", title: "Go to Tasks & Priorities", category: "Navigation", icon: ListChecks, action: () => { setTab("tasks"); onClose(); } },
      { id: "nav-focus", title: "Open Focus Studio & Ambient Soundscape", category: "Deep Work (Pro)", icon: Headphones, action: () => { onOpenFocus ? onOpenFocus() : setTab("focus"); onClose(); } },
      { id: "nav-time", title: "Go to Timetable & Scheduling", category: "Navigation", icon: Clock, action: () => { setTab("timetable"); onClose(); } },
      { id: "nav-health", title: "Go to Health & Fitness", category: "Navigation", icon: Moon, action: () => { setTab("health"); onClose(); } },
      { id: "nav-budget", title: "Go to Budget & Accounts", category: "Navigation", icon: Wallet, action: () => { setTab("budget"); onClose(); } },
      { id: "nav-reports", title: "Go to Analytics & Reports", category: "Navigation", icon: BarChart3, action: () => { setTab("reports"); onClose(); } },
      { id: "nav-profile", title: "Account & Personal Settings", category: "Navigation", icon: User, action: () => { setTab("profile"); onClose(); } },
      { id: "act-wealth", title: "Wealth Runway & 5-Year Compound Growth Simulator", category: "Financial Intelligence (Pro)", icon: DollarSign, action: () => { onOpenWealth?.(); onClose(); } },
      { id: "act-theme", title: `Toggle Theme (Currently ${theme})`, category: "Preferences", icon: theme === "dark" ? Sun : Moon, action: () => { setTheme(theme === "dark" ? "light" : "dark"); onClose(); } },
      { id: "act-print", title: "Print / Export Executive PDF Summary", category: "Reports", icon: FileText, action: () => { window.print(); onClose(); } },
    ];

    // Add matching tasks
    if (query.trim()) {
      const q = query.toLowerCase();
      tasks.filter(x => x.title?.toLowerCase().includes(q)).slice(0, 4).forEach(x => {
        list.push({
          id: `task-${x.id}`,
          title: `Task: ${x.title} (${x.done ? "Completed" : x.priority || "Open"})`,
          category: "Your Tasks",
          icon: ListChecks,
          action: () => { setTab("tasks"); onClose(); }
        });
      });

      // Add matching transactions
      tx.filter(x => x.note?.toLowerCase().includes(q) || x.category?.toLowerCase().includes(q)).slice(0, 3).forEach(x => {
        list.push({
          id: `tx-${x.id}`,
          title: `${x.type === "expense" ? "Expense" : "Income"}: ${x.category} (₹${x.amount}) - ${x.note || "No note"}`,
          category: "Transactions",
          icon: Wallet,
          action: () => { setTab("budget"); onClose(); }
        });
      });
    }

    return list.filter(item => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
    });
  }, [query, theme, tasks, tx, setTab, setTheme, onOpenWealth, onOpenFocus, onClose]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, actions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + actions.length) % Math.max(1, actions.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (actions[selectedIndex]) {
        actions[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        paddingLeft: 16,
        paddingRight: 16
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="slide-down"
        style={{
          width: "100%",
          maxWidth: 580,
          background: t.surface,
          border: `1px solid ${t.line}`,
          borderRadius: 20,
          boxShadow: `0 24px 60px -12px rgba(0,0,0,0.5), 0 0 0 1px ${t.a1}33`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Search Input Bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 20px",
          borderBottom: `1px solid ${t.line}`
        }}>
          <Search size={20} color={t.a1} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, search tasks, budgets, or press Esc…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: t.text,
              fontSize: 15,
              outline: "none"
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{ background: "transparent", border: "none", color: t.muted, cursor: "pointer", padding: 2 }}
            >
              <X size={16} />
            </button>
          )}
          <div style={{
            fontSize: 11,
            color: t.muted,
            background: t.surface2,
            padding: "3px 7px",
            borderRadius: 6,
            border: `1px solid ${t.line}`
          }}>
            ESC
          </div>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: 380, overflowY: "auto", padding: "8px 8px" }}>
          {actions.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: t.muted, fontSize: 13.5 }}>
              No matches found for "{query}"
            </div>
          ) : (
            actions.map((item, index) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: isSelected ? `linear-gradient(135deg, ${t.a1}22, ${t.a3}15)` : "transparent",
                    color: isSelected ? t.a1 : t.text,
                    cursor: "pointer",
                    transition: "all 0.1s ease"
                  }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: isSelected ? t.a1 : t.surface2,
                    color: isSelected ? t.onAccent : t.muted,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <Icon size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13.5,
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? t.text : t.text,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 10.5, color: isSelected ? t.a1 : t.muted }}>
                      {item.category}
                    </div>
                  </div>
                  {isSelected && <ArrowRight size={15} color={t.a1} />}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div style={{
          padding: "10px 18px",
          borderTop: `1px solid ${t.line}`,
          background: t.surface2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: t.muted
        }}>
          <div style={{ display: "flex", gap: 12 }}>
            <span><strong style={{ color: t.text }}>↑↓</strong> Navigate</span>
            <span><strong style={{ color: t.text }}>↵</strong> Select</span>
            <span><strong style={{ color: t.text }}>ESC</strong> Close</span>
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Sparkles size={12} color={t.a1} /> Spotlight Pro
          </span>
        </div>
      </div>
    </div>
  );
}
