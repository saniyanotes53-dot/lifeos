/*
# Life OS — Complete Database Schema

Creates all tables for the Life OS personal productivity app:
tasks, sleep records, workouts, meals, transactions, timetable blocks,
wallets, category budgets, loans, body metrics, push tokens, and user profiles.

Each table is owner-scoped (user_id) with full RLS — users can only
access their own rows. Owner columns default to auth.uid() so frontend
inserts that omit user_id still succeed.

## Tables
1. profiles — user display name, email, notification prefs
2. tasks — title, priority, done, date
3. sleep_records — date, hours, quality
4. workouts — date, type, minutes, calories
5. meals — date, name, calories, protein
6. transactions — date, amount, type, category, wallet_id
7. timetable_blocks — date, time, label, done, task_id
8. wallets — name, balance, type
9. category_budgets — category, limit, period
10. loans — person, amount, type (borrow/lend), settled
11. body_metrics — date, weight, waist, etc.
12. push_tokens — token, platform

## Security
- RLS enabled on every table
- 4 policies per table (SELECT/INSERT/UPDATE/DELETE) scoped to authenticated
- Ownership check: auth.uid() = user_id
*/

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  notif_weekly_digest boolean DEFAULT true,
  notif_monthly_digest boolean DEFAULT true,
  notif_timetable_reminders boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profiles" ON profiles;
CREATE POLICY "select_own_profiles" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profiles" ON profiles;
CREATE POLICY "insert_own_profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profiles" ON profiles;
CREATE POLICY "update_own_profiles" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "delete_own_profiles" ON profiles;
CREATE POLICY "delete_own_profiles" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  priority text DEFAULT 'Med',
  done boolean DEFAULT false,
  date text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date DESC);

DROP POLICY IF EXISTS "select_own_tasks" ON tasks;
CREATE POLICY "select_own_tasks" ON tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_tasks" ON tasks;
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_tasks" ON tasks;
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_tasks" ON tasks;
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Sleep records
CREATE TABLE IF NOT EXISTS sleep_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  hours numeric DEFAULT 0,
  quality text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sleep_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sleep_user ON sleep_records(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_date ON sleep_records(date DESC);

DROP POLICY IF EXISTS "select_own_sleep" ON sleep_records;
CREATE POLICY "select_own_sleep" ON sleep_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_sleep" ON sleep_records;
CREATE POLICY "insert_own_sleep" ON sleep_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_sleep" ON sleep_records;
CREATE POLICY "update_own_sleep" ON sleep_records FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_sleep" ON sleep_records;
CREATE POLICY "delete_own_sleep" ON sleep_records FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Workouts
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  type text,
  minutes integer DEFAULT 0,
  calories integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date DESC);

DROP POLICY IF EXISTS "select_own_workouts" ON workouts;
CREATE POLICY "select_own_workouts" ON workouts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_workouts" ON workouts;
CREATE POLICY "insert_own_workouts" ON workouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_workouts" ON workouts;
CREATE POLICY "update_own_workouts" ON workouts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_workouts" ON workouts;
CREATE POLICY "delete_own_workouts" ON workouts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Meals
CREATE TABLE IF NOT EXISTS meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  name text,
  calories integer DEFAULT 0,
  protein integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_meals_user ON meals(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date DESC);

DROP POLICY IF EXISTS "select_own_meals" ON meals;
CREATE POLICY "select_own_meals" ON meals FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meals" ON meals;
CREATE POLICY "insert_own_meals" ON meals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meals" ON meals;
CREATE POLICY "update_own_meals" ON meals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meals" ON meals;
CREATE POLICY "delete_own_meals" ON meals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  amount numeric DEFAULT 0,
  type text,
  category text,
  wallet_id uuid,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date DESC);

