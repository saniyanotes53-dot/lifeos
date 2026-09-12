import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const COLLECTION_MAP = {
  tasks: "tasks",
  sleep: "sleep_records",
  workouts: "workouts",
  meals: "meals",
  transactions: "transactions",
  timetable: "timetable_blocks",
  wallets: "wallets",
  categoryBudgets: "category_budgets",
  loans: "loans",
  bodyMetrics: "body_metrics",
  pushTokens: "push_tokens",
};

export function tableName(collectionName) {
  return COLLECTION_MAP[collectionName] || collectionName;
}
