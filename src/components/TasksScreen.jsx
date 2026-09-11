import React, { useState, useMemo } from "react";
import {
  Plus, Check, X, Calendar, Clock, Headphones, Search, Filter,
  Sparkles, CheckCircle2, AlertCircle, ArrowUpDown
} from "lucide-react";
import { inputStyle, todayStr, PRI_KEY } from "../theme";
import { Card, Screen, Empty, PrimaryButton, ProgressRing } from "./primitives";
import { addItem, updateItem, deleteItem } from "../firestore";
import { useToast } from "./Toast";

export default function TasksScreen({ t, tasks = [], userId, timetable = [], onOpenFocusWithTask }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [pri, setPri] = useState("Med");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // "all", "active", "high", "done"

  const [schedulingTask, setSchedulingTask] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(todayStr());
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [schedMsg, setSchedMsg] = useState("");

  const order = { High: 0, Med: 1, Low: 2 };
  const priVal = (p) => order[p] ?? 3;

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(x => x.title?.toLowerCase().includes(q));
    }

    // Tab filter
    if (filterTab === "active") {
      list = list.filter(x => !x.done);
    } else if (filterTab === "high") {
      list = list.filter(x => x.priority === "High" && !x.done);
    } else if (filterTab === "done") {
      list = list.filter(x => x.done);
    }

    return list.sort((a, b) => (a.done - b.done) || (priVal(a.priority) - priVal(b.priority)));
  }, [tasks, searchQuery, filterTab]);

  const totalCount = tasks.length;
  const completedCount = tasks.filter(x => x.done).length;
  const activeCount = totalCount - completedCount;
  const highPriorityCount = tasks.filter(x => x.priority === "High" && !x.done).length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const add = async () => {
    if (!title.trim()) return;
    await addItem(userId, "tasks", { title: title.trim(), priority: pri, done: false, date: todayStr() });
    setTitle("");
    toast("Task created successfully", "success", 2000);
  };

  const toggle = async (task) => {
    const nextDone = !task.done;
    await updateItem(userId, "tasks", task.id, { done: nextDone });

    if (nextDone) {
      const newXP = Number(localStorage.getItem("lifeos_user_xp") || 250) + 25;
      localStorage.setItem("lifeos_user_xp", String(newXP));
      toast(`🎉 Task completed! +25 XP awarded.`, "sparkle", 3200);
    }

    // Also update any linked timetable blocks
    const linkedBlocks = timetable.filter(b => b.taskId === task.id);
    for (const b of linkedBlocks) {
      await updateItem(userId, "timetable", b.id, { done: nextDone });
    }
  };

  const remove = async (id) => {
    await deleteItem(userId, "tasks", id);
    toast("Task deleted", "info", 2000);
  };

  const handleScheduleSubmit = async () => {
    if (!schedulingTask) return;
    await addItem(userId, "timetable", {
      time: scheduleTime,
      label: schedulingTask.title,
      date: scheduleDate,
      done: schedulingTask.done,
      taskId: schedulingTask.id
    });
    toast(`Scheduled for ${scheduleDate} at ${scheduleTime}!`, "success", 3000);
    setSchedulingTask(null);
  };

  return (
    <Screen t={t} title="Tasks & Priorities">
      <div style={{ maxWidth: 840, margin: "0 auto" }}>
        {/* Executive Task Overview Banner */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16
        }}>
          <Card t={t} style={{ margin: 0, padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <ProgressRing t={t} pct={pct} size={50} stroke={6}>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>{pct}%</span>
            </ProgressRing>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{completedCount}/{totalCount}</div>
              <div style={{ fontSize: 11, color: t.muted }}>Completed</div>
            </div>
          </Card>

          <Card t={t} style={{ margin: 0, padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: `${t.a1}22`,
              color: t.a1, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{activeCount}</div>
              <div style={{ fontSize: 11, color: t.muted }}>Active Tasks</div>
            </div>
          </Card>

          <Card t={t} style={{ margin: 0, padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: highPriorityCount > 0 ? "rgba(239, 68, 68, 0.15)" : t.surface2,
              color: highPriorityCount > 0 ? "#ef4444" : t.muted, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <AlertCircle size={22} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: highPriorityCount > 0 ? "#ef4444" : t.text }}>
                {highPriorityCount}
              </div>
              <div style={{ fontSize: 11, color: t.muted }}>High Urgency</div>
            </div>
          </Card>
        </div>

        {/* Task Creator Input */}
        <Card t={t} style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle(t), flex: 1 }}
              placeholder="What do you want to accomplish next?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && add()}
            />
            <select
              style={{ ...inputStyle(t), width: 94 }}
              value={pri}
              onChange={e => setPri(e.target.value)}
            >
              <option value="High">🔴 High</option>
              <option value="Med">🟡 Med</option>
              <option value="Low">⚪ Low</option>
            </select>
            <button
              onClick={add}
              className="press"
              style={{
                width: 44, borderRadius: 10, border: "none",
                background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                boxShadow: `0 4px 12px -3px ${t.a1}88`
              }}
              title="Add Task"
            >
              <Plus size={20} color={t.onAccent} />
            </button>
          </div>
        </Card>

        {/* Search & Filter Bar */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14
        }}>
          {/* Filter Pills */}
          <div style={{ display: "flex", background: t.surface2, padding: 3, borderRadius: 12, border: `1px solid ${t.line}` }}>
            {[
              ["all", `All (${totalCount})`],
              ["active", `Active (${activeCount})`],
              ["high", `High Priority (${highPriorityCount})`],
              ["done", `Done (${completedCount})`]
            ].map(([k, label]) => {
              const isActive = filterTab === k;
              return (
                <button
                  key={k}
                  onClick={() => setFilterTab(k)}
                  style={{
                    background: isActive ? t.surface : "transparent",
                    color: isActive ? t.a1 : t.muted,
                    fontWeight: isActive ? 700 : 500,
                    border: isActive ? `1px solid ${t.line}` : "none",
                    borderRadius: 9,
                    padding: "6px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div style={{
            position: "relative",
            minWidth: 180,
            flex: "1 1 200px",
            maxWidth: 280
          }}>
            <Search size={14} color={t.muted} style={{ position: "absolute", left: 10, top: 11 }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              style={{
                ...inputStyle(t),
                paddingLeft: 30,
                paddingTop: 8,
                paddingBottom: 8,
                fontSize: 12.5
              }}
            />
          </div>
        </div>

        {/* Schedule Popover Modal */}
        {schedulingTask && (
          <Card t={t} style={{ borderColor: t.a1, padding: 16, marginBottom: 14, background: t.surface2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={15} color={t.a1} /> Schedule "{schedulingTask.title}"
              </div>
              <X size={16} color={t.muted} style={{ cursor: "pointer" }} onClick={() => setSchedulingTask(null)} />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 11, color: t.muted, marginBottom: 4 }}>Date</div>
                <input
                  type="date"
                  style={inputStyle(t)}
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                />
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 11, color: t.muted, marginBottom: 4 }}>Time</div>
                <input
                  type="time"
                  style={inputStyle(t)}
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                />
              </div>
              <div style={{ alignSelf: "flex-end", paddingTop: 18 }}>
                <PrimaryButton t={t} onClick={handleScheduleSubmit} style={{ width: "auto", padding: "10px 18px", fontSize: 13 }}>
                  Add to Timetable
                </PrimaryButton>
              </div>
            </div>
          </Card>
        )}

        {/* Task List */}
        {filteredTasks.length === 0 ? (
          <Empty t={t} text={searchQuery ? `No tasks found matching "${searchQuery}"` : "No tasks found in this view."} />
        ) : (
          filteredTasks.map(x => {
            const isScheduled = timetable.some(b => b.taskId === x.id);
            return (
              <Card
                t={t}
                key={x.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 16px",
                  opacity: x.done ? 0.6 : 1,
                  background: x.done ? t.surface2 : t.surface,
                  border: `1px solid ${x.priority === "High" && !x.done ? `${t.a1}55` : t.line}`
                }}
              >
                {/* Custom Checkbox */}
                <div
                  onClick={() => toggle(x)}
                  className="press"
                  style={{
                    width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${t[PRI_KEY[x.priority]] || t.a1}`,
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
                    background: x.done ? (t[PRI_KEY[x.priority]] || t.a1) : "transparent",
                    transition: "all .15s ease"
                  }}
                >
                  {x.done && <Check size={14} color={t.bg} />}
                </div>

                {/* Title and metadata */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: x.done ? 400 : 500,
                    color: t.text,
                    textDecoration: x.done ? "line-through" : "none",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {x.title}
                  </div>
                  <div style={{ fontSize: 11, color: t[PRI_KEY[x.priority]] || t.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{x.priority} priority</span>
                    {isScheduled && (
                      <span style={{ color: t.a1, display: "flex", alignItems: "center", gap: 3 }}>
                        <Calendar size={11} /> In Timetable
                      </span>
                    )}
                  </div>
                </div>

                {/* Action: Focus Sprint */}
                {!x.done && onOpenFocusWithTask && (
                  <button
                    onClick={() => onOpenFocusWithTask(x.id)}
                    title="Focus on this task in Focus Studio"
                    className="press"
                    style={{
                      padding: "5px 9px", borderRadius: 8, border: `1px solid ${t.a1}44`,
                      background: `${t.a1}15`, color: t.a1, fontSize: 11.5, fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 5, cursor: "pointer"
                    }}
                  >
                    <Headphones size={13} /> Focus
                  </button>
                )}

                {/* Action: Schedule */}
                {!x.done && (
                  <button
                    onClick={() => setSchedulingTask(x)}
                    title="Schedule in Timetable"
                    className="press"
                    style={{
                      padding: "5px 9px", borderRadius: 8, border: `1px solid ${t.line}`,
                      background: t.surface2, color: t.text, fontSize: 11.5, fontWeight: 500,
                      display: "flex", alignItems: "center", gap: 4, cursor: "pointer"
                    }}
                  >
                    <Clock size={12} color={t.muted} /> Schedule
                  </button>
                )}

                {/* Delete Button */}
                <button
                  onClick={() => remove(x.id)}
                  style={{
                    background: "transparent", border: "none", color: t.muted,
                    cursor: "pointer", padding: 4, display: "flex", alignItems: "center"
                  }}
                  title="Delete task"
                >
                  <X size={16} />
                </button>
              </Card>
            );
          })
        )}

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11.5, color: t.muted, opacity: 0.85, paddingBottom: 16 }}>
          This website is designed by <strong style={{ color: t.a1, fontWeight: 700 }}>Buraq Studios</strong> · Copyright all rights reserved.
        </div>
      </div>
    </Screen>
  );
}
