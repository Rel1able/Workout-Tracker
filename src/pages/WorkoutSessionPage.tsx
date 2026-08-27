import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Copy, Dumbbell, Minus, Plus, Trash2, X } from 'lucide-react'
import { useWorkoutSession } from '../contexts/WorkoutContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import ExercisePicker from '../components/ExercisePicker'
import TemplateSelector from '../components/TemplateSelector'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import { RestTimerControl, useRestTimer } from '../components/RestTimer'
import { Exercise, SessionExercise, SessionSet, WorkoutTemplate } from '../types/database'
import { saveWorkout, finishWorkout, upsertWorkoutDraft } from '../services/workoutService'
import { fetchExercises } from '../services/exerciseService'
import {
  fetchWorkoutHistory,
  buildLastPerformanceMap,
  best1RM,
  weightForReps,
  E1RM_REP_LIMIT,
  Estimated1RM,
  LastPerformance,
} from '../services/statsService'

const WEIGHT_STEP = 2.5

/** Rep targets shown in the 1RM breakdown. */
const RM_TARGETS = [1, 3, 5, 8, 10, 12]

/** Gym-friendly precision — nobody loads 63.28 kg. */
function roundHalf(n: number) {
  return Math.round(n * 2) / 2
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

function fmtSet(s: { reps: number | null; weight_kg: number | null }) {
  const w = s.weight_kg != null ? `${s.weight_kg}` : '–'
  const r = s.reps ?? '–'
  return `${w}×${r}`
}

function shortDate(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sessionVolume(exercises: SessionExercise[]) {
  return exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.reps ?? 0) * (set.weight_kg ?? 0), 0),
    0
  )
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
    initSession,
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
  const [startPickerOpen, setStartPickerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [lastPerf, setLastPerf] = useState<Map<number, LastPerformance>>(new Map())
  const [editingExercise, setEditingExercise] = useState<string | null>(null)
  const [activeSet, setActiveSet] = useState<string | null>(null)
  /** localId of the exercise whose 1RM breakdown is expanded. */
  const [openRm, setOpenRm] = useState<string | null>(null)
  /** Sets ticked off during this session — UI state only, not stored. */
  const [doneSets, setDoneSets] = useState<Set<string>>(new Set())

  const rest = useRestTimer()
  const elapsed = useElapsed(startedAt, isDraft && !isEditing)

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
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : ''

  const totalSets = useMemo(() => exercises.reduce((n, e) => n + e.sets.length, 0), [exercises])
  const validSetCount = useMemo(
    () => exercises.reduce((n, e) => n + e.sets.filter(s => (s.reps ?? 0) > 0 || (s.weight_kg ?? 0) > 0).length, 0),
    [exercises]
  )
  const volume = useMemo(() => Math.round(sessionVolume(exercises)), [exercises])

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
        newPRs.forEach(pr => showToast(`New PR — ${pr}`, 'success'))
      } else {
        showToast(isEditing ? 'Workout updated' : 'Workout saved', 'success')
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

  const handleStart = (template: WorkoutTemplate | null) => {
    const picked = template?.template_exercises
      ?.slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(te => ({ exercise_id: te.exercise_id, exercise_name: te.exercise?.name ?? 'Unknown' }))
    initSession(todayStr(), picked)
  }

  const toggleDone = (setLocalId: string) => {
    setDoneSets(prev => {
      const next = new Set(prev)
      if (next.has(setLocalId)) {
        next.delete(setLocalId)
      } else {
        next.add(setLocalId)
        if (!rest.running) rest.start(rest.lastPreset)
      }
      return next
    })
  }

  const bump = (
    exLocalId: string,
    set: SessionSet,
    field: 'reps' | 'weight_kg',
    delta: number,
    fallback: number
  ) => {
    const current = set[field] ?? fallback
    const next = Math.max(0, Math.round((current + delta) * 100) / 100)
    updateSet(exLocalId, set.localId, field, next)
  }

  const currentExerciseIds = exercises.map(e => e.exercise_id).filter(Boolean) as number[]

  // ── No session: offer to start one ─────────────────────────────────────────
  if (!workoutDate) {
    return (
      <div className="max-w-md mx-auto py-8 text-center">
        <Dumbbell size={26} className="mx-auto text-faint" />
        <h2 className="mt-4 text-lg font-semibold">No workout in progress</h2>
        <p className="mt-1.5 text-sm text-muted leading-relaxed">
          Start from a routine to load your usual exercises, or begin an empty session and add
          exercises as you go. Sets you log are saved automatically.
        </p>
        <button onClick={() => setStartPickerOpen(true)} className="btn-primary btn-lg mt-5">
          <Plus size={17} /> Start workout
        </button>

        <TemplateSelector
          isOpen={startPickerOpen}
          onClose={() => setStartPickerOpen(false)}
          onSelect={handleStart}
        />
      </div>
    )
  }

  const sessionMeta = (
    <>
      <span className="num font-semibold text-ink">{elapsed ?? '—'}</span>
      <span className="text-faint">·</span>
      <span className="num">{exercises.length} ex</span>
      <span className="text-faint">·</span>
      <span className="num">{totalSets} sets</span>
      {volume > 0 && (
        <>
          <span className="text-faint">·</span>
          <span className="num">{volume.toLocaleString()} kg</span>
        </>
      )}
    </>
  )

  return (
    <div className="pb-16 lg:pb-0">
      {/* ── Session header ──────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">
              {isEditing ? 'Editing workout' : 'Workout'}
            </h1>
            <span className="text-sm text-muted num">{formattedDate}</span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-muted">
            {sessionMeta}
            {isDraft && (
              <>
                <span className="text-faint">·</span>
                <span
                  className={
                    saveStatus === 'error' ? 'text-danger' : saveStatus === 'saving' ? 'text-warn' : 'text-muted'
                  }
                  title="Changes save automatically"
                >
                  {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved'}
                </span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          className="btn-primary hidden lg:inline-flex"
          disabled={exercises.length === 0}
        >
          <Check size={16} strokeWidth={2.5} />
          {isEditing ? 'Save changes' : 'Finish workout'}
        </button>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-8 lg:items-start">
        {/* ── Exercise log ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          {exercises.length === 0 && (
            <div className="panel px-4 py-8 text-center">
              <p className="text-sm text-muted">
                Empty session. Add your first exercise to start logging sets.
              </p>
              <button onClick={() => setExercisePickerOpen(true)} className="btn-secondary mt-4">
                <Plus size={16} /> Add exercise
              </button>
            </div>
          )}

          {exercises.map((ex, exIdx) => {
            const last = ex.exercise_id ? lastPerf.get(ex.exercise_id) : undefined
            const oneRm = best1RM(ex.sets)
            const lastRm = last ? best1RM(last.sets) : null
            const rmChangePct =
              oneRm && lastRm && lastRm.value > 0
                ? ((oneRm.value - lastRm.value) / lastRm.value) * 100
                : null
            return (
              <section key={ex.localId} className="panel">
                {/* Exercise header */}
                <div className="flex items-center gap-2 px-3 sm:px-4 h-12 border-b border-line">
                  <span className="num text-xs font-bold text-faint w-4 shrink-0">{exIdx + 1}</span>
                  <div className="flex-1 min-w-0">
                    {editingExercise === ex.localId ? (
                      <ExerciseInlineSearch
                        value={ex.exercise_name}
                        allExercises={allExercises}
                        onSelect={e => {
                          updateExerciseName(ex.localId, e.id, e.name)
                          setEditingExercise(null)
                        }}
                        onBlur={() => setEditingExercise(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingExercise(ex.localId)}
                        className="group flex items-center gap-1.5 max-w-full text-left"
                      >
                        <span className="font-semibold truncate">
                          {ex.exercise_name || <span className="text-faint">Select exercise…</span>}
                        </span>
                        <ChevronDown size={14} className="shrink-0 text-faint group-hover:text-muted" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => removeExercise(ex.localId)}
                    className="icon-btn shrink-0 hover:text-danger"
                    aria-label={`Remove ${ex.exercise_name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Last time */}
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-line bg-raised">
                  {last ? (
                    <>
                      <span className="text-2xs font-semibold uppercase tracking-wide text-faint shrink-0">
                        Last {shortDate(last.date)}
                      </span>
                      <span className="num text-[0.8125rem] text-muted truncate">
                        {last.sets.map(fmtSet).join('  ')}
                      </span>
                      {ex.sets.length === 0 && (
                        <button
                          onClick={() =>
                            replaceSets(
                              ex.localId,
                              last.sets.map(s => ({ reps: s.reps, weight_kg: s.weight_kg }))
                            )
                          }
                          className="ml-auto shrink-0 flex items-center gap-1 text-[0.8125rem] font-semibold text-accent hover:underline"
                        >
                          <Copy size={13} /> Repeat
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-2xs font-semibold uppercase tracking-wide text-faint">
                      First time logging this
                    </span>
                  )}
                </div>

                {/* Sets */}
                {ex.sets.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-3 sm:px-4 pt-2.5 pb-1 text-2xs font-semibold uppercase tracking-wide text-faint">
                      <span className="w-4 shrink-0">Set</span>
                      {last && <span className="w-14 shrink-0">Prev</span>}
                      <span className="flex-1 text-center">kg</span>
                      <span className="flex-1 text-center">Reps</span>
                      <span className="w-11 shrink-0" />
                    </div>

                    <ul className="divide-y divide-line">
                      {ex.sets.map((s, sIdx) => {
                        const prevSet = last?.sets[sIdx]
                        const isDone = doneSets.has(s.localId)
                        const isActive = activeSet === s.localId
                        return (
                          <li key={s.localId} className={isDone ? 'bg-success-soft' : undefined}>
                            <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5">
                              <span className="w-4 shrink-0 num text-sm font-semibold text-muted">
                                {s.set_number}
                              </span>
                              {last && (
                                <span className="w-14 shrink-0 num text-[0.8125rem] text-faint">
                                  {prevSet ? fmtSet(prevSet) : '—'}
                                </span>
                              )}
                              <div className="flex-1">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step={WEIGHT_STEP}
                                  className="num-input"
                                  placeholder={prevSet?.weight_kg != null ? String(prevSet.weight_kg) : '0'}
                                  value={s.weight_kg ?? ''}
                                  onFocus={() => setActiveSet(s.localId)}
                                  onChange={e =>
                                    updateSet(ex.localId, s.localId, 'weight_kg', e.target.value === '' ? null : Number(e.target.value))
                                  }
                                  aria-label={`Set ${s.set_number} weight in kg`}
                                />
                              </div>
                              <div className="flex-1">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  className="num-input"
                                  placeholder={prevSet?.reps != null ? String(prevSet.reps) : '0'}
                                  value={s.reps ?? ''}
                                  onFocus={() => setActiveSet(s.localId)}
                                  onChange={e =>
                                    updateSet(ex.localId, s.localId, 'reps', e.target.value === '' ? null : Number(e.target.value))
                                  }
                                  aria-label={`Set ${s.set_number} reps`}
                                />
                              </div>
                              <button
                                onClick={() => toggleDone(s.localId)}
                                className={`w-11 h-12 shrink-0 grid place-items-center rounded-lg border transition-colors ${
                                  isDone
                                    ? 'border-success bg-success text-white'
                                    : 'border-line text-faint hover:text-ink hover:border-line-strong'
                                }`}
                                aria-label={isDone ? `Set ${s.set_number} done` : `Mark set ${s.set_number} done`}
                                aria-pressed={isDone}
                              >
                                <Check size={17} strokeWidth={3} />
                              </button>
                            </div>

                            {/* Quick adjust — only on the set being edited */}
                            {isActive && (
                              <div className="flex items-center gap-2 px-3 sm:px-4 pb-2">
                                <Stepper
                                  onMinus={() => bump(ex.localId, s, 'weight_kg', -WEIGHT_STEP, prevSet?.weight_kg ?? 0)}
                                  onPlus={() => bump(ex.localId, s, 'weight_kg', WEIGHT_STEP, prevSet?.weight_kg ?? 0)}
                                  label={`${WEIGHT_STEP} kg`}
                                  hint="weight"
                                />
                                <Stepper
                                  onMinus={() => bump(ex.localId, s, 'reps', -1, prevSet?.reps ?? 0)}
                                  onPlus={() => bump(ex.localId, s, 'reps', 1, prevSet?.reps ?? 0)}
                                  label="1 rep"
                                  hint="reps"
                                />
                                <button
                                  onClick={() => {
                                    removeSet(ex.localId, s.localId)
                                    setActiveSet(null)
                                  }}
                                  className="w-11 h-9 shrink-0 grid place-items-center rounded-lg text-faint hover:text-danger transition-colors"
                                  aria-label={`Delete set ${s.set_number}`}
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {/* Estimated 1RM from the best set logged so far */}
                {oneRm && (
                  <div className="border-t border-line">
                    <button
                      onClick={() => setOpenRm(openRm === ex.localId ? null : ex.localId)}
                      className="w-full flex items-center gap-2 px-3 sm:px-4 py-2 text-left hover:bg-raised transition-colors"
                      aria-expanded={openRm === ex.localId}
                    >
                      <span className="section-label shrink-0">Est. 1RM</span>
                      <span className="num text-sm font-bold">{roundHalf(oneRm.value)} kg</span>
                      <span className="num text-2xs text-faint truncate">
                        from {oneRm.weight}×{oneRm.reps}
                      </span>
                      {rmChangePct !== null && Math.round(rmChangePct) !== 0 && (
                        <span
                          className={`num text-2xs font-semibold ${
                            rmChangePct > 0 ? 'text-success' : 'text-muted'
                          }`}
                          title={`Last time: ${roundHalf(lastRm!.value)} kg`}
                        >
                          {rmChangePct > 0 ? '+' : ''}
                          {Math.round(rmChangePct)}%
                        </span>
                      )}
                      <ChevronDown
                        size={14}
                        className={`ml-auto shrink-0 text-faint transition-transform ${
                          openRm === ex.localId ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {openRm === ex.localId && <RmBreakdown oneRm={oneRm} />}
                  </div>
                )}

                <button
                  onClick={() => addSet(ex.localId)}
                  className="w-full h-11 flex items-center justify-center gap-1.5 text-sm font-semibold
                             text-accent border-t border-line rounded-b-lg hover:bg-accent-soft transition-colors"
                >
                  <Plus size={15} strokeWidth={2.5} />
                  {ex.sets.length === 0 ? 'Add first set' : 'Add set'}
                </button>
              </section>
            )
          })}

          {exercises.length > 0 && (
            <button onClick={() => setExercisePickerOpen(true)} className="btn-secondary w-full">
              <Plus size={16} /> Add exercise
            </button>
          )}

          {/* Notes */}
          <div className="pt-1">
            <label htmlFor="workout-notes" className="section-label">
              Session notes
            </label>
            <textarea
              id="workout-notes"
              className="field mt-1.5 min-h-[4.5rem] resize-y text-sm"
              placeholder="Energy, pain, machine settings, anything worth remembering next time…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* ── Desktop side rail ─────────────────────────────────────────── */}
        <aside className="hidden lg:block lg:sticky lg:top-8 space-y-4">
          <div className="panel p-4">
            <div className="section-label">This session</div>
            <div className="mt-3 grid grid-cols-2 gap-y-3">
              <RailStat label="Elapsed" value={elapsed ?? '—'} />
              <RailStat label="Volume" value={volume > 0 ? `${volume.toLocaleString()} kg` : '—'} />
              <RailStat label="Exercises" value={String(exercises.length)} />
              <RailStat label="Sets" value={String(totalSets)} />
            </div>
          </div>

          <div className="panel p-4">
            <div className="section-label mb-2.5">Rest timer</div>
            <RestTimerControl timer={rest} />
            <p className="mt-2.5 text-xs text-muted leading-relaxed">
              Ticking a set off starts the rest countdown automatically.
            </p>
          </div>
        </aside>
      </div>

      {/* ── Mobile action bar ───────────────────────────────────────────── */}
      <div
        className="lg:hidden fixed inset-x-0 z-20 border-t border-line bg-bg px-3 py-2"
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-2">
          <RestTimerControl timer={rest} />
          <button
            onClick={() => setConfirmOpen(true)}
            className="btn-primary flex-1 h-11"
            disabled={exercises.length === 0}
          >
            <Check size={16} strokeWidth={2.5} />
            {isEditing ? 'Save changes' : 'Finish'}
          </button>
        </div>
      </div>

      {/* Exercise picker */}
      <ExercisePicker
        isOpen={exercisePickerOpen}
        onClose={() => setExercisePickerOpen(false)}
        onSelect={ex => addExercise(ex.id, ex.name)}
        excludeIds={currentExerciseIds}
      />

      {/* Finish / discard */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={isEditing ? 'Save changes?' : 'Finish workout?'}
      >
        <div className="space-y-4">
          <dl className="divide-y divide-line border-y border-line">
            <SummaryRow label="Exercises" value={String(exercises.length)} />
            <SummaryRow label="Sets logged" value={String(validSetCount)} />
            <SummaryRow label="Volume" value={volume > 0 ? `${volume.toLocaleString()} kg` : '—'} />
            {elapsed && <SummaryRow label="Duration" value={elapsed} />}
          </dl>
          <p className="text-sm text-muted leading-relaxed">
            {isEditing
              ? 'This replaces the saved workout and recalculates personal records.'
              : 'Personal records are recalculated when you finish.'}
          </p>
          <div className="flex gap-2">
            <button onClick={handleFinish} disabled={saving} className="btn-primary flex-1">
              {saving && <Spinner size="sm" />}
              {isEditing ? 'Save changes' : 'Finish workout'}
            </button>
            <button onClick={() => setConfirmOpen(false)} className="btn-secondary">
              Keep going
            </button>
          </div>
          <button
            onClick={isEditing ? () => { clearSession(); navigate('/') } : handleDiscard}
            disabled={saving}
            className="w-full h-9 text-sm font-semibold text-danger hover:bg-danger-soft rounded-lg transition-colors disabled:opacity-50"
          >
            {isEditing ? 'Discard changes' : 'Discard workout'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function Stepper({
  onMinus,
  onPlus,
  label,
  hint,
}: {
  onMinus: () => void
  onPlus: () => void
  label: string
  hint: string
}) {
  return (
    <div className="flex-1 flex items-center rounded-lg border border-line overflow-hidden h-9">
      <button
        onClick={onMinus}
        className="w-9 h-full grid place-items-center text-muted hover:bg-raised hover:text-ink transition-colors"
        aria-label={`${hint}: minus ${label}`}
      >
        <Minus size={15} strokeWidth={2.5} />
      </button>
      <span className="flex-1 text-center text-2xs font-semibold text-faint select-none">{label}</span>
      <button
        onClick={onPlus}
        className="w-9 h-full grid place-items-center text-muted hover:bg-raised hover:text-ink transition-colors"
        aria-label={`${hint}: plus ${label}`}
      >
        <Plus size={15} strokeWidth={2.5} />
      </button>
    </div>
  )
}

/** Epley predictions for common rep targets, derived from the session's best set. */
function RmBreakdown({ oneRm }: { oneRm: Estimated1RM }) {
  return (
    <div className="border-t border-line bg-raised px-3 sm:px-4 py-2.5">
      <p className="text-2xs text-muted leading-relaxed">
        Epley estimate from your best set today. Roughly the weight (kg) you should manage for:
      </p>
      <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {RM_TARGETS.map(r => (
          <div key={r} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-center">
            <div className="num text-2xs text-faint">
              {r} rep{r === 1 ? '' : 's'}
            </div>
            <div className="num text-sm font-bold leading-tight">
              {roundHalf(weightForReps(oneRm.value, r))}
            </div>
          </div>
        ))}
      </div>
      {!oneRm.reliable && (
        <p className="mt-2 text-2xs text-warn leading-relaxed">
          Your best set was {oneRm.reps} reps. Past {E1RM_REP_LIMIT} the formula runs high — treat
          this as a ceiling, not a number to load up.
        </p>
      )}
    </div>
  )
}

function RailStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xs text-faint font-semibold uppercase tracking-wide">{label}</div>
      <div className="num text-lg font-bold leading-tight mt-0.5">{value}</div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num text-sm font-semibold">{value}</dd>
    </div>
  )
}

// ─── Inline exercise search ──────────────────────────────────────────────────

interface ExerciseInlineSearchProps {
  value: string
  allExercises: Exercise[]
  onSelect: (ex: Exercise) => void
  onBlur: () => void
}

function ExerciseInlineSearch({ value, allExercises, onSelect, onBlur }: ExerciseInlineSearchProps) {
  const [query, setQuery] = useState(value)
  const filtered = allExercises
    .filter(ex => ex.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)

  return (
    <div className="relative">
      <input
        autoFocus
        type="text"
        className="field h-9 text-sm"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onBlur={() => setTimeout(onBlur, 200)}
        placeholder="Search exercise…"
      />
      {filtered.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 z-20 bg-surface border border-line rounded-lg
                       overflow-hidden shadow-[var(--shadow-pop)] max-h-56 overflow-y-auto">
          {filtered.map(ex => (
            <li key={ex.id}>
              <button
                onMouseDown={e => { e.preventDefault(); onSelect(ex) }}
                className="w-full text-left px-3 h-10 text-sm hover:bg-raised transition-colors"
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
