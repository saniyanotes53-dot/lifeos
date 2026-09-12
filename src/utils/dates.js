// Calendar dates belong to the user's local day. ISO timestamps remain UTC.
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return localDateKey(date) === value ? date : null;
}

export function shiftDate(value, days) {
  const date = parseLocalDate(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function dateRange(days = 7, today = localDateKey()) {
  return { start: shiftDate(today, -(days - 1)), end: today };
}

export function inDateRange(value, range) {
  return Boolean(parseLocalDate(value)) && value >= range.start && value <= range.end;
}

export function formatDate(value, options = { day: "numeric", month: "short" }) {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString(undefined, options) : "Unknown date";
}

export function weekDates(value) {
  const date = parseLocalDate(value);
  if (!date) return [];
  const monday = shiftDate(value, -(date.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}
