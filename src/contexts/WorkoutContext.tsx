import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { SessionExercise, SessionSet, Workout, WorkoutExercise } from '../types/database'
import { upsertWorkoutDraft, deleteWorkout } from '../services/workoutService'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'wt:active-session:v1'
const AUTOSAVE_DEBOUNCE_MS = 800

let localIdCounter = 0
const genId = () => `local_${Date.now()}_${++localIdCounter}`

interface PersistedSession {
  exercises: SessionExercise[]
  workoutDate: string | null
  startedAt: string | null
  editingWorkoutId: number | null
  isDraft: boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface WorkoutContextValue {
  exercises: SessionExercise[]
  workoutDate: string | null
  startedAt: string | null
  editingWorkoutId: number | null
  isEditing: boolean
  isDraft: boolean
  hasActiveSession: boolean
  saveStatus: SaveStatus

  initSession: (date: string, initialExercises?: { exercise_id: number; exercise_name: string }[]) => void
  initEditSession: (workout: Workout & { workout_exercises: WorkoutExercise[] }) => void
  resumeDraftSession: (workout: Workout & { workout_exercises: WorkoutExercise[] }) => void
  clearSession: () => void
  discardSession: () => Promise<void>
  markFinished: () => void

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

function loadedExercisesFrom(workout: Workout & { workout_exercises: WorkoutExercise[] }): SessionExercise[] {
  return (workout.workout_exercises ?? [])
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
}

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const persisted = loadPersisted()

  const [exercises, setExercises] = useState<SessionExercise[]>(persisted?.exercises ?? [])
  const [workoutDate, setWorkoutDate] = useState<string | null>(persisted?.workoutDate ?? null)
  const [startedAt, setStartedAt] = useState<string | null>(persisted?.startedAt ?? null)
  const [editingWorkoutId, setEditingWorkoutId] = useState<number | null>(persisted?.editingWorkoutId ?? null)
  const [isDraft, setIsDraft] = useState<boolean>(persisted?.isDraft ?? false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const hydratedRef = useRef(false)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightSaveRef = useRef<Promise<void> | null>(null)

  // Persist to localStorage on any change
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true
      return
    }
    if (!workoutDate) {
      try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
      return
    }
    const payload: PersistedSession = { exercises, workoutDate, startedAt, editingWorkoutId, isDraft }
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)) } catch { /* ignore */ }
  }, [exercises, workoutDate, startedAt, editingWorkoutId, isDraft])

  // Debounced auto-save to Supabase (drafts only)
  useEffect(() => {
    if (!hydratedRef.current) return
    if (!isDraft || !user || !workoutDate || !startedAt) return

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(async () => {
      const run = async () => {
        try {
          setSaveStatus('saving')
          const id = await upsertWorkoutDraft(
            user.id,
            editingWorkoutId,
            workoutDate,
            startedAt,
            exercises
          )
          if (id !== editingWorkoutId) setEditingWorkoutId(id)
          setSaveStatus('saved')
        } catch {
          setSaveStatus('error')
        }
      }
      // Chain so saves don't overlap
      inFlightSaveRef.current = (inFlightSaveRef.current ?? Promise.resolve()).then(run)
      await inFlightSaveRef.current
      inFlightSaveRef.current = null
    }, AUTOSAVE_DEBOUNCE_MS)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [exercises, workoutDate, startedAt, isDraft, user, editingWorkoutId])

  const initSession = useCallback(
    (date: string, initialExercises?: { exercise_id: number; exercise_name: string }[]) => {
      setWorkoutDate(date)
      setStartedAt(new Date().toISOString())
      setEditingWorkoutId(null)
      setIsDraft(true)
      setSaveStatus('idle')
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
      setIsDraft(false)
      setSaveStatus('idle')
      setExercises(loadedExercisesFrom(workout))
    },
    []
  )

  const resumeDraftSession = useCallback(
    (workout: Workout & { workout_exercises: WorkoutExercise[] }) => {
      setWorkoutDate(workout.workout_date)
      setStartedAt(workout.started_at ?? new Date().toISOString())
      setEditingWorkoutId(workout.id)
      setIsDraft(true)
      setSaveStatus('saved')
      setExercises(loadedExercisesFrom(workout))
    },
    []
  )

  const clearSession = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    setExercises([])
    setWorkoutDate(null)
    setStartedAt(null)
    setEditingWorkoutId(null)
    setIsDraft(false)
    setSaveStatus('idle')
  }, [])

  const discardSession = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    // Wait for any in-flight save to finish so we don't delete then immediately re-create
    if (inFlightSaveRef.current) {
      try { await inFlightSaveRef.current } catch { /* ignore */ }
    }
    if (isDraft && editingWorkoutId != null && user) {
      try { await deleteWorkout(editingWorkoutId, user.id) } catch { /* ignore */ }
    }
    setExercises([])
    setWorkoutDate(null)
    setStartedAt(null)
    setEditingWorkoutId(null)
    setIsDraft(false)
    setSaveStatus('idle')
  }, [isDraft, editingWorkoutId, user])

  const markFinished = useCallback(() => {
    setIsDraft(false)
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
        isEditing: editingWorkoutId !== null && !isDraft,
        isDraft,
        hasActiveSession: workoutDate !== null,
        saveStatus,
        initSession,
        initEditSession,
        resumeDraftSession,
        clearSession,
        discardSession,
        markFinished,
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
