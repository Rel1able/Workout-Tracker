import { supabase } from '../lib/supabase'
import { Workout, WorkoutExercise, SessionExercise } from '../types/database'

/** Fetch all finished workout dates for a user in a date range (for calendar highlighting) */
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
    .not('finished_at', 'is', null)

  if (error) throw new Error(error.message)
  return (data as { workout_date: string }[]).map(r => r.workout_date)
}

/** Fetch the user's in-progress (draft) workout for a date, if any */
export async function fetchDraftWorkout(
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
    .is('finished_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as (Workout & { workout_exercises: WorkoutExercise[] }) | null
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

/** Delete a workout row (cascades to exercises/sets). */
export async function deleteWorkout(workoutId: number, userId: string): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', workoutId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

/**
 * Persist an in-progress (draft) workout. Does NOT set finished_at and does
 * NOT recompute PRs. Creates the row if `workoutId` is null, otherwise
 * replaces its exercises/sets. Returns the workoutId.
 */
export async function upsertWorkoutDraft(
  userId: string,
  workoutId: number | null,
  date: string,
  startedAt: string,
  sessionExercises: SessionExercise[]
): Promise<number> {
  let id = workoutId

  if (id == null) {
    // Reuse an existing draft for the same date if it exists; refuse to
    // touch a finished workout (caller must use the edit flow).
    const { data: existing, error: selErr } = await supabase
      .from('workouts')
      .select('id, finished_at')
      .eq('user_id', userId)
      .eq('workout_date', date)
      .maybeSingle()
    if (selErr) throw new Error(selErr.message)

    if (existing) {
      const row = existing as { id: number; finished_at: string | null }
      if (row.finished_at) {
        throw new Error('A finished workout already exists for this date.')
      }
      id = row.id
    } else {
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id: userId,
          workout_date: date,
          started_at: startedAt,
          finished_at: null,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      id = (data as Workout).id
    }
  } else {
    const { error } = await supabase
      .from('workouts')
      .update({ workout_date: date, started_at: startedAt })
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
  }

  await replaceWorkoutExercises(id, sessionExercises)
  return id
}

/** Mark a draft workout as finished and compute new PRs. */
export async function finishWorkout(
  userId: string,
  workoutId: number,
  sessionExercises: SessionExercise[]
): Promise<{ newPRs: string[] }> {
  const { error } = await supabase
    .from('workouts')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', workoutId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)

  const newPRs = await calculateAndSavePRs(userId, workoutId, sessionExercises)
  return { newPRs }
}

/** Replace all exercises/sets for a workout with the provided session data. */
async function replaceWorkoutExercises(
  workoutId: number,
  sessionExercises: SessionExercise[]
): Promise<void> {
  const { data: existingWE, error: weListErr } = await supabase
    .from('workout_exercises')
    .select('id')
    .eq('workout_id', workoutId)
  if (weListErr) throw new Error(weListErr.message)

  const weIds = (existingWE ?? []).map(r => (r as { id: number }).id)
  if (weIds.length > 0) {
    const { error: setsDelErr } = await supabase
      .from('workout_sets')
      .delete()
      .in('workout_exercise_id', weIds)
    if (setsDelErr) throw new Error(setsDelErr.message)

    const { error: weDelErr } = await supabase
      .from('workout_exercises')
      .delete()
      .eq('workout_id', workoutId)
    if (weDelErr) throw new Error(weDelErr.message)
  }

  for (let i = 0; i < sessionExercises.length; i++) {
    const ex = sessionExercises[i]
    if (!ex.exercise_id) continue

    const validSets = ex.sets.filter(
      s => (s.reps !== null && s.reps > 0) || (s.weight_kg !== null && s.weight_kg > 0)
    )

    const { data: weData, error: weErr } = await supabase
      .from('workout_exercises')
      .insert({
        workout_id: workoutId,
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
}

/**
 * Persist a workout session to the database. Creates a new row, or — when
 * `workoutId` is provided — replaces all exercises/sets on the existing row.
 * Returns the workout row and any new PRs.
 */
export async function saveWorkout(
  userId: string,
  date: string,
  startedAt: string,
  sessionExercises: SessionExercise[],
  workoutId?: number | null
): Promise<{ workout: Workout; newPRs: string[] }> {
  const finishedAt = new Date().toISOString()

  let workout: Workout

  if (workoutId) {
    // Update existing workout: clear its exercises/sets, then re-insert.
    const { data: existingWE, error: weListErr } = await supabase
      .from('workout_exercises')
      .select('id')
      .eq('workout_id', workoutId)
    if (weListErr) throw new Error(weListErr.message)

    const weIds = (existingWE ?? []).map(r => (r as { id: number }).id)
    if (weIds.length > 0) {
      const { error: setsDelErr } = await supabase
        .from('workout_sets')
        .delete()
        .in('workout_exercise_id', weIds)
      if (setsDelErr) throw new Error(setsDelErr.message)

      const { error: weDelErr } = await supabase
        .from('workout_exercises')
        .delete()
        .eq('workout_id', workoutId)
      if (weDelErr) throw new Error(weDelErr.message)
    }

    const { data: updated, error: updateErr } = await supabase
      .from('workouts')
      .update({ workout_date: date, finished_at: finishedAt })
      .eq('id', workoutId)
      .eq('user_id', userId)
      .select()
      .single()
    if (updateErr) throw new Error(updateErr.message)
    workout = updated as Workout
  } else {
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
    workout = workoutData as Workout
  }

  // Insert exercises and sets
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
