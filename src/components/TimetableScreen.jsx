import { IconBtn } from "./primitives";
import React, { useState, useEffect } from "react";
import {
  Bell, Clock, Plus, X, ChevronLeft, ChevronRight, Calendar, CheckSquare, Square,
  CalendarDays, ListFilter, Tag
} from "lucide-react";
import { parseLocalDate, shiftDate, weekDates as getWeekDates, formatDate } from "../utils/dates";
import { inputStyle, todayStr, dayName } from "../theme";
import { Card, Screen, Empty, Segmented, PrimaryButton } from "./primitives";
import { addItem, deleteItem, updateItem } from "../firestore";
import { enableReminders, disableReminders, remindersEnabled } from "../notifications";
import { getPushState, registerPush, unregisterPush } from "../cloud-notifications";

export default function TimetableScreen({ t, blocks = [], tasks = [], userId, user }) {
  const [view, setView] = useState("day"); // "day" or "week"
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [time, setTime] = useState("09:00");
  const [label, setLabel] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [remindersOn, setRemindersOn] = useState(() => remindersEnabled(userId));
  const [pushState, setPushState] = useState(() => getPushState(userId));
  const [pushError, setPushError] = useState("");
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    const update = () => {
      setRemindersOn(remindersEnabled(userId));
      setPushState(getPushState(userId));
    };
    update();
    window.addEventListener('lifeos-reminders-change', update);
    window.addEventListener('lifeos-push-status-change', update);
    window.addEventListener('focus', update);
    return () => {
      window.removeEventListener('lifeos-reminders-change', update);
      window.removeEventListener('lifeos-push-status-change', update);
      window.removeEventListener('focus', update);
    };
  }, [userId]);

  // Date navigation helpers
  const changeDay = (delta) => {
    setSelectedDate(shiftDate(selectedDate, delta));
  };

  const weekDates = getWeekDates(selectedDate);

  const handleEnablePush = async () => {
    setPushLoading(true);
    setPushError("");
    try {
      await registerPush(user);
      await enableReminders(user);
      setPushState(getPushState(userId));
    } catch (e) {
      setPushError(e.message);
      setPushState(getPushState(userId));
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setPushLoading(true);
    setPushError("");
    try {
      await unregisterPush(user);
      setPushState(getPushState(userId));
    } catch (e) {
      setPushError(e.message);
    } finally {
      setPushLoading(false);
    }
  };

  const toggleInAppReminders = async () => {
    setPushLoading(true);
    setPushError("");
    try {
      if (remindersOn) await disableReminders(user);
      else await enableReminders(user);
    } catch (e) {
      setPushError(e.message);
    } finally {
      setPushLoading(false);
    }
  };

  const add = async (targetDate = selectedDate) => {
    if (!label.trim() || !time || !parseLocalDate(targetDate)) return;
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
        {pushError && <p role="alert">{pushError}</p>}
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
              aria-label="Previous day" onClick={() => changeDay(-1)}
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
              <span>{formatDate(selectedDate, { weekday: "short", month: "short", day: "numeric" })}</span>
            </div>
            <button
              aria-label="Next day" onClick={() => changeDay(1)}
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
        <Card t={t} style={{ borderColor: remindersOn ? t.a1 : t.line, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bell size={16} color={remindersOn ? t.a1 : t.muted} />
            <div style={{ flex: 1, fontSize: 12, color: t.muted }}>
              {remindersOn ? "In-app reminders are on. Keep Life OS open; sleeping devices may delay alerts." : "Enable in-app reminders for scheduled blocks while Life OS is open."}
            </div>
            {(
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
                {pushLoading ? "…" : remindersOn ? "Disable" : "Enable"}
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
            <input aria-label="Block time"
              type="time"
              style={{ ...inputStyle(t), width: 100 }}
              value={time}
              onChange={e => setTime(e.target.value)}
            />
            <input aria-label="Block title"
              style={{ ...inputStyle(t), flex: 1, minWidth: 200 }}
              placeholder="What's scheduled? (e.g. Deep Work, Gym, Reading)"
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && add()}
            />
            {/* Optional task link selector */}
            {tasks.filter(tk => !tk.done).length > 0 && (
              <select aria-label="Linked task"
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
              aria-label="Add time block" onClick={() => add()}
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
                <button type="button"
                  role="checkbox" aria-checked={!!b.done} aria-label={`Complete block: ${b.label}`} onClick={() => toggleDone(b)}
                  className="press"
                  style={{ ...{ font: "inherit", textAlign: "inherit", color: "inherit", border: "none", background: "transparent", padding: 0 },
                    cursor: "pointer", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center",
                    color: b.done ? t.good : t.muted
                  }}
                >
                  {b.done ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

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

                <IconBtn t={t} label="Delete entry" onClick={() => remove(b.id)}><X size={16} color={t.muted} style={{ cursor: "pointer" }}  /></IconBtn>
              </Card>
            ))}
          </div>
        )}

        {/* WEEK VIEW (7-Day Grid) */}
        {view === "week" && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
            gap: 10, overflowX: "auto"
          }}>
            {weekDates.map(dateStr => {
              const isToday = dateStr === todayStr();
              const isSelected = dateStr === selectedDate;
              const dateBlocks = blocks
                .filter(b => (b.date || todayStr()) === dateStr)
                .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
              const dObj = parseLocalDate(dateStr);
              const dayTitle = dObj.toLocaleDateString(undefined, { weekday: "short" });
              const dayNum = dObj.getDate();

              return (
                <div role="button" tabIndex={0} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.currentTarget.click(); } }}
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
                        role="checkbox" tabIndex={0} aria-checked={!!b.done} aria-label={`Complete block: ${b.label}`} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleDone(b); } }} onClick={(e) => { e.stopPropagation(); toggleDone(b); }}
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
