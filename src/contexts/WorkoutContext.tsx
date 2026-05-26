import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { SessionExercise, SessionSet, Workout, WorkoutExercise } from '../types/database'

const STORAGE_KEY = 'wt:active-session:v1'

let localIdCounter = 0
const genId = () => `local_${Date.now()}_${++localIdCounter}`

interface PersistedSession {
  exercises: SessionExercise[]
  workoutDate: string | null
  startedAt: string | null
  editingWorkoutId: number | null
}

interface WorkoutContextValue {
  exercises: SessionExercise[]
  workoutDate: string | null
  startedAt: string | null
  editingWorkoutId: number | null
  isEditing: boolean

  initSession: (date: string, initialExercises?: { exercise_id: number; exercise_name: string }[]) => void
  initEditSession: (workout: Workout & { workout_exercises: WorkoutExercise[] }) => void
  clearSession: () => void

  addExercise: (exercise_id: number, exercise_name: string) => void
  removeExercise: (localId: string) => void
  updateExerciseName: (localId: string, exercise_id: number, exercise_name: string) => void

  addSet: (exerciseLocalId: string) => void
  updateSet: (exerciseLocalId: string, setLocalId: string, field: 'reps' | 'weight_kg', value: number | null) => void
  removeSet: (exerciseLocalId: string, setLocalId: string) => void
}

const WorkoutContext = createContext<WorkoutContextValue | undefined>(undefined)

function loadPersisted(): PersistedSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSession
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const persisted = loadPersisted()

  const [exercises, setExercises] = useState<SessionExercise[]>(persisted?.exercises ?? [])
  const [workoutDate, setWorkoutDate] = useState<string | null>(persisted?.workoutDate ?? null)
  const [startedAt, setStartedAt] = useState<string | null>(persisted?.startedAt ?? null)
  const [editingWorkoutId, setEditingWorkoutId] = useState<number | null>(persisted?.editingWorkoutId ?? null)

  const hydratedRef = useRef(false)

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true
      return
    }
    if (!workoutDate) {
      try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
      return
    }
    const payload: PersistedSession = { exercises, workoutDate, startedAt, editingWorkoutId }
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)) } catch { /* ignore */ }
  }, [exercises, workoutDate, startedAt, editingWorkoutId])

  const initSession = useCallback(
    (date: string, initialExercises?: { exercise_id: number; exercise_name: string }[]) => {
      setWorkoutDate(date)
      setStartedAt(new Date().toISOString())
      setEditingWorkoutId(null)
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

  const initEditSession = useCallback(
    (workout: Workout & { workout_exercises: WorkoutExercise[] }) => {
      setWorkoutDate(workout.workout_date)
      setStartedAt(workout.started_at ?? new Date().toISOString())
      setEditingWorkoutId(workout.id)
      const loaded: SessionExercise[] = (workout.workout_exercises ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((we, idx) => ({
          localId: genId(),
          exercise_id: we.exercise_id,
          exercise_name: we.exercise?.name ?? 'Unknown',
          sort_order: idx,
          sets: (we.workout_sets ?? [])
            .slice()
            .sort((a, b) => a.set_number - b.set_number)
            .map<SessionSet>(s => ({
              localId: genId(),
              set_number: s.set_number,
              reps: s.reps,
              weight_kg: s.weight_kg,
            })),
        }))
      setExercises(loaded)
    },
    []
  )

  const clearSession = useCallback(() => {
    setExercises([])
    setWorkoutDate(null)
    setStartedAt(null)
    setEditingWorkoutId(null)
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
        editingWorkoutId,
        isEditing: editingWorkoutId !== null,
        initSession,
        initEditSession,
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
