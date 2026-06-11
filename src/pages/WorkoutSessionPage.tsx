import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Plus, Trash2, X, Dumbbell, Clock, History, StickyNote } from 'lucide-react'
import { useWorkoutSession } from '../contexts/WorkoutContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import ExercisePicker from '../components/ExercisePicker'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import RestTimer from '../components/RestTimer'
import { Exercise } from '../types/database'
import { saveWorkout, finishWorkout, upsertWorkoutDraft } from '../services/workoutService'
import { fetchExercises } from '../services/exerciseService'
import { fetchWorkoutHistory, buildLastPerformanceMap, LastPerformance } from '../services/statsService'

// Elapsed time since startedAt, updated every second
function useElapsed(startedAt: string | null, active: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [active])
  if (!startedAt) return null
  const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

function formatLastSets(lp: LastPerformance): string {
  return lp.sets
    .map(s => {
      const reps = s.reps ?? '–'
      return s.weight_kg != null ? `${reps}×${s.weight_kg}kg` : `${reps}`
    })
    .join('  ')
}

export default function WorkoutSessionPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  const {
    exercises,
    workoutDate,
    startedAt,
    editingWorkoutId,
    isEditing,
    isDraft,
    saveStatus,
    notes,
    setNotes,
    clearSession,
    discardSession,
    markFinished,
    addExercise,
    removeExercise,
    updateExerciseName,
    addSet,
    updateSet,
    removeSet,
    replaceSets,
  } = useWorkoutSession()

  const [exercisePickerOpen, setExercisePickerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [lastPerf, setLastPerf] = useState<Map<number, LastPerformance>>(new Map())
  const [notesOpen, setNotesOpen] = useState(false)

  // For inline exercise name editing (dropdown search)
  const [editingExercise, setEditingExercise] = useState<string | null>(null)

  const elapsed = useElapsed(startedAt, isDraft && !isEditing)

  // Redirect if no active session
  useEffect(() => {
    if (!workoutDate) navigate('/')
  }, [workoutDate, navigate])

  // Pre-load exercises for inline search
  useEffect(() => {
    fetchExercises().then(setAllExercises).catch(() => {})
  }, [])

  // Load recent history for "last time" hints
  useEffect(() => {
    if (!user || !workoutDate) return
    const from = new Date()
    from.setDate(from.getDate() - 180)
    const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`
    fetchWorkoutHistory(user.id, fromStr)
      .then(history => setLastPerf(buildLastPerformanceMap(history, workoutDate)))
      .catch(() => {})
  }, [user, workoutDate])

  const formattedDate = workoutDate
    ? new Date(workoutDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : ''

  const validSetCount = useMemo(
    () => exercises.reduce((n, e) => n + e.sets.filter(s => (s.reps ?? 0) > 0 || (s.weight_kg ?? 0) > 0).length, 0),
    [exercises]
  )

  const handleFinish = async () => {
    if (!user || !workoutDate || !startedAt) return
    setSaving(true)
    try {
      let newPRs: string[] = []
      if (isDraft) {
        // Flush any pending edits, then mark finished + recompute PRs
        const id = await upsertWorkoutDraft(user.id, editingWorkoutId, workoutDate, startedAt, exercises, notes)
        const result = await finishWorkout(user.id, id, exercises)
        newPRs = result.newPRs
        markFinished()
      } else {
        const result = await saveWorkout(user.id, workoutDate, startedAt, exercises, editingWorkoutId, notes)
        newPRs = result.newPRs
      }
      if (newPRs.length > 0) {
        newPRs.forEach(pr => showToast(`New PR! ${pr}`, 'success'))
      } else {
        showToast(isEditing ? 'Workout updated!' : 'Workout saved!', 'success')
      }
      clearSession()
      navigate('/')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save workout', 'error')
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  const handleDiscard = async () => {
    setSaving(true)
    try {
      await discardSession()
      navigate('/')
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  const handlePickExerciseForSlot = (localId: string, exercise: Exercise) => {
    updateExerciseName(localId, exercise.id, exercise.name)
    setEditingExercise(null)
  }

  const handleCopyLast = (localId: string, lp: LastPerformance) => {
    replaceSets(localId, lp.sets.map(s => ({ reps: s.reps, weight_kg: s.weight_kg })))
  }

  const currentExerciseIds = exercises.map(e => e.exercise_id).filter(Boolean) as number[]

  if (!workoutDate) return null

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            {isEditing ? 'Edit Workout' : 'Workout'}
            {isDraft && (
              <span
                className={`text-xs font-normal px-2 py-0.5 rounded-full ${
                  saveStatus === 'saving'
                    ? 'text-amber-400 bg-amber-900/30'
                    : saveStatus === 'error'
                    ? 'text-red-400 bg-red-900/30'
                    : 'text-emerald-500 bg-emerald-900/30'
                }`}
                title="Changes auto-save to the cloud"
              >
                {saveStatus === 'saving'
                  ? 'Saving…'
                  : saveStatus === 'error'
                  ? 'Save failed'
                  : 'Auto-saved'}
              </span>
            )}
          </h1>
          <p className="text-gray-400 text-sm flex items-center gap-2">
            {formattedDate}
            {elapsed && (
              <span className="inline-flex items-center gap-1 text-emerald-500 tabular-nums">
                <Clock size={13} /> {elapsed}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          className="btn-primary flex items-center gap-1.5"
          disabled={exercises.length === 0}
        >
          <Check size={16} />
          {isEditing ? 'Save' : 'Finish'}
        </button>
      </div>

      {exercises.length === 0 && (
        <div className="card text-center py-8 text-gray-500">
          <Dumbbell size={40} className="mx-auto mb-3 text-gray-600" />
          <p>No exercises yet. Add one below!</p>
        </div>
      )}

      {/* Exercise cards */}
      {exercises.map(ex => {
        const last = ex.exercise_id ? lastPerf.get(ex.exercise_id) : undefined
        return (
          <div key={ex.localId} className="card space-y-3">
            {/* Exercise header */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                {editingExercise === ex.localId ? (
                  <ExerciseInlineSearch
                    value={ex.exercise_name}
                    allExercises={allExercises}
                    onSelect={e => handlePickExerciseForSlot(ex.localId, e)}
                    onBlur={() => setEditingExercise(null)}
                  />
                ) : (
                  <button
                    onClick={() => setEditingExercise(ex.localId)}
                    className="text-left font-semibold text-white hover:text-emerald-400 transition-colors w-full"
                  >
                    {ex.exercise_name || (
                      <span className="text-gray-500 italic">Select exercise…</span>
                    )}
                  </button>
                )}
              </div>
              <button
                onClick={() => removeExercise(ex.localId)}
                className="text-gray-600 hover:text-red-400 transition-colors p-1.5"
                title="Remove exercise"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* Last-time hint */}
            {last && (
              <div className="flex items-center justify-between gap-2 bg-gray-800/60 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-gray-400 truncate flex items-center gap-1.5">
                  <History size={13} className="shrink-0 text-gray-500" />
                  Last ({new Date(last.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}):{' '}
                  <span className="text-gray-300 tabular-nums">{formatLastSets(last)}</span>
                </span>
                {ex.sets.length === 0 && (
                  <button
                    onClick={() => handleCopyLast(ex.localId, last)}
                    className="text-emerald-500 hover:text-emerald-400 font-semibold shrink-0 transition-colors"
                  >
                    Copy
                  </button>
                )}
              </div>
            )}

            {/* Sets table */}
            {ex.sets.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left pb-1 font-medium w-8">#</th>
                    {last && <th className="text-left pb-1 font-medium w-20">Prev</th>}
                    <th className="text-left pb-1 font-medium">Reps</th>
                    <th className="text-left pb-1 font-medium">kg</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {ex.sets.map((s, sIdx) => {
                    const prevSet = last?.sets[sIdx]
                    return (
                      <tr key={s.localId}>
                        <td className="py-1 text-gray-500 pr-2">{s.set_number}</td>
                        {last && (
                          <td className="py-1 pr-2 text-gray-500 text-xs tabular-nums">
                            {prevSet
                              ? `${prevSet.reps ?? '–'}×${prevSet.weight_kg ?? '–'}`
                              : '—'}
                          </td>
                        )}
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-emerald-500"
                            placeholder="—"
                            value={s.reps ?? ''}
                            onChange={e =>
                              updateSet(ex.localId, s.localId, 'reps', e.target.value === '' ? null : Number(e.target.value))
                            }
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.5"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-emerald-500"
                            placeholder="—"
                            value={s.weight_kg ?? ''}
                            onChange={e =>
                              updateSet(ex.localId, s.localId, 'weight_kg', e.target.value === '' ? null : Number(e.target.value))
                            }
                          />
                        </td>
                        <td className="py-1">
                          <button
                            onClick={() => removeSet(ex.localId, s.localId)}
                            className="text-gray-600 hover:text-red-400 transition-colors p-1"
                            aria-label="Remove set"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            <button
              onClick={() => addSet(ex.localId)}
              className="text-sm text-emerald-500 hover:text-emerald-400 transition-colors font-medium flex items-center gap-1 py-1"
            >
              <Plus size={16} /> Add Set
            </button>
          </div>
        )
      })}

      {/* Add Exercise button */}
      <button
        onClick={() => setExercisePickerOpen(true)}
        className="w-full py-3.5 border-2 border-dashed border-gray-700 hover:border-emerald-600 text-gray-500 hover:text-emerald-500 rounded-2xl transition-colors text-sm font-medium flex items-center justify-center gap-1.5"
      >
        <Plus size={16} /> Add Exercise
      </button>

      {/* Notes */}
      <div className="card space-y-2">
        <button
          onClick={() => setNotesOpen(o => !o)}
          className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors w-full text-left"
        >
          <StickyNote size={16} className="text-gray-500" />
          Notes
          {notes && !notesOpen && (
            <span className="text-gray-600 text-xs truncate flex-1">— {notes}</span>
          )}
        </button>
        {(notesOpen || notes) && (
          <textarea
            className="input min-h-[72px] resize-y text-sm"
            placeholder="How did it go? Energy, pain, machine settings…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        )}
      </div>

      {/* Floating rest timer */}
      <RestTimer />

      {/* Exercise Picker Modal */}
      <ExercisePicker
        isOpen={exercisePickerOpen}
        onClose={() => setExercisePickerOpen(false)}
        onSelect={ex => addExercise(ex.id, ex.name)}
        excludeIds={currentExerciseIds}
      />

      {/* Confirm finish modal */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={isEditing ? 'Update Workout?' : 'Save Workout?'}
      >
        <div className="space-y-4">
          <p className="text-gray-300 text-sm">
            You have <strong className="text-white">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</strong> with{' '}
            <strong className="text-white">{validSetCount} valid sets</strong>.
            {isEditing
              ? ' This will replace the existing workout and recalculate any new personal records.'
              : ' This will save your workout and calculate any new personal records.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleFinish}
              disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {saving && <Spinner size="sm" />}
              {isEditing ? 'Update Workout' : 'Save Workout'}
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
          <button
            onClick={isEditing ? () => { clearSession(); navigate('/') } : handleDiscard}
            disabled={saving}
            className="w-full text-red-500 hover:text-red-400 text-sm text-center py-1 transition-colors disabled:opacity-50"
          >
            {isEditing ? 'Cancel editing (revert changes)' : 'Discard workout'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ─── Inline exercise search component ───────────────────────────────────────

interface ExerciseInlineSearchProps {
  value: string
  allExercises: Exercise[]
  onSelect: (ex: Exercise) => void
  onBlur: () => void
}

function ExerciseInlineSearch({ value, allExercises, onSelect, onBlur }: ExerciseInlineSearchProps) {
  const [query, setQuery] = useState(value)
  const filtered = allExercises.filter(ex =>
    ex.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8)

  return (
    <div className="relative">
      <input
        autoFocus
        type="text"
        className="input text-sm py-1.5"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onBlur={() => setTimeout(onBlur, 200)}
        placeholder="Search exercise…"
      />
      {filtered.length > 0 && (
        <ul className="absolute top-full left-0 right-0 bg-gray-800 border border-gray-700 rounded-lg mt-1 z-20 overflow-hidden shadow-xl max-h-48 overflow-y-auto">
          {filtered.map(ex => (
            <li key={ex.id}>
              <button
                onMouseDown={e => { e.preventDefault(); onSelect(ex) }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
              >
                {ex.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
