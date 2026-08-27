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

// ─── One-rep-max estimation (Epley) ──────────────────────────────────────────

/** Past this many reps the Epley estimate drifts high; results are flagged. */
export const E1RM_REP_LIMIT = 12

/** Epley: 1RM = weight × (1 + reps/30). Returns 0 for unusable input. */
export function epley1RM(weightKg: number | null, reps: number | null): number {
  const w = weightKg ?? 0
  const r = reps ?? 0
  if (w <= 0 || r <= 0) return 0
  return w * (1 + r / 30)
}

/** Inverse Epley: the weight you would expect to move for `reps` at this 1RM. */
export function weightForReps(oneRm: number, reps: number): number {
  return oneRm / (1 + reps / 30)
}

export interface Estimated1RM {
  /** Estimated one-rep max in kg. */
  value: number
  /** The set the estimate came from. */
  weight: number
  reps: number
  /** False when that set used more reps than the formula handles well. */
  reliable: boolean
}

/** Best estimated 1RM across a group of sets, or null if none are usable. */
export function best1RM(sets: Pick<WorkoutSet, 'reps' | 'weight_kg'>[]): Estimated1RM | null {
  let best: Estimated1RM | null = null
  for (const s of sets) {
    const value = epley1RM(s.weight_kg, s.reps)
    if (value <= 0) continue
    if (!best || value > best.value) {
      best = {
        value,
        weight: s.weight_kg ?? 0,
        reps: s.reps ?? 0,
        reliable: (s.reps ?? 0) <= E1RM_REP_LIMIT,
      }
    }
  }
  return best
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
  /** Best estimated 1RM of that session, 0 when no set had both weight and reps. */
  est1RM: number
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
        est1RM: Math.round((best1RM(sets)?.value ?? 0) * 10) / 10,
      })
    }
  }
  return points.sort((a, b) => (a.date < b.date ? -1 : 1))
}

// ─── Per-exercise trends (recent window vs the window before it) ─────────────

/** Length of the comparison window used by `buildExerciseTrends`, in days. */
export const TREND_WINDOW_DAYS = 30

export interface ExerciseTrend {
  exerciseId: number
  name: string
  windowDays: number
  /** Sessions containing this exercise, current window / preceding window. */
  sessions: number
  previousSessions: number
  volume: number
  previousVolume: number
  /**
   * Percent change vs the preceding window. Null when that window had no
   * volume at all — bodyweight work scores 0, and there is no percentage
   * change from zero. `startedLoading` covers that case instead.
   */
  volumeChangePct: number | null
  best1RM: number
  previousBest1RM: number
  oneRmChangePct: number | null
  topWeight: number
  previousTopWeight: number
  /** Trained before but unloaded; now carrying weight. Growth, no percentage. */
  startedLoading: boolean
}

interface TrendBucket {
  volume: number
  sessions: number
  best1RM: number
  topWeight: number
}

function emptyBucket(): TrendBucket {
  return { volume: 0, sessions: 0, best1RM: 0, topWeight: 0 }
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

/**
 * For every exercise in `history`, compare the last `windowDays` against the
 * `windowDays` before that. Single pass — call once and reuse the result.
 */
export function buildExerciseTrends(
  history: DetailedWorkout[],
  windowDays = TREND_WINDOW_DAYS
): ExerciseTrend[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const curFrom = new Date(today)
  curFrom.setDate(curFrom.getDate() - (windowDays - 1))
  const prevFrom = new Date(today)
  prevFrom.setDate(prevFrom.getDate() - (windowDays * 2 - 1))
  const curFromStr = isoDate(curFrom)
  const prevFromStr = isoDate(prevFrom)

  const acc = new Map<number, { name: string; cur: TrendBucket; prev: TrendBucket }>()

  for (const w of history) {
    const inCurrent = w.workout_date >= curFromStr
    const inPrevious = !inCurrent && w.workout_date >= prevFromStr
    if (!inCurrent && !inPrevious) continue

    for (const we of w.workout_exercises ?? []) {
      const sets = we.workout_sets ?? []
      if (sets.length === 0) continue

      let entry = acc.get(we.exercise_id)
      if (!entry) {
        entry = { name: we.exercise?.name ?? 'Unknown', cur: emptyBucket(), prev: emptyBucket() }
        acc.set(we.exercise_id, entry)
      }
      const bucket = inCurrent ? entry.cur : entry.prev
      bucket.sessions++
      bucket.volume += sets.reduce((sum, s) => sum + setVolume(s), 0)
      bucket.best1RM = Math.max(bucket.best1RM, best1RM(sets)?.value ?? 0)
      bucket.topWeight = Math.max(bucket.topWeight, ...sets.map(s => s.weight_kg ?? 0))
    }
  }

  return [...acc.entries()].map(([exerciseId, e]) => ({
    exerciseId,
    name: e.name,
    windowDays,
    sessions: e.cur.sessions,
    previousSessions: e.prev.sessions,
    volume: Math.round(e.cur.volume),
    previousVolume: Math.round(e.prev.volume),
    volumeChangePct: pctChange(e.cur.volume, e.prev.volume),
    best1RM: Math.round(e.cur.best1RM * 10) / 10,
    previousBest1RM: Math.round(e.prev.best1RM * 10) / 10,
    oneRmChangePct: pctChange(e.cur.best1RM, e.prev.best1RM),
    topWeight: e.cur.topWeight,
    previousTopWeight: e.prev.topWeight,
    startedLoading: e.prev.volume === 0 && e.cur.volume > 0 && e.prev.sessions > 0,
  }))
}

/**
 * Trends worth calling out: trained in both windows and carrying volume in at
 * least one of them. Newly loaded exercises lead (growth from zero has no
 * percentage), then the biggest swings. A 0% change sorts last.
 */
export function topMovers(trends: ExerciseTrend[], limit = 3): ExerciseTrend[] {
  return trends
    .filter(
      t =>
        t.sessions > 0 &&
        t.previousSessions > 0 &&
        (t.volumeChangePct !== null || t.startedLoading)
    )
    .sort((a, b) => {
      if (a.startedLoading !== b.startedLoading) return a.startedLoading ? -1 : 1
      return Math.abs(b.volumeChangePct ?? 0) - Math.abs(a.volumeChangePct ?? 0)
    })
    .slice(0, limit)
}
