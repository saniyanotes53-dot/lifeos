import React, { useState } from "react";
import { Plus, Check, X, Calendar, Clock, CheckSquare } from "lucide-react";
import { inputStyle, todayStr, PRI_KEY } from "../theme";
import { Card, Screen, Empty, PrimaryButton, GhostButton } from "./primitives";
import { addItem, updateItem, deleteItem } from "../firestore";

export default function TasksScreen({ t, tasks, userId, timetable = [] }) {
  const [title, setTitle] = useState("");
  const [pri, setPri] = useState("Med");
  const [schedulingTask, setSchedulingTask] = useState(null); // task being scheduled
  const [scheduleDate, setScheduleDate] = useState(todayStr());
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [schedMsg, setSchedMsg] = useState("");

  const order = { High: 0, Med: 1, Low: 2 };
  const sorted = [...tasks].sort((a, b) => (a.done - b.done) || (order[a.priority] - order[b.priority]));

  const add = async () => {
    if (!title.trim()) return;
    await addItem(userId, "tasks", { title: title.trim(), priority: pri, done: false, date: todayStr() });
    setTitle("");
  };

  const toggle = async (task) => {
    const nextDone = !task.done;
    await updateItem(userId, "tasks", task.id, { done: nextDone });

    // Also update any linked timetable blocks
    const linkedBlocks = timetable.filter(b => b.taskId === task.id);
    for (const b of linkedBlocks) {
      await updateItem(userId, "timetable", b.id, { done: nextDone });
    }
  };

  const remove = async (id) => {
    await deleteItem(userId, "tasks", id);
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
    setSchedMsg(`Scheduled for ${scheduleDate} at ${scheduleTime}!`);
    setTimeout(() => {
      setSchedMsg("");
      setSchedulingTask(null);
    }, 1200);
  };

  return (
    <Screen t={t} title="Tasks">
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Card t={t}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle(t), flex: 1 }}
              placeholder="Add a task…"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && add()}
            />
            <select
              style={{ ...inputStyle(t), width: 84 }}
              value={pri}
              onChange={e => setPri(e.target.value)}
            >
              <option>High</option><option>Med</option><option>Low</option>
            </select>
            <button
              onClick={add}
              className="press"
              style={{
                width: 40, borderRadius: 10, border: "none",
                background: `linear-gradient(135deg, ${t.a1}, ${t.a3})`,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
              }}
            >
              <Plus size={18} color={t.onAccent} />
            </button>
          </div>
        </Card>

        {/* Schedule Modal/Popover */}
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
            {schedMsg && <div style={{ fontSize: 12, color: t.good, marginTop: 8 }}>{schedMsg}</div>}
          </Card>
        )}

        {sorted.length === 0 && <Empty t={t} text="No tasks yet. Add your first one above." />}
        {sorted.map(x => {
          const isScheduled = timetable.some(b => b.taskId === x.id);
          return (
            <Card t={t} key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, opacity: x.done ? 0.5 : 1 }}>
              <div onClick={() => toggle(x)} className="press" style={{
                width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${t[PRI_KEY[x.priority]]}`,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
                background: x.done ? t[PRI_KEY[x.priority]] : "transparent", transition: "background .15s ease"
              }}>{x.done && <Check size={14} color={t.bg} />}</div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: t.text, textDecoration: x.done ? "line-through" : "none" }}>{x.title}</div>
                <div style={{ fontSize: 10.5, color: t[PRI_KEY[x.priority]], marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{x.priority} priority</span>
                  {isScheduled && (
                    <span style={{ color: t.a1, display: "flex", alignItems: "center", gap: 3 }}>
                      <Calendar size={11} /> In Timetable
                    </span>
                  )}
                </div>
              </div>

              {!x.done && (
                <button
                  onClick={() => setSchedulingTask(x)}
                  title="Schedule in Timetable"
                  className="press"
                  style={{
                    padding: "4px 8px", borderRadius: 8, border: `1px solid ${t.line}`,
                    background: t.surface2, color: t.a1, fontSize: 11.5, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 4, cursor: "pointer"
                  }}
                >
                  <Clock size={12} /> Schedule
                </button>
              )}

              <X size={16} color={t.muted} style={{ cursor: "pointer" }} onClick={() => remove(x.id)} />
            </Card>
          );
        })}

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11.5, color: t.muted, opacity: 0.85, paddingBottom: 16 }}>
          This website is designed by <strong style={{ color: t.a1, fontWeight: 700 }}>Buraq Studios</strong> · Copyright all rights reserved.
        </div>
      </div>
    </Screen>
  );
}
