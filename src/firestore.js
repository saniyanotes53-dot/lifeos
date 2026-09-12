import { supabase, tableName } from "./supabase";
import { parseLocalDate } from "./utils/dates";

export function watchCollection(uid, name, onChange, orderField = null) {
  const table = tableName(name);
  let active = true;

  async function fetchInitial() {
    let query = supabase.from(table).select("*").eq("user_id", uid);
    if (orderField) query = query.order(orderField, { ascending: false });
    const { data, error } = await query;
    if (error) {
      const { data: fallback } = await supabase.from(table).select("*").eq("user_id", uid);
      if (active && fallback) onChange(fallback);
    } else if (active && data) {
      onChange(data);
    }
  }

  fetchInitial();

  const channel = supabase
    .channel(`public:${table}:user_id=eq.${uid}`)
    .on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${uid}` }, () => {
      fetchInitial();
    })
    .subscribe();

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
}

export async function ensureUserProfile(user) {
  if (!user?.uid) return;
  const { error } = await supabase.from("profiles").upsert({
    id: user.uid,
    email: user.email || null,
    display_name: user.displayName || user.email?.split("@")[0] || "User",
  }, { onConflict: "id" });
  if (error) throw error;
}

export async function addItem(uid, name, data) {
  const table = tableName(name);
  let payload = { ...data, user_id: uid };

  if (name === "timetable" && parseLocalDate(data.date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(data.time || "")) {
    const when = parseLocalDate(data.date);
    const [h, m] = data.time.split(":").map(Number);
    when.setHours(h, m, 0, 0);
    payload = { ...payload, remind_at: when.getTime() };
  }

  const { data: inserted, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return inserted;
}

export async function updateItem(uid, name, id, patch) {
  const table = tableName(name);
  const { data, error } = await supabase.from(table).update(patch).eq("id", id).eq("user_id", uid).select().single();
  if (error) throw error;
  return data;
}

export async function deleteItem(uid, name, id) {
  const table = tableName(name);
  const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", uid);
  if (error) throw error;
}

export async function saveSleep(uid, date, data) {
  const { data: existing } = await supabase
    .from("sleep_records")
    .select("id")
    .eq("user_id", uid)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    return updateItem(uid, "sleep", existing.id, { ...data, date });
  }
  return addItem(uid, "sleep", { ...data, date });
}

export async function updateProfile(uid, patch) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
  if (error) throw error;
}

export async function savePushToken(uid, token) {
  const { data: existing } = await supabase
    .from("push_tokens")
    .select("id")
    .eq("user_id", uid)
    .eq("token", token)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("push_tokens").insert({ user_id: uid, token });
    if (error) throw error;
  }
}
