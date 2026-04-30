import { supabase } from '../lib/supabase'
import { WorkoutTemplate, TemplateExercise } from '../types/database'

/** Fetch all templates for a user, including their exercises */
export async function fetchTemplates(userId: string): Promise<WorkoutTemplate[]> {
  const { data, error } = await supabase
    .from('workout_templates')
    .select(`
      *,
      template_exercises (
        *,
        exercise:exercises (*)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as WorkoutTemplate[]
}

/** Create or update a template and its exercises */
export async function saveTemplate(
  userId: string,
  name: string,
  exerciseIds: number[],
  templateId?: number
): Promise<WorkoutTemplate> {
  let tplId = templateId

  if (tplId) {
    // Update name
    const { error } = await supabase
      .from('workout_templates')
      .update({ name })
      .eq('id', tplId)
    if (error) throw new Error(error.message)

    // Delete old exercises and re-insert
    const { error: delErr } = await supabase
      .from('template_exercises')
      .delete()
      .eq('template_id', tplId)
    if (delErr) throw new Error(delErr.message)
  } else {
    // Create new template
    const { data, error } = await supabase
      .from('workout_templates')
      .insert({ user_id: userId, name })
      .select()
      .single()
    if (error) throw new Error(error.message)
    tplId = (data as WorkoutTemplate).id
  }

  // Insert exercises with sort_order
  if (exerciseIds.length > 0) {
    const rows = exerciseIds.map((eid, idx) => ({
      template_id: tplId,
      exercise_id: eid,
      sort_order: idx,
    }))
    const { error } = await supabase.from('template_exercises').insert(rows)
    if (error) throw new Error(error.message)
  }

  // Return updated template
  const { data: tpl, error: fetchErr } = await supabase
    .from('workout_templates')
    .select(`*, template_exercises(*, exercise:exercises(*))`)
    .eq('id', tplId)
    .single()
  if (fetchErr) throw new Error(fetchErr.message)
  return tpl as WorkoutTemplate
}

/** Delete a template (cascade deletes template_exercises) */
export async function deleteTemplate(templateId: number): Promise<void> {
  const { error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', templateId)
  if (error) throw new Error(error.message)
}
