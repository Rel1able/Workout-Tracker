// ────────────────────────────────────────────────
// Database row types (mirror Supabase schema)
// ────────────────────────────────────────────────

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface Exercise {
  id: number;
  name: string;
  created_by: string | null;
}

export interface WorkoutTemplate {
  id: number;
  user_id: string;
  name: string;
  created_at: string;
  template_exercises?: TemplateExercise[];
}

export interface TemplateExercise {
  id: number;
  template_id: number;
  exercise_id: number;
  sort_order: number;
  exercise?: Exercise;
}

export interface Workout {
  id: number;
  user_id: string;
  workout_date: string; // 'YYYY-MM-DD'
  started_at: string | null;
  finished_at: string | null;
  notes: string | null;
}

export interface WorkoutExercise {
  id: number;
  workout_id: number;
  exercise_id: number;
  sort_order: number;
  exercise?: Exercise;
  workout_sets?: WorkoutSet[];
}

export interface WorkoutSet {
  id: number;
  workout_exercise_id: number;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
}

export interface PersonalRecord {
  id: number;
  user_id: string;
  exercise_id: number;
  record_type: 'max_weight' | 'max_reps';
  value: number;
  achieved_at: string;
  workout_id: number | null;
  exercise?: Exercise;
}

// ────────────────────────────────────────────────
// Local session types (in-memory during workout)
// ────────────────────────────────────────────────

export interface SessionSet {
  /** Temporary client-side ID (not yet in DB) */
  localId: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
}

export interface SessionExercise {
  /** Temporary client-side ID */
  localId: string;
  exercise_id: number | null;
  exercise_name: string;
  sort_order: number;
  sets: SessionSet[];
}
