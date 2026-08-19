import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import Skeleton from '../components/Skeleton'
import ExercisePicker from '../components/ExercisePicker'
import { WorkoutTemplate, Exercise } from '../types/database'
import { fetchTemplates, saveTemplate, deleteTemplate } from '../services/templateService'

export default function TemplatesPage() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    if (!user) return
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchTemplates(user.id)
      setTemplates(data)
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load templates')
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
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="hidden lg:block text-xl font-bold tracking-tight">Templates</h1>
          <p className="text-sm text-muted">Preset exercise lists you can start a workout from.</p>
        </div>
        <button onClick={openNew} className="btn-primary shrink-0">
          <Plus size={16} /> New
        </button>
      </div>

      {loading ? (
        <div className="mt-5 space-y-2">
          {[0, 1].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : loadError ? (
        <div className="mt-5 panel p-5">
          <p className="text-sm font-semibold text-danger">Could not load your templates</p>
          <p className="mt-1 text-sm text-muted">{loadError}</p>
          <button onClick={load} className="btn-secondary mt-4">Try again</button>
        </div>
      ) : templates.length === 0 ? (
        <div className="mt-5 panel p-5">
          <p className="text-sm font-semibold">No templates yet</p>
          <p className="mt-1 text-sm text-muted leading-relaxed">
            A template is just an ordered list of exercises — Push day, Legs, Full body. Pick one when
            you start a workout and every exercise is already there, with last session's numbers
            beside each set.
          </p>
          <button onClick={openNew} className="btn-primary mt-4">
            <Plus size={16} /> Create a template
          </button>
        </div>
      ) : (
        <ul className="mt-4 border-t border-line">
          {templates.map(t => {
            const names = t.template_exercises
              ?.slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(te => te.exercise?.name)
              .filter(Boolean) as string[] | undefined
            return (
              <li key={t.id} className="flex items-start gap-3 py-3.5 border-b border-line">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold truncate">{t.name}</h2>
                    <span className="num text-2xs text-faint shrink-0">
                      {names?.length ?? 0} exercises
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.8125rem] text-muted leading-relaxed">
                    {names && names.length > 0 ? names.join(' · ') : 'No exercises yet'}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <button onClick={() => openEdit(t)} className="btn-quiet btn-sm">Edit</button>
                  <button
                    onClick={() => setDeleteConfirmId(t.id)}
                    className="btn-quiet btn-sm hover:text-danger"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

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
            showToast('Template saved', 'success')
          }}
        />
      )}

      <Modal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete template?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            The template is removed. Workouts you already logged from it are not affected.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleting}
              className="btn-danger flex-1"
            >
              {deleting && <Spinner size="sm" />}
              Delete template
            </button>
            <button onClick={() => setDeleteConfirmId(null)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Template editor ─────────────────────────────────────────────────────────

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
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(te => te.exercise!)
      .filter(Boolean)
  })
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const move = (idx: number, dir: -1 | 1) => {
    setExercises(prev => {
      const target = idx + dir
      if (target < 0 || target >= prev.length) return prev
      const copy = [...prev]
      ;[copy[idx], copy[target]] = [copy[target], copy[idx]]
      return copy
    })
  }

  const remove = (idx: number) => setExercises(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!name.trim()) { showToast('Give the template a name', 'error'); return }
    setSaving(true)
    try {
      const saved = await saveTemplate(userId, name.trim(), exercises.map(e => e.id), template?.id)
      onSaved(saved)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save template', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={template ? 'Edit template' : 'New template'}>
      <div className="space-y-5">
        <div>
          <label htmlFor="tpl-name" className="section-label">Name</label>
          <input
            id="tpl-name"
            type="text"
            className="field mt-1.5"
            placeholder="Push day, Legs, Full body…"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="section-label">Exercises</span>
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1 text-[0.8125rem] font-semibold text-accent hover:underline"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {exercises.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              No exercises yet — add them in the order you train them.
            </p>
          ) : (
            <ul className="mt-2 border-t border-line">
              {exercises.map((ex, idx) => (
                <li
                  key={`${ex.id}-${idx}`}
                  className="flex items-center gap-2 py-1.5 border-b border-line"
                >
                  <span className="num text-xs font-bold text-faint w-4">{idx + 1}</span>
                  <span className="flex-1 text-sm truncate">{ex.name}</span>
                  <button
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="icon-btn w-8 h-8 disabled:opacity-25"
                    aria-label={`Move ${ex.name} up`}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => move(idx, 1)}
                    disabled={idx === exercises.length - 1}
                    className="icon-btn w-8 h-8 disabled:opacity-25"
                    aria-label={`Move ${ex.name} down`}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    onClick={() => remove(idx)}
                    className="icon-btn w-8 h-8 hover:text-danger"
                    aria-label={`Remove ${ex.name}`}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving && <Spinner size="sm" />}
            Save template
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>

      <ExercisePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={ex => setExercises(prev => (prev.find(e => e.id === ex.id) ? prev : [...prev, ex]))}
        excludeIds={exercises.map(e => e.id)}
      />
    </Modal>
  )
}
