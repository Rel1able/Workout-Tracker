import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { SessionExercise, SessionSet } from '../types/database'

let localIdCounter = 0
const genId = () => `local_${++localIdCounter}`

interface WorkoutContextValue {
  exercises: SessionExercise[]
  workoutDate: string | null
  startedAt: string | null

  /** Initialise session with a date and optional list of exercises from a template */
  initSession: (date: string, initialExercises?: { exercise_id: number; exercise_name: string }[]) => void
  clearSession: () => void

  addExercise: (exercise_id: number, exercise_name: string) => void
  removeExercise: (localId: string) => void
  updateExerciseName: (localId: string, exercise_id: number, exercise_name: string) => void

  addSet: (exerciseLocalId: string) => void
  updateSet: (exerciseLocalId: string, setLocalId: string, field: 'reps' | 'weight_kg', value: number | null) => void
  removeSet: (exerciseLocalId: string, setLocalId: string) => void
}

const WorkoutContext = createContext<WorkoutContextValue | undefined>(undefined)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [workoutDate, setWorkoutDate] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)

  const initSession = useCallback(
    (date: string, initialExercises?: { exercise_id: number; exercise_name: string }[]) => {
      setWorkoutDate(date)
      setStartedAt(new Date().toISOString())
      if (initialExercises && initialExercises.length > 0) {
        setExercises(
          initialExercises.map((ex, idx) => ({
            localId: genId(),
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise_name,
            sort_order: idx,
            sets: [],
          }))
        )
      } else {
        setExercises([])
      }
    },
    []
  )

  const clearSession = useCallback(() => {
    setExercises([])
    setWorkoutDate(null)
    setStartedAt(null)
  }, [])

  const addExercise = useCallback((exercise_id: number, exercise_name: string) => {
    setExercises(prev => [
      ...prev,
      {
        localId: genId(),
        exercise_id,
        exercise_name,
        sort_order: prev.length,
        sets: [],
      },
    ])
  }, [])

  const removeExercise = useCallback((localId: string) => {
    setExercises(prev => prev.filter(e => e.localId !== localId))
  }, [])

  const updateExerciseName = useCallback((localId: string, exercise_id: number, exercise_name: string) => {
    setExercises(prev =>
      prev.map(e => (e.localId === localId ? { ...e, exercise_id, exercise_name } : e))
    )
  }, [])

  const addSet = useCallback((exerciseLocalId: string) => {
    setExercises(prev =>
      prev.map(ex => {
        if (ex.localId !== exerciseLocalId) return ex
        const nextNumber = ex.sets.length + 1
        const newSet: SessionSet = {
          localId: genId(),
          set_number: nextNumber,
          reps: null,
          weight_kg: null,
        }
        return { ...ex, sets: [...ex.sets, newSet] }
      })
    )
  }, [])

  const updateSet = useCallback(
    (exerciseLocalId: string, setLocalId: string, field: 'reps' | 'weight_kg', value: number | null) => {
      setExercises(prev =>
        prev.map(ex => {
          if (ex.localId !== exerciseLocalId) return ex
          return {
            ...ex,
            sets: ex.sets.map(s =>
              s.localId === setLocalId ? { ...s, [field]: value } : s
            ),
          }
        })
      )
    },
    []
  )

  const removeSet = useCallback((exerciseLocalId: string, setLocalId: string) => {
    setExercises(prev =>
      prev.map(ex => {
        if (ex.localId !== exerciseLocalId) return ex
        const filtered = ex.sets.filter(s => s.localId !== setLocalId)
        // Re-number sets
        return {
          ...ex,
          sets: filtered.map((s, i) => ({ ...s, set_number: i + 1 })),
        }
      })
    )
  }, [])

  return (
    <WorkoutContext.Provider
      value={{
        exercises,
        workoutDate,
        startedAt,
        initSession,
        clearSession,
        addExercise,
        removeExercise,
        updateExerciseName,
        addSet,
        updateSet,
        removeSet,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  )
}

export function useWorkoutSession() {
  const ctx = useContext(WorkoutContext)
  if (!ctx) throw new Error('useWorkoutSession must be used inside WorkoutProvider')
  return ctx
}
