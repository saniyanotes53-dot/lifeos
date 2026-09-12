import { dateRange, inDateRange, localDateKey, parseLocalDate } from "./dates.js";

export const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export const money = value => `₹${numeric(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function filterPeriod(records, days, today = localDateKey()) {
  const range = dateRange(days, today);
  return records.filter(record => inDateRange(record.date, range));
}

export function sleepByDay(records, range) {
  const groups = new Map();
  for (const record of records) {
    const hours = Number(record.hours);
    if (!parseLocalDate(record.date) || (range && !inDateRange(record.date, range)) ||
        record.hours == null || record.hours === "" || !Number.isFinite(hours) || hours < 0 || hours > 24) continue;
    const group = groups.get(record.date) || [];
    group.push(record);
    groups.set(record.date, group);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => {
    // New sleep logs use a stable date ID. Keep legacy records without deleting them.
    const savedNight = entries.find(entry => entry.id === date);
    const hours = savedNight ? Number(savedNight.hours) : entries.reduce((sum, entry) => sum + Number(entry.hours), 0) / entries.length;
    return { date, hours: Math.round(hours * 10) / 10, entries: savedNight ? 1 : entries.length };
  });
}

export function dailySpending(records) {
  const groups = new Map();
  for (const record of records) {
    if (record.type !== "expense" || !parseLocalDate(record.date)) continue;
    groups.set(record.date, (groups.get(record.date) || 0) + numeric(record.amount));
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));
}

export function monthlyTransactions(records, today = localDateKey(), count = 6) {
  const now = parseLocalDate(today);
  if (!now) return [];
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - count + 1 + i, 1, 12);
    const key = localDateKey(date).slice(0, 7);
    const period = records.filter(record => parseLocalDate(record.date) && record.date.startsWith(key) && record.date <= today);
    return {
      key,
      month: date.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      spent: period.filter(x => x.type === "expense").reduce((sum, x) => sum + numeric(x.amount), 0),
      income: period.filter(x => x.type === "income").reduce((sum, x) => sum + numeric(x.amount), 0),
    };
  });
}

export function percentage(value, max) {
  if (!(numeric(max) > 0)) return "0";
  const result = Math.max(0, numeric(value) / numeric(max) * 100);
  if (result > 0 && result < 0.1) return "<0.1";
  return result.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

export function nutritionStatus(meals, target, today = localDateKey()) {
  const valid = meals.filter(x => x.date === today && numeric(x.cal) > 0);
  const total = valid.reduce((sum, x) => sum + numeric(x.cal), 0);
  return {
    total,
    hasLogs: valid.length > 0,
    badge: valid.length ? "Logged so far" : "Not logged",
    text: valid.length ? `${total} kcal recorded against a ${target} kcal daily target. This may be a partial day's log.` : "No meals logged today. Nutrition progress is unknown.",
  };
}
