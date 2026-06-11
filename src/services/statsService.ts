import { supabase } from '../lib/supabase'
import { Workout, WorkoutExercise, WorkoutSet } from '../types/database'

export type DetailedWorkout = Workout & { workout_exercises: WorkoutExercise[] }

/**
 * Fetch all finished workouts (with exercises + sets), newest first.
 * Optionally limited to dates >= `from` ('YYYY-MM-DD').
 */
export async function fetchWorkoutHistory(
  userId: string,
  from?: string
): Promise<DetailedWorkout[]> {
  let query = supabase
    .from('workouts')
    .select(`
      *,
      workout_exercises (
        *,
        exercise:exercises (*),
        workout_sets (*)
      )
    `)
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('workout_date', { ascending: false })

  if (from) query = query.gte('workout_date', from)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as DetailedWorkout[]
}

export interface LastPerformance {
  date: string
  sets: { set_number: number; reps: number | null; weight_kg: number | null }[]
}

/**
 * Map exercise_id -> sets from the most recent finished workout containing it,
 * excluding workouts on `excludeDate` (the session being edited).
 */
export function buildLastPerformanceMap(
  history: DetailedWorkout[],
  excludeDate?: string
): Map<number, LastPerformance> {
  const map = new Map<number, LastPerformance>()
  // history is newest-first; first hit per exercise wins
  for (const w of history) {
    if (excludeDate && w.workout_date === excludeDate) continue
    for (const we of w.workout_exercises ?? []) {
      if (map.has(we.exercise_id)) continue
      const sets = (we.workout_sets ?? [])
        .slice()
        .sort((a, b) => a.set_number - b.set_number)
        .map(s => ({ set_number: s.set_number, reps: s.reps, weight_kg: s.weight_kg }))
      if (sets.length > 0) {
        map.set(we.exercise_id, { date: w.workout_date, sets })
      }
    }
  }
  return map
}

export function setVolume(s: Pick<WorkoutSet, 'reps' | 'weight_kg'>): number {
  return (s.reps ?? 0) * (s.weight_kg ?? 0)
}

export function workoutVolume(w: DetailedWorkout): number {
  return (w.workout_exercises ?? []).reduce(
    (sum, we) => sum + (we.workout_sets ?? []).reduce((s2, s) => s2 + setVolume(s), 0),
    0
  )
}

export interface OverviewStats {
  total: number
  thisWeek: number
  thisMonth: number
  monthVolume: number
  streakWeeks: number
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Monday of the week containing `d`. */
function weekStart(d: Date): Date {
  const copy = new Date(d)
  const day = (copy.getDay() + 6) % 7 // Mon=0 … Sun=6
  copy.setDate(copy.getDate() - day)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function computeOverviewStats(history: DetailedWorkout[]): OverviewStats {
  const now = new Date()
  const wkStart = isoDate(weekStart(now))
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const thisWeek = history.filter(w => w.workout_date >= wkStart).length
  const monthWorkouts = history.filter(w => w.workout_date >= monthStart)

  // Streak: consecutive calendar weeks (incl. current) with >= 1 workout
  const weekSet = new Set(
    history.map(w => isoDate(weekStart(new Date(w.workout_date + 'T12:00:00'))))
  )
  let streakWeeks = 0
  const cursor = weekStart(now)
  // Current week counts if it has a workout; otherwise streak continues from last week
  if (!weekSet.has(isoDate(cursor))) cursor.setDate(cursor.getDate() - 7)
  while (weekSet.has(isoDate(cursor))) {
    streakWeeks++
    cursor.setDate(cursor.getDate() - 7)
  }

  return {
    total: history.length,
    thisWeek,
    thisMonth: monthWorkouts.length,
    monthVolume: Math.round(monthWorkouts.reduce((s, w) => s + workoutVolume(w), 0)),
    streakWeeks,
  }
}

export interface ExercisePoint {
  date: string
  maxWeight: number
  maxReps: number
  volume: number
}

/** Chronological series for one exercise across the workout history. */
export function buildExerciseSeries(
  history: DetailedWorkout[],
  exerciseId: number
): ExercisePoint[] {
  const points: ExercisePoint[] = []
  for (const w of history) {
    for (const we of w.workout_exercises ?? []) {
      if (we.exercise_id !== exerciseId) continue
      const sets = we.workout_sets ?? []
      if (sets.length === 0) continue
      points.push({
        date: w.workout_date,
        maxWeight: Math.max(0, ...sets.map(s => s.weight_kg ?? 0)),
        maxReps: Math.max(0, ...sets.map(s => s.reps ?? 0)),
        volume: sets.reduce((s2, s) => s2 + setVolume(s), 0),
      })
    }
  }
  return points.sort((a, b) => (a.date < b.date ? -1 : 1))
}
