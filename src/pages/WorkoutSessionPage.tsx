import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Plus, Trash2, X, Dumbbell } from 'lucide-react'
import { useWorkoutSession } from '../contexts/WorkoutContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import ExercisePicker from '../components/ExercisePicker'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import { Exercise } from '../types/database'
import { saveWorkout } from '../services/workoutService'
import { fetchExercises } from '../services/exerciseService'

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
    clearSession,
    addExercise,
    removeExercise,
    updateExerciseName,
    addSet,
    updateSet,
    removeSet,
  } = useWorkoutSession()

  const [exercisePickerOpen, setExercisePickerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [allExercises, setAllExercises] = useState<Exercise[]>([])

  // For inline exercise name editing (dropdown search)
  const [editingExercise, setEditingExercise] = useState<string | null>(null)

  // Redirect if no active session
  useEffect(() => {
    if (!workoutDate) navigate('/')
  }, [workoutDate, navigate])

  // Pre-load exercises for inline search
  useEffect(() => {
    fetchExercises().then(setAllExercises).catch(() => {})
  }, [])

  const formattedDate = workoutDate
    ? new Date(workoutDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : ''

  const handleFinish = async () => {
    if (!user || !workoutDate || !startedAt) return
    setSaving(true)
    try {
      const { newPRs } = await saveWorkout(user.id, workoutDate, startedAt, exercises, editingWorkoutId)
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

  const handlePickExerciseForSlot = (localId: string, exercise: Exercise) => {
    updateExerciseName(localId, exercise.id, exercise.name)
    setEditingExercise(null)
  }

  const currentExerciseIds = exercises.map(e => e.exercise_id).filter(Boolean) as number[]

  if (!workoutDate) return null

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            {isEditing ? 'Edit Workout' : 'Workout'}
            <span className="text-xs font-normal text-emerald-500 bg-emerald-900/30 px-2 py-0.5 rounded-full">
              Auto-saved
            </span>
          </h1>
          <p className="text-gray-400 text-sm">{formattedDate}</p>
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
      {exercises.map((ex, exIdx) => (
        <div key={ex.localId} className="card space-y-3">
          {/* Exercise header */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
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
              className="text-gray-600 hover:text-red-400 transition-colors px-1"
              title="Remove exercise"
            >
              <Trash2 size={18} />
            </button>
          </div>

          {/* Sets table */}
          {ex.sets.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left pb-1 font-medium w-8">#</th>
                    <th className="text-left pb-1 font-medium">Reps</th>
                    <th className="text-left pb-1 font-medium">kg</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {ex.sets.map(s => (
                    <tr key={s.localId}>
                      <td className="py-1 text-gray-500 pr-2">{s.set_number}</td>
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          min="0"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-emerald-500"
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
                          min="0"
                          step="0.5"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-emerald-500"
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
                          className="text-gray-600 hover:text-red-400 transition-colors"
                          aria-label="Remove set"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={() => addSet(ex.localId)}
            className="text-sm text-emerald-500 hover:text-emerald-400 transition-colors font-medium flex items-center gap-1"
          >
            <Plus size={16} /> Add Set
          </button>
        </div>
      ))}

      {/* Add Exercise button */}
      <button
        onClick={() => setExercisePickerOpen(true)}
        className="w-full py-3 border-2 border-dashed border-gray-700 hover:border-emerald-600 text-gray-500 hover:text-emerald-500 rounded-xl transition-colors text-sm font-medium flex items-center justify-center gap-1.5"
      >
        <Plus size={16} /> Add Exercise
      </button>

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
            <strong className="text-white">{exercises.reduce((n, e) => n + e.sets.filter(s => (s.reps ?? 0) > 0 || (s.weight_kg ?? 0) > 0).length, 0)} valid sets</strong>.
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
            onClick={() => { clearSession(); navigate('/') }}
            className="w-full text-red-500 hover:text-red-400 text-sm text-center py-1 transition-colors"
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