DROP POLICY IF EXISTS "select_own_tx" ON transactions;
CREATE POLICY "select_own_tx" ON transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_tx" ON transactions;
CREATE POLICY "insert_own_tx" ON transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_tx" ON transactions;
CREATE POLICY "update_own_tx" ON transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_tx" ON transactions;
CREATE POLICY "delete_own_tx" ON transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Timetable blocks
CREATE TABLE IF NOT EXISTS timetable_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  time text,
  label text,
  done boolean DEFAULT false,
  task_id uuid,
  remind_at bigint,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE timetable_blocks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_blocks_user ON timetable_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_blocks_date ON timetable_blocks(date DESC);

DROP POLICY IF EXISTS "select_own_blocks" ON timetable_blocks;
CREATE POLICY "select_own_blocks" ON timetable_blocks FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_blocks" ON timetable_blocks;
CREATE POLICY "insert_own_blocks" ON timetable_blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_blocks" ON timetable_blocks;
CREATE POLICY "update_own_blocks" ON timetable_blocks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_blocks" ON timetable_blocks;
CREATE POLICY "delete_own_blocks" ON timetable_blocks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Wallets
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  balance numeric DEFAULT 0,
  type text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

DROP POLICY IF EXISTS "select_own_wallets" ON wallets;
CREATE POLICY "select_own_wallets" ON wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_wallets" ON wallets;
CREATE POLICY "insert_own_wallets" ON wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_wallets" ON wallets;
CREATE POLICY "update_own_wallets" ON wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_wallets" ON wallets;
CREATE POLICY "delete_own_wallets" ON wallets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Category budgets
CREATE TABLE IF NOT EXISTS category_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  limit_amount numeric DEFAULT 0,
  period text DEFAULT 'monthly',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_catbudgets_user ON category_budgets(user_id);

DROP POLICY IF EXISTS "select_own_catbudgets" ON category_budgets;
CREATE POLICY "select_own_catbudgets" ON category_budgets FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_catbudgets" ON category_budgets;
CREATE POLICY "insert_own_catbudgets" ON category_budgets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_catbudgets" ON category_budgets;
CREATE POLICY "update_own_catbudgets" ON category_budgets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_catbudgets" ON category_budgets;
CREATE POLICY "delete_own_catbudgets" ON category_budgets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Loans (borrow/lend tracking)
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  person text,
  amount numeric DEFAULT 0,
  type text,
  settled boolean DEFAULT false,
  date text,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);

DROP POLICY IF EXISTS "select_own_loans" ON loans;
CREATE POLICY "select_own_loans" ON loans FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_loans" ON loans;
CREATE POLICY "insert_own_loans" ON loans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_loans" ON loans;
CREATE POLICY "update_own_loans" ON loans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_loans" ON loans;
CREATE POLICY "delete_own_loans" ON loans FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Body metrics
CREATE TABLE IF NOT EXISTS body_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  weight numeric,
  waist numeric,
  chest numeric,
  hips numeric,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bodymetrics_user ON body_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_bodymetrics_date ON body_metrics(date DESC);

DROP POLICY IF EXISTS "select_own_bodymetrics" ON body_metrics;
CREATE POLICY "select_own_bodymetrics" ON body_metrics FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_bodymetrics" ON body_metrics;
CREATE POLICY "insert_own_bodymetrics" ON body_metrics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_bodymetrics" ON body_metrics;
CREATE POLICY "update_own_bodymetrics" ON body_metrics FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_bodymetrics" ON body_metrics;
CREATE POLICY "delete_own_bodymetrics" ON body_metrics FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Push tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pushtokens_user ON push_tokens(user_id);

DROP POLICY IF EXISTS "select_own_pushtokens" ON push_tokens;
CREATE POLICY "select_own_pushtokens" ON push_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_pushtokens" ON push_tokens;
CREATE POLICY "insert_own_pushtokens" ON push_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_pushtokens" ON push_tokens;
CREATE POLICY "update_own_pushtokens" ON push_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_pushtokens" ON push_tokens;
CREATE POLICY "delete_own_pushtokens" ON push_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
