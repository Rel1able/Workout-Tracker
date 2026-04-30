import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import ExercisePicker from '../components/ExercisePicker'
import { WorkoutTemplate, Exercise } from '../types/database'
import { fetchTemplates, saveTemplate, deleteTemplate } from '../services/templateService'

export default function TemplatesPage() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await fetchTemplates(user.id)
      setTemplates(data)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load templates', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => { setEditing(null); setEditorOpen(true) }
  const openEdit = (t: WorkoutTemplate) => { setEditing(t); setEditorOpen(true) }

  const handleDelete = async (id: number) => {
    setDeleting(true)
    try {
      await deleteTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
      showToast('Template deleted', 'info')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error')
    } finally {
      setDeleting(false)
      setDeleteConfirmId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">My Templates</h1>
        <button onClick={openNew} className="btn-primary">＋ New</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : templates.length === 0 ? (
        <div className="card text-center py-12 text-gray-500 space-y-3">
          <div className="text-4xl">📋</div>
          <p>No templates yet.</p>
          <button onClick={openNew} className="btn-secondary">Create your first template</button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-white text-lg">{t.name}</h2>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {t.template_exercises
                      ?.sort((a, b) => a.sort_order - b.sort_order)
                      .map(te => (
                        <span
                          key={te.id}
                          className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-full"
                        >
                          {te.exercise?.name}
                        </span>
                      ))}
                    {(!t.template_exercises || t.template_exercises.length === 0) && (
                      <span className="text-gray-600 text-xs">No exercises</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(t)} className="btn-ghost text-sm">Edit</button>
                  <button
                    onClick={() => setDeleteConfirmId(t.id)}
                    className="btn-ghost text-sm text-red-500 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template editor modal */}
      {editorOpen && (
        <TemplateEditor
          template={editing}
          userId={user?.id ?? ''}
          onClose={() => setEditorOpen(false)}
          onSaved={saved => {
            setTemplates(prev => {
              const idx = prev.findIndex(t => t.id === saved.id)
              if (idx >= 0) {
                const copy = [...prev]
                copy[idx] = saved
                return copy
              }
              return [saved, ...prev]
            })
            setEditorOpen(false)
            showToast('Template saved!', 'success')
          }}
        />
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Template?"
      >
        <div className="space-y-4">
          <p className="text-gray-300 text-sm">This cannot be undone.</p>
          <div className="flex gap-3">
            <button
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleting}
              className="btn-danger flex-1 flex items-center justify-center gap-2"
            >
              {deleting && <Spinner size="sm" />}
              Delete
            </button>
            <button onClick={() => setDeleteConfirmId(null)} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Template Editor ─────────────────────────────────────────────────────────

interface TemplateEditorProps {
  template: WorkoutTemplate | null
  userId: string
  onClose: () => void
  onSaved: (t: WorkoutTemplate) => void
}

function TemplateEditor({ template, userId, onClose, onSaved }: TemplateEditorProps) {
  const { showToast } = useToast()
  const [name, setName] = useState(template?.name ?? '')
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    if (!template?.template_exercises) return []
    return template.template_exercises
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(te => te.exercise!)
      .filter(Boolean)
  })
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const moveUp = (idx: number) => {
    if (idx === 0) return
    setExercises(prev => {
      const copy = [...prev]
      ;[copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]]
      return copy
    })
  }

  const moveDown = (idx: number) => {
    setExercises(prev => {
      if (idx >= prev.length - 1) return prev
      const copy = [...prev]
      ;[copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]]
      return copy
    })
  }

  const remove = (idx: number) => setExercises(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!name.trim()) { showToast('Template name is required', 'error'); return }
    setSaving(true)
    try {
      const saved = await saveTemplate(
        userId,
        name.trim(),
        exercises.map(e => e.id),
        template?.id
      )
      onSaved(saved)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save template', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={template ? 'Edit Template' : 'New Template'}
      className="max-w-lg"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Template Name</label>
          <input
            type="text"
            className="input"
            placeholder="e.g., Push Day, Pull Day…"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">Exercises</label>
            <button
              onClick={() => setPickerOpen(true)}
              className="text-emerald-500 hover:text-emerald-400 text-sm font-medium transition-colors"
            >
              ＋ Add
            </button>
          </div>

          {exercises.length === 0 ? (
            <div className="text-center py-6 text-gray-600 text-sm border border-dashed border-gray-700 rounded-xl">
              No exercises added
            </div>
          ) : (
            <ul className="space-y-1.5">
              {exercises.map((ex, idx) => (
                <li
                  key={`${ex.id}-${idx}`}
                  className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="text-gray-500 hover:text-white disabled:opacity-20 leading-none text-xs"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === exercises.length - 1}
                      className="text-gray-500 hover:text-white disabled:opacity-20 leading-none text-xs"
                    >
                      ▼
                    </button>
                  </div>
                  <span className="flex-1 text-white text-sm">{ex.name}</span>
                  <button
                    onClick={() => remove(idx)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-sm"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving && <Spinner size="sm" />}
            Save Template
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        </div>
      </div>

      <ExercisePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={ex => setExercises(prev =>
          prev.find(e => e.id === ex.id) ? prev : [...prev, ex]
        )}
        excludeIds={exercises.map(e => e.id)}
      />
    </Modal>
  )
}
