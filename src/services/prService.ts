import { supabase } from '../lib/supabase'
import { PersonalRecord } from '../types/database'

/** Fetch all personal records for a user, joined with exercise info */
export async function fetchPersonalRecords(userId: string): Promise<PersonalRecord[]> {
  const { data, error } = await supabase
    .from('personal_records')
    .select('*, exercise:exercises(*)')
    .eq('user_id', userId)
    .order('achieved_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as PersonalRecord[]
}
