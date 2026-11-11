import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Play, Plus } from 'lucide-react'
import Calendar from '../components/Calendar'
import TemplateSelector from '../components/TemplateSelector'
import WorkoutSummary from '../components/WorkoutSummary'
import Skeleton from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { useWorkoutSession } from '../contexts/WorkoutContext'
import { useToast } from '../components/Toast'
import { fetchWorkoutByDate, fetchDraftWorkout } from '../services/workoutService'
import { fetchPersonalRecords } from '../services/prService'
import { fetchWorkoutHistory, workoutVolume, DetailedWorkout } from '../services/statsService'
import { WorkoutTemplate, Workout, WorkoutExercise, PersonalRecord } from '../types/database'
import { formatDate, toIsoDate, todayIso, weekStart } from '../lib/dates'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function DashboardPage() {
  const { user } = useAuth()
  const { initSession, initEditSession, resumeDraftSession, hasActiveSession, exercises } =
    useWorkoutSession()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryDate, setSummaryDate] = useState<string>(todayIso())
  const [summaryWorkout, setSummaryWorkout] = useState<(Workout & { workout_exercises: WorkoutExercise[] }) | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [prs, setPrs] = useState<PersonalRecord[]>([])
  const [history, setHistory] = useState<DetailedWorkout[]>([])
  const [loading, setLoading] = useState(true)

  // Load PRs + recent history
  useEffect(() => {
    if (!user) return
    setLoading(true)
    const from = new Date()
    from.setDate(from.getDate() - 120)
    Promise.all([fetchPersonalRecords(user.id), fetchWorkoutHistory(user.id, toIsoDate(from))])
      .then(([prData, hist]) => {
        setPrs(prData.slice(0, 6))
        setHistory(hist)
      })
      .catch(err => showToast(err instanceof Error ? err.message : 'Failed to load your data', 'error'))
      .finally(() => setLoading(false))
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // If no active local session, check the DB for an unfinished draft for today
  useEffect(() => {
    if (!user || hasActiveSession) return
    fetchDraftWorkout(user.id, todayIso())
      .then(draft => { if (draft) resumeDraftSession(draft) })
      .catch(() => { /* ignore */ })
  }, [user, hasActiveSession, resumeDraftSession])

  const handleDayClick = useCallback(async (date: string) => {
    if (!user) return
    setSummaryDate(date)
    setSummaryOpen(true)
    setSummaryLoading(true)
    try {
      const workout = await fetchWorkoutByDate(user.id, date)
      setSummaryWorkout(workout)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load workout', 'error')
    } finally {
      setSummaryLoading(false)
    }
  }, [user, showToast])

  const handleEditWorkout = (w: Workout & { workout_exercises: WorkoutExercise[] }) => {
    initEditSession(w)
    navigate('/workout')
  }

  const handleTemplateSelect = (template: WorkoutTemplate | null) => {
    const picked = template?.template_exercises
      ?.slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(te => ({ exercise_id: te.exercise_id, exercise_name: te.exercise?.name ?? 'Unknown' }))
    initSession(todayIso(), picked)
    navigate('/workout')
  }

  const doneDates = useMemo(() => new Set(history.map(w => w.workout_date)), [history])

  const week = useMemo(() => {
    const start = weekStart()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const date = toIsoDate(d)
      return {
        date,
        letter: DAY_LETTERS[i],
        dayNum: d.getDate(),
        done: doneDates.has(date),
        isToday: date === todayIso(),
        isFuture: date > todayIso(),
      }
    })
  }, [doneDates])

  const weekCount = week.filter(d => d.done).length
  const sessionSetCount = exercises.reduce((n, e) => n + e.sets.length, 0)

  const longDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div className="space-y-8">
      {/* ── Today ───────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="hidden lg:block text-xl font-bold tracking-tight">Today</h1>
          <p className="text-sm text-muted lg:text-right">{longDate}</p>
        </div>

        <div className="mt-3 panel p-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
          {hasActiveSession ? (
            <>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="section-label text-accent">Workout in progress</span>
                </div>
                <p className="mt-1.5 text-sm text-muted num">
                  {exercises.length} exercise{exercises.length === 1 ? '' : 's'} · {sessionSetCount} set
                  {sessionSetCount === 1 ? '' : 's'} logged
                </p>
              </div>
              <button
                onClick={() => navigate('/workout')}
                className="btn-primary btn-lg w-full sm:w-auto mt-4 sm:mt-0"
              >
                <Play size={17} /> Continue
              </button>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <p className="font-semibold">Ready to train?</p>
                <p className="mt-0.5 text-sm text-muted">
                  {weekCount === 0
                    ? 'No sessions logged this week yet.'
                    : `${weekCount} session${weekCount === 1 ? '' : 's'} done this week.`}
                </p>
              </div>
              <button
                onClick={() => setTemplateSelectorOpen(true)}
                className="btn-primary btn-lg w-full sm:w-auto mt-4 sm:mt-0"
              >
                <Plus size={17} /> Start workout
              </button>
            </>
          )}
        </div>

        {/* Week strip */}
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {week.map(d => (
            <button
              key={d.date}
              onClick={() => handleDayClick(d.date)}
              disabled={d.isFuture && !d.done}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg border transition-colors
                ${d.done
                  ? 'border-accent bg-accent-soft text-accent'
                  : d.isFuture
                  ? 'border-line text-faint cursor-default'
                  : 'border-line text-muted hover:bg-raised'}
                ${d.isToday && !d.done ? 'ring-1 ring-inset ring-line-strong' : ''}`}
            >
              <span className="text-2xs font-semibold uppercase">{d.letter}</span>
              <span className="num text-sm font-bold">{d.dayNum}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10 space-y-8 lg:space-y-0">
        {/* ── Recent workouts ─────────────────────────────────────────────── */}
        <section>
          <h2 className="font-semibold">Recent workouts</h2>
          {loading ? (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="mt-3 panel p-5">
              <p className="text-sm font-semibold">Nothing logged yet</p>
              <p className="mt-1 text-sm text-muted leading-relaxed">
                Finish your first session and it will show up here with volume, exercises and
                personal records. Build a routine first if you always train the same lifts.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setTemplateSelectorOpen(true)} className="btn-primary">
                  <Plus size={16} /> Start workout
                </button>
                <button onClick={() => navigate('/templates')} className="btn-secondary">
                  Create a routine
                </button>
              </div>
            </div>
          ) : (
            <ul className="mt-2 border-t border-line">
              {history.slice(0, 6).map(w => {
                const vol = Math.round(workoutVolume(w))
                const setCount = (w.workout_exercises ?? []).reduce(
                  (n, we) => n + (we.workout_sets ?? []).length, 0
                )
                const names = (w.workout_exercises ?? [])
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map(we => we.exercise?.name)
                  .filter(Boolean)
                return (
                  <li key={w.id} className="border-b border-line">
                    <button
                      onClick={() => handleDayClick(w.workout_date)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-raised transition-colors px-1 -mx-1"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold num">
                            {formatDate(w.workout_date, {
                              weekday: 'short', month: 'short', day: 'numeric',
                            })}
                          </span>
                          <span className="text-2xs text-faint num">{setCount} sets</span>
                        </div>
                        <p className="mt-0.5 text-[0.8125rem] text-muted truncate">
                          {names.join(' · ') || 'No exercises'}
                        </p>
                      </div>
                      <span className="num text-sm font-semibold shrink-0">
                        {vol > 0 ? `${vol.toLocaleString()} kg` : '—'}
                      </span>
                      <ChevronRight size={15} className="text-faint shrink-0" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ── Side column ─────────────────────────────────────────────────── */}
        <div className="space-y-8">
          <Calendar onDayClick={handleDayClick} />

          <section>
            <h2 className="font-semibold">Personal records</h2>
            {loading ? (
              <div className="mt-3 space-y-2">
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : prs.length === 0 ? (
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Records appear once you finish a workout with weight and reps filled in.
              </p>
            ) : (
              <ul className="mt-2 border-t border-line">
                {prs.map(pr => (
                  <li
                    key={pr.id}
                    className="flex items-center justify-between gap-3 py-2.5 border-b border-line"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{pr.exercise?.name}</p>
                      <p className="text-2xs text-faint">
                        {pr.record_type === 'max_weight' ? 'Heaviest set' : 'Most reps'} ·{' '}
                        {new Date(pr.achieved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <span className="num text-sm font-bold shrink-0">
                      {pr.record_type === 'max_weight' ? `${pr.value} kg` : `${pr.value} reps`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <TemplateSelector
        isOpen={templateSelectorOpen}
        onClose={() => setTemplateSelectorOpen(false)}
        onSelect={handleTemplateSelect}
      />

      <WorkoutSummary
        isOpen={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        workout={summaryWorkout}
        loading={summaryLoading}
        date={summaryDate}
        onStartWorkout={
          summaryDate === todayIso() && !hasActiveSession
            ? () => setTemplateSelectorOpen(true)
            : undefined
        }
        onEditWorkout={handleEditWorkout}
      />
    </div>
  )
}
