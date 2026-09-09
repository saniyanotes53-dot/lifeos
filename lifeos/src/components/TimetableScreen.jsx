import React, { useState } from "react";
import {
  Bell, Clock, Plus, X, ChevronLeft, ChevronRight, Calendar, CheckSquare, Square,
  CalendarDays, ListFilter, Tag
} from "lucide-react";
import { inputStyle, todayStr, dayName } from "../theme";
import { Card, Screen, Empty, Segmented, PrimaryButton } from "./primitives";
import { addItem, deleteItem, updateItem } from "../firestore";
import { enablePush } from "../notifications";

export default function TimetableScreen({ t, blocks = [], tasks = [], userId }) {
  const [view, setView] = useState("day"); // "day" or "week"
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [time, setTime] = useState("09:00");
  const [label, setLabel] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [pushLoading, setPushLoading] = useState(false);

  // Date navigation helpers
  const changeDay = (delta) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + delta);
    setSelectedDate(current.toISOString().slice(0, 10));
  };

  // Week calculation (Monday to Sunday)
  const getWeekDates = (baseDateStr) => {
    const base = new Date(baseDateStr);
    const day = base.getDay(); // 0 is Sunday
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + diffToMon);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  };

  const weekDates = getWeekDates(selectedDate);

  const requestPerm = async () => {
    setPushLoading(true);
    try {
      const token = await enablePush();
      if (token) {
        setPermission("granted");
        await addItem(userId, "pushTokens", { token, createdAt: new Date().toISOString() });
      } else {
        setPermission(Notification.permission);
      }
    } catch (e) {
      console.error("Push setup failed:", e);
    } finally {
      setPushLoading(false);
    }
  };

  const scheduleLocalReminder = (b) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const [h, m] = b.time.split(":").map(Number);
    const target = new Date(b.date || todayStr());
    target.setHours(h, m, 0, 0);
    const now = new Date();
    if (target > now) {
      setTimeout(() => {
        try { new Notification("Life OS Reminder", { body: `${b.time} — ${b.label}` }); } catch (e) {}
      }, Math.min(target - now, 2147483000));
    }
  };

  const add = async (targetDate = selectedDate) => {
    if (!label.trim()) return;
    const b = {
      time,
      label: label.trim(),
      date: targetDate,
      done: false,
      taskId: selectedTaskId || null
    };
    await addItem(userId, "timetable", b);
    setLabel("");
    setSelectedTaskId("");
    scheduleLocalReminder(b);
  };

  const toggleDone = async (b) => {
    const nextDone = !b.done;
    await updateItem(userId, "timetable", b.id, { done: nextDone });
    // Synchronize linked task if present
    if (b.taskId) {
      await updateItem(userId, "tasks", b.taskId, { done: nextDone });
    }
  };

  const remove = async (id) => {
    await deleteItem(userId, "timetable", id);
  };

  // Filter blocks for Day View
  const dayBlocks = blocks
    .filter(b => (b.date || todayStr()) === selectedDate)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  return (
    <Screen t={t} title="Timetable">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* View Switcher: Day vs Week */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ width: 220 }}>
            <Segmented
              t={t}
              value={view}
              onChange={setView}
              options={[
                ["day", "Day View", Clock],
                ["week", "Week View", CalendarDays]
              ]}
            />
          </div>

          {/* Date Selector & Navigator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => changeDay(-1)}
              className="press"
              style={{
                width: 32, height: 32, borderRadius: 10, border: `1px solid ${t.line}`,
                background: t.surface, color: t.text, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer"
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
              background: t.surface2, border: `1px solid ${t.line}`, borderRadius: 10,
              fontSize: 13, fontWeight: 600, color: t.text
            }}>
              <Calendar size={14} color={t.a1} />
              <span>{new Date(selectedDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            </div>
            <button
              onClick={() => changeDay(1)}
              className="press"
              style={{
                width: 32, height: 32, borderRadius: 10, border: `1px solid ${t.line}`,
                background: t.surface, color: t.text, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer"
              }}
            >
              <ChevronRight size={16} />
            </button>
            {selectedDate !== todayStr() && (
              <button
                onClick={() => setSelectedDate(todayStr())}
                className="press"
                style={{
                  padding: "6px 12px", borderRadius: 10, border: `1px solid ${t.line}`,
                  background: t.surface, color: t.a1, fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Push notification banner */}
        <Card t={t} style={{ borderColor: permission === "granted" ? t.a1 : t.line, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bell size={16} color={permission === "granted" ? t.a1 : t.muted} />
            <div style={{ flex: 1, fontSize: 12, color: t.muted }}>
              {permission === "granted"
                ? "Push notifications & timetable reminders enabled."
                : permission === "unsupported"
                ? "This browser doesn't support notifications."
                : "Enable push notifications to get reminders for scheduled blocks."}
            </div>
            {permission !== "granted" && permission !== "unsupported" && (
              <button
                onClick={requestPerm}
                disabled={pushLoading}
                className="press"
                style={{
                  border: "none", borderRadius: 9, padding: "7px 12px",
                  background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
                  color: t.onAccent, fontSize: 11, fontWeight: 600, cursor: "pointer"
                }}
              >
                {pushLoading ? "…" : "Enable"}
              </button>
            )}
          </div>
        </Card>

        {/* Quick Add Block Card */}
        <Card t={t} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text, marginBottom: 8 }}>
            Add Time Block for {selectedDate}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="time"
              style={{ ...inputStyle(t), width: 100 }}
              value={time}
              onChange={e => setTime(e.target.value)}
            />
            <input
              style={{ ...inputStyle(t), flex: 1, minWidth: 200 }}
              placeholder="What's scheduled? (e.g. Deep Work, Gym, Reading)"
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && add()}
            />
            {/* Optional task link selector */}
            {tasks.filter(tk => !tk.done).length > 0 && (
              <select
                style={{ ...inputStyle(t), width: 160 }}
                value={selectedTaskId}
                onChange={e => {
                  setSelectedTaskId(e.target.value);
                  const matched = tasks.find(tk => tk.id === e.target.value);
                  if (matched && !label) setLabel(matched.title);
                }}
              >
                <option value="">Link a Task...</option>
                {tasks.filter(tk => !tk.done).map(tk => (
                  <option key={tk.id} value={tk.id}>📌 {tk.title}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => add()}
              className="press"
              style={{
                width: 42, borderRadius: 10, border: "none",
                background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
              }}
            >
              <Plus size={18} color={t.onAccent} />
            </button>
          </div>
        </Card>

        {/* DAY VIEW */}
        {view === "day" && (
          <div>
            {dayBlocks.length === 0 && (
              <Empty t={t} text={`No blocks scheduled for ${selectedDate}. Add your first block above!`} />
            )}
            {dayBlocks.map(b => (
              <Card
                t={t}
                key={b.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  opacity: b.done ? 0.6 : 1, transition: "opacity 0.2s ease"
                }}
              >
                <div
                  onClick={() => toggleDone(b)}
                  className="press"
                  style={{
                    cursor: "pointer", display: "flex", alignItems: "center",
                    color: b.done ? t.good : t.muted
                  }}
                >
                  {b.done ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>

                <div style={{
                  display: "flex", alignItems: "center", gap: 5, color: t.a1,
                  fontSize: 13.5, fontWeight: 700, width: 68
                }}>
                  <Clock size={13} />
                  {b.time}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 14, color: t.text,
                    textDecoration: b.done ? "line-through" : "none"
                  }}>
                    {b.label}
                  </div>
                  {b.taskId && (
                    <div style={{ fontSize: 10.5, color: t.a2, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Tag size={10} /> Linked to Task
                    </div>
                  )}
                </div>

                <X size={16} color={t.muted} style={{ cursor: "pointer" }} onClick={() => remove(b.id)} />
              </Card>
            ))}
          </div>
        )}

        {/* WEEK VIEW (7-Day Grid) */}
        {view === "week" && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 10, overflowX: "auto"
          }}>
            {weekDates.map(dateStr => {
              const isToday = dateStr === todayStr();
              const isSelected = dateStr === selectedDate;
              const dateBlocks = blocks
                .filter(b => (b.date || todayStr()) === dateStr)
                .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
              const dObj = new Date(dateStr);
              const dayTitle = dObj.toLocaleDateString(undefined, { weekday: "short" });
              const dayNum = dObj.getDate();

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  style={{
                    background: isSelected ? t.surface2 : t.surface,
                    border: `1.5px solid ${isSelected ? t.a1 : isToday ? t.a2 : t.line}`,
                    borderRadius: 14, padding: 10, minHeight: 280, display: "flex",
                    flexDirection: "column", cursor: "pointer", transition: "all 0.15s ease"
                  }}
                >
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    borderBottom: `1px solid ${t.line}`, paddingBottom: 6, marginBottom: 8
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? t.a1 : t.text }}>
                        {dayTitle}
                      </div>
                      <div style={{ fontSize: 11, color: t.muted }}>{dayNum}</div>
                    </div>
                    <span style={{ fontSize: 10, color: t.muted, background: t.bg, padding: "2px 6px", borderRadius: 6 }}>
                      {dateBlocks.length}
                    </span>
                  </div>

                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    {dateBlocks.map(b => (
                      <div
                        key={b.id}
                        onClick={(e) => { e.stopPropagation(); toggleDone(b); }}
                        style={{
                          background: t.surface2, border: `1px solid ${t.line}`, borderRadius: 8,
                          padding: "6px 8px", fontSize: 11.5, opacity: b.done ? 0.5 : 1
                        }}
                      >
                        <div style={{ color: t.a1, fontWeight: 700, fontSize: 10.5 }}>{b.time}</div>
                        <div style={{
                          color: t.text, textDecoration: b.done ? "line-through" : "none",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                        }}>
                          {b.label}
                        </div>
                      </div>
                    ))}
                    {dateBlocks.length === 0 && (
                      <div style={{ fontSize: 11, color: t.muted, textAlign: "center", marginTop: 20 }}>
                        No blocks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11.5, color: t.muted, opacity: 0.85, paddingBottom: 16 }}>
          This website is designed by <strong style={{ color: t.a1, fontWeight: 700 }}>Buraq Studios</strong> · Copyright all rights reserved.
        </div>
      </div>
    </Screen>
  );
}
