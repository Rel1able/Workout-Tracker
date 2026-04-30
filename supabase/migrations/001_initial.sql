-- ============================================================
-- Workout Tracker – Initial Migration
-- Run this in Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. PROFILES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────
-- 2. EXERCISES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exercises (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Everyone can read exercises (global defaults + their own)
CREATE POLICY "Anyone can view exercises"
  ON public.exercises FOR SELECT
  USING (created_by IS NULL OR auth.uid() = created_by);

-- Authenticated users can add custom exercises
CREATE POLICY "Users can insert their own exercises"
  ON public.exercises FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own exercises"
  ON public.exercises FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own exercises"
  ON public.exercises FOR DELETE
  USING (auth.uid() = created_by);

-- Seed default exercises
INSERT INTO public.exercises (name, created_by) VALUES
  ('Pull-ups',             NULL),
  ('Push-ups',             NULL),
  ('Dumbbell Rows',        NULL),
  ('Dips',                 NULL),
  ('Squats',               NULL),
  ('Pistol Squats',        NULL),
  ('Bulgarian Split Squat',NULL),
  ('Lunges',               NULL),
  ('Bench Press',          NULL),
  ('Lateral Raises',       NULL),
  ('Rear Delt Raises',     NULL)
ON CONFLICT (name) DO NOTHING;

-- ──────────────────────────────────────────────
-- 3. WORKOUT TEMPLATES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_templates (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own templates"
  ON public.workout_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 4. TEMPLATE EXERCISES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.template_exercises (
  id          BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES public.workout_templates ON DELETE CASCADE,
  exercise_id BIGINT NOT NULL REFERENCES public.exercises ON DELETE CASCADE,
  sort_order  INT NOT NULL DEFAULT 0,
  UNIQUE (template_id, exercise_id)
);

ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own template exercises"
  ON public.template_exercises FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_templates t
      WHERE t.id = template_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_templates t
      WHERE t.id = template_id AND t.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────
-- 5. WORKOUTS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workouts (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  notes        TEXT,
  UNIQUE (user_id, workout_date)
);

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workouts"
  ON public.workouts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS workouts_user_date_idx ON public.workouts (user_id, workout_date);

-- ──────────────────────────────────────────────
-- 6. WORKOUT EXERCISES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id          BIGSERIAL PRIMARY KEY,
  workout_id  BIGINT NOT NULL REFERENCES public.workouts ON DELETE CASCADE,
  exercise_id BIGINT NOT NULL REFERENCES public.exercises ON DELETE CASCADE,
  sort_order  INT NOT NULL DEFAULT 0
);

ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workout exercises"
  ON public.workout_exercises FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────
-- 7. WORKOUT SETS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id                  BIGSERIAL PRIMARY KEY,
  workout_exercise_id BIGINT NOT NULL REFERENCES public.workout_exercises ON DELETE CASCADE,
  set_number          INT NOT NULL,
  reps                INT,
  weight_kg           FLOAT
);

ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workout sets"
  ON public.workout_sets FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.workout_exercises we
      JOIN public.workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workout_exercises we
      JOIN public.workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────
-- 8. PERSONAL RECORDS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personal_records (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  exercise_id BIGINT NOT NULL REFERENCES public.exercises ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('max_weight', 'max_reps')),
  value       FLOAT NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  workout_id  BIGINT REFERENCES public.workouts ON DELETE SET NULL,
  UNIQUE (user_id, exercise_id, record_type)
);

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own PRs"
  ON public.personal_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS pr_user_exercise_idx ON public.personal_records (user_id, exercise_id);
