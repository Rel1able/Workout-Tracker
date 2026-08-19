import { useState, useEffect } from 'react'
import { Plus, Search } from 'lucide-react'
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
    ex => !excludeIds.includes(ex.id) && ex.name.toLowerCase().includes(query.toLowerCase())
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

  const exactMatch = exercises.some(ex => ex.name.toLowerCase() === query.trim().toLowerCase())

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add exercise">
      <div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <input
            type="text"
            className="field pl-9"
            placeholder="Search or type a new name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : (
          <ul className="mt-3 -mx-1 max-h-[min(60vh,22rem)] overflow-y-auto">
            {filtered.map(ex => (
              <li key={ex.id} className="border-b border-line">
                <button
                  onClick={() => { onSelect(ex); onClose() }}
                  className="w-full flex items-center justify-between gap-3 px-1 h-12 text-left
                             text-sm hover:bg-raised transition-colors"
                >
                  <span className="truncate">{ex.name}</span>
                  {ex.created_by && <span className="text-2xs text-faint shrink-0">Custom</span>}
                </button>
              </li>
            ))}

            {filtered.length === 0 && !exactMatch && query.trim() && (
              <li>
                <button
                  onClick={handleAddCustom}
                  disabled={adding}
                  className="w-full flex items-center gap-2 px-1 h-12 text-left text-sm font-semibold
                             text-accent hover:bg-accent-soft transition-colors rounded-lg"
                >
                  {adding ? <Spinner size="sm" /> : <Plus size={16} />}
                  Create “{query.trim()}”
                </button>
              </li>
            )}

            {filtered.length === 0 && !query.trim() && (
              <li className="py-6 text-center text-sm text-muted">
                Every exercise is already in this workout.
              </li>
            )}
          </ul>
        )}
      </div>
    </Modal>
  )
}
