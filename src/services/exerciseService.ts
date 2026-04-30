import { supabase } from '../lib/supabase'
import { Exercise } from '../types/database'

/** Fetch all exercises visible to the current user (global + their own), sorted A-Z */
export async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Exercise[]
}

/** Add a custom exercise for the current user */
export async function addCustomExercise(name: string, userId: string): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({ name: name.trim(), created_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Exercise
}
