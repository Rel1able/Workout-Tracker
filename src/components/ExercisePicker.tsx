import { useState, useEffect } from 'react'
import Modal from './Modal'
import Spinner from './Spinner'
import { Exercise } from '../types/database'
import { fetchExercises, addCustomExercise } from '../services/exerciseService'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'

interface ExercisePickerProps {
  isOpen: boolean
  onClose: () => void
  /** Called when the user selects an exercise */
  onSelect: (exercise: Exercise) => void
  /** IDs to exclude from list (already in workout) */
  excludeIds?: number[]
}

export default function ExercisePicker({ isOpen, onClose, onSelect, excludeIds = [] }: ExercisePickerProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setLoading(true)
    fetchExercises()
      .then(setExercises)
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setLoading(false))
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = exercises.filter(
    ex =>
      !excludeIds.includes(ex.id) &&
      ex.name.toLowerCase().includes(query.toLowerCase())
  )

  const handleAddCustom = async () => {
    if (!query.trim() || !user) return
    setAdding(true)
    try {
      const newEx = await addCustomExercise(query.trim(), user.id)
      setExercises(prev => [...prev, newEx].sort((a, b) => a.name.localeCompare(b.name)))
      onSelect(newEx)
      onClose()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to add exercise', 'error')
    } finally {
      setAdding(false)
    }
  }

  const exactMatch = exercises.some(
    ex => ex.name.toLowerCase() === query.trim().toLowerCase()
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Exercise">
      <div className="space-y-3">
        <input
          type="text"
          className="input"
          placeholder="Search exercises..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : (
          <ul className="space-y-1 max-h-72 overflow-y-auto">
            {filtered.map(ex => (
              <li key={ex.id}>
                <button
                  onClick={() => { onSelect(ex); onClose() }}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-800 text-white transition-colors flex items-center justify-between group"
                >
                  <span>{ex.name}</span>
                  {ex.created_by && (
                    <span className="text-xs text-gray-500 group-hover:text-gray-400">Custom</span>
                  )}
                </button>
              </li>
            ))}

            {filtered.length === 0 && !exactMatch && query.trim() && (
              <li className="pt-1">
                <button
                  onClick={handleAddCustom}
                  disabled={adding}
                  className="w-full text-left px-3 py-2.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 transition-colors text-sm flex items-center gap-2"
                >
                  {adding ? <Spinner size="sm" /> : <span>＋</span>}
                  Add "{query.trim()}" as custom exercise
                </button>
              </li>
            )}

            {filtered.length === 0 && !query.trim() && (
              <li className="py-4 text-center text-gray-500 text-sm">No exercises found</li>
            )}
          </ul>
        )}
      </div>
    </Modal>
  )
}
