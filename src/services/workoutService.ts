import { supabase } from '../lib/supabase'
import { Workout, WorkoutExercise, SessionExercise } from '../types/database'

/** Fetch all workout dates for a user in a date range (for calendar highlighting) */
export async function fetchWorkoutDates(
  userId: string,
  from: string,
  to: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('workout_date')
    .eq('user_id', userId)
    .gte('workout_date', from)
    .lte('workout_date', to)

  if (error) throw new Error(error.message)
  return (data as { workout_date: string }[]).map(r => r.workout_date)
}

/** Fetch a single workout with all exercises and sets for a given date */
export async function fetchWorkoutByDate(
  userId: string,
  date: string
): Promise<(Workout & { workout_exercises: WorkoutExercise[] }) | null> {
  const { data, error } = await supabase
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
    .eq('workout_date', date)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as (Workout & { workout_exercises: WorkoutExercise[] }) | null
}

/**
 * Persist a completed workout session to the database.
 * Returns the newly created workout row and any new PRs.
 */
export async function saveWorkout(
  userId: string,
  date: string,
  startedAt: string,
  sessionExercises: SessionExercise[]
): Promise<{ workout: Workout; newPRs: string[] }> {
  const finishedAt = new Date().toISOString()

  // 1. Insert workout row
  const { data: workoutData, error: workoutErr } = await supabase
    .from('workouts')
    .insert({
      user_id: userId,
      workout_date: date,
      started_at: startedAt,
      finished_at: finishedAt,
    })
    .select()
    .single()

  if (workoutErr) throw new Error(workoutErr.message)
  const workout = workoutData as Workout

  // 2. Insert exercises and sets
  for (let i = 0; i < sessionExercises.length; i++) {
    const ex = sessionExercises[i]
    if (!ex.exercise_id) continue

    // Filter non-empty sets
    const validSets = ex.sets.filter(
      s => (s.reps !== null && s.reps > 0) || (s.weight_kg !== null && s.weight_kg > 0)
    )

    const { data: weData, error: weErr } = await supabase
      .from('workout_exercises')
      .insert({
        workout_id: workout.id,
        exercise_id: ex.exercise_id,
        sort_order: i,
      })
      .select()
      .single()

    if (weErr) throw new Error(weErr.message)
    const we = weData as WorkoutExercise

    if (validSets.length > 0) {
      const setRows = validSets.map(s => ({
        workout_exercise_id: we.id,
        set_number: s.set_number,
        reps: s.reps,
        weight_kg: s.weight_kg,
      }))

      const { error: setsErr } = await supabase.from('workout_sets').insert(setRows)
      if (setsErr) throw new Error(setsErr.message)
    }
  }

  // 3. Calculate PRs
  const newPRs = await calculateAndSavePRs(userId, workout.id, sessionExercises)

  return { workout, newPRs }
}

/**
 * After saving a workout, compute max_weight and max_reps per exercise
 * and upsert into personal_records if the new values beat existing records.
 */
async function calculateAndSavePRs(
  userId: string,
  workoutId: number,
  sessionExercises: SessionExercise[]
): Promise<string[]> {
  const newPRLabels: string[] = []

  for (const ex of sessionExercises) {
    if (!ex.exercise_id) continue

    const validSets = ex.sets.filter(
      s => (s.reps !== null && s.reps > 0) || (s.weight_kg !== null && s.weight_kg > 0)
    )
    if (validSets.length === 0) continue

    const maxWeight = Math.max(0, ...validSets.map(s => s.weight_kg ?? 0))
    const maxReps = Math.max(0, ...validSets.map(s => s.reps ?? 0))

    // Fetch existing PRs for this exercise
    const { data: existingPRs } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId)
      .eq('exercise_id', ex.exercise_id)

    const existing = (existingPRs ?? []) as {
      record_type: string; value: number
    }[]

    const existingWeight = existing.find(r => r.record_type === 'max_weight')
    const existingReps = existing.find(r => r.record_type === 'max_reps')

    // Upsert max_weight if improved
    if (maxWeight > 0 && (!existingWeight || maxWeight > existingWeight.value)) {
      await supabase.from('personal_records').upsert(
        {
          user_id: userId,
          exercise_id: ex.exercise_id,
          record_type: 'max_weight',
          value: maxWeight,
          achieved_at: new Date().toISOString(),
          workout_id: workoutId,
        },
        { onConflict: 'user_id,exercise_id,record_type' }
      )
      newPRLabels.push(`${ex.exercise_name}: ${maxWeight} kg (max weight)`)
    }

    // Upsert max_reps if improved
    if (maxReps > 0 && (!existingReps || maxReps > existingReps.value)) {
      await supabase.from('personal_records').upsert(
        {
          user_id: userId,
          exercise_id: ex.exercise_id,
          record_type: 'max_reps',
          value: maxReps,
          achieved_at: new Date().toISOString(),
          workout_id: workoutId,
        },
        { onConflict: 'user_id,exercise_id,record_type' }
      )
      newPRLabels.push(`${ex.exercise_name}: ${maxReps} reps (max reps)`)
    }
  }

  return newPRLabels
}
