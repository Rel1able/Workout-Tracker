import { useState, useEffect } from 'react'
import { Dumbbell } from 'lucide-react'
import Modal from './Modal'
import Spinner from './Spinner'
import { WorkoutTemplate } from '../types/database'
import { fetchTemplates } from '../services/templateService'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'

interface TemplateSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (template: WorkoutTemplate | null) => void
}

export default function TemplateSelector({ isOpen, onClose, onSelect }: TemplateSelectorProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !user) return
    setLoading(true)
    fetchTemplates(user.id)
      .then(setTemplates)
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setLoading(false))
  }, [isOpen, user]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start Workout">
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : (
          <>
            {/* Empty workout option */}
            <button
              onClick={() => { onSelect(null); onClose() }}
              className="w-full text-left p-4 rounded-xl border border-dashed border-gray-600 hover:border-emerald-500 hover:bg-emerald-900/10 transition-colors group"
            >
              <div className="font-semibold text-white group-hover:text-emerald-400 flex items-center gap-2">
                <Dumbbell size={18} />
                Empty Workout
              </div>
              <div className="text-sm text-gray-400 mt-0.5">Start from scratch</div>
            </button>

            {templates.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
                  Your Templates
                </p>
                <div className="space-y-2">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { onSelect(t); onClose() }}
                      className="w-full text-left p-4 rounded-xl border border-gray-700 hover:border-emerald-500 hover:bg-emerald-900/10 transition-colors group"
                    >
                      <div className="font-semibold text-white group-hover:text-emerald-400">
                        {t.name}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {t.template_exercises
                          ?.sort((a, b) => a.sort_order - b.sort_order)
                          .map(te => te.exercise?.name)
                          .filter(Boolean)
                          .join(' · ') || 'No exercises'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {templates.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-2">
                No templates yet. Create one in "My Templates".
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
