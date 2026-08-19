import { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import Modal from './Modal'
import Skeleton from './Skeleton'
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
    <Modal isOpen={isOpen} onClose={onClose} title="Start workout">
      <div>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : (
          <>
            {templates.length > 0 && (
              <>
                <div className="section-label">From a template</div>
                <ul className="mt-1.5 border-t border-line">
                  {templates.map(t => {
                    const names = t.template_exercises
                      ?.slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map(te => te.exercise?.name)
                      .filter(Boolean)
                    return (
                      <li key={t.id} className="border-b border-line">
                        <button
                          onClick={() => { onSelect(t); onClose() }}
                          className="w-full flex items-center gap-3 py-3 px-1 -mx-1 text-left hover:bg-raised transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm">{t.name}</div>
                            <div className="mt-0.5 text-[0.8125rem] text-muted truncate">
                              {names?.join(' · ') || 'No exercises'}
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-faint shrink-0" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}

            <button onClick={() => { onSelect(null); onClose() }} className="btn-secondary w-full mt-4">
              Empty workout
            </button>

            {templates.length === 0 && (
              <p className="mt-3 text-sm text-muted leading-relaxed">
                You have no templates yet. Start empty and add exercises as you go — or build a
                template on the Templates tab so your usual lifts load in one tap.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
