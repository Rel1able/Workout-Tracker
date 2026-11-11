import { useState, useEffect, useMemo } from 'react'
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import Skeleton from '../components/Skeleton'
import {
  fetchWorkoutHistory,
  computeOverviewStats,
  buildExerciseSeries,
  buildExerciseTrends,
  topMovers,
  workoutVolume,
  DetailedWorkout,
  ExerciseTrend,
  TREND_WINDOW_DAYS,
} from '../services/statsService'
import ExerciseChart, { Metric, METRIC_LABELS, METRIC_SHORT } from '../components/ExerciseChart'
import WeeklyVolumeChart, { WeekVolume } from '../components/WeeklyVolumeChart'
import { parseIsoDate, toIsoDate, weekStart } from '../lib/dates'

const WEEKS_SHOWN = 12

/** "up 18%" / "down 7%" / "level" — the wording used in the highlight lines. */
function pctWording(pct: number) {
  const rounded = Math.round(Math.abs(pct))
  if (rounded === 0) return 'held level'
  return `${pct > 0 ? 'up' : 'down'} ${rounded}%`
}

/**
 * How a trend's volume moved. A percentage when there is a baseline to divide
 * by, otherwise the direction on its own — bodyweight sets score 0 volume.
 */
function volumeWording(t: ExerciseTrend) {
  if (t.volumeChangePct !== null) return pctWording(t.volumeChangePct)
  return t.startedLoading ? 'up from bodyweight only' : 'logged'
}

/** Direction for icon/colour, without needing a percentage. */
function volumeDirection(t: ExerciseTrend) {
  if (t.volumeChangePct !== null) return t.volumeChangePct
  return t.startedLoading ? 1 : 0
}

function fmtVolume(kg: number) {
  return kg > 0 ? `${kg.toLocaleString()} kg` : 'bodyweight'
}

export default function ProgressPage() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [history, setHistory] = useState<DetailedWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExercise, setSelectedExercise] = useState<number | null>(null)
  const [metric, setMetric] = useState<Metric>('maxWeight')

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchWorkoutHistory(user.id)
      .then(setHistory)
      .catch(err => showToast(err instanceof Error ? err.message : 'Failed to load history', 'error'))
      .finally(() => setLoading(false))
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => computeOverviewStats(history), [history])

  // Exercises that appear in history, by frequency
  const exerciseOptions = useMemo(() => {
    const counts = new Map<number, { name: string; count: number }>()
    for (const w of history) {
      for (const we of w.workout_exercises ?? []) {
        if (!we.exercise?.name || (we.workout_sets ?? []).length === 0) continue
        const e = counts.get(we.exercise_id)
        if (e) e.count++
        else counts.set(we.exercise_id, { name: we.exercise.name, count: 1 })
      }
    }
    return [...counts.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
  }, [history])

  // Default to the most frequent exercise
  useEffect(() => {
    if (selectedExercise === null && exerciseOptions.length > 0) {
      setSelectedExercise(exerciseOptions[0].id)
    }
  }, [exerciseOptions, selectedExercise])

  const series = useMemo(
    () => (selectedExercise !== null ? buildExerciseSeries(history, selectedExercise) : []),
    [history, selectedExercise]
  )

  const trends = useMemo(() => buildExerciseTrends(history), [history])
  const highlights = useMemo(() => topMovers(trends), [trends])
  const selectedTrend = useMemo(
    () => trends.find(t => t.exerciseId === selectedExercise) ?? null,
    [trends, selectedExercise]
  )

  // Volume per calendar week, oldest first, including weeks without a session
  const weeklyVolume = useMemo(() => {
    const byWeek = new Map<string, number>()
    for (const w of history) {
      const key = toIsoDate(weekStart(parseIsoDate(w.workout_date)))
      byWeek.set(key, (byWeek.get(key) ?? 0) + workoutVolume(w))
    }
    const cursor = weekStart(new Date())
    cursor.setDate(cursor.getDate() - 7 * (WEEKS_SHOWN - 1))
    return Array.from({ length: WEEKS_SHOWN }, (): WeekVolume => {
      const key = toIsoDate(cursor)
      const entry = { week: key, volume: Math.round(byWeek.get(key) ?? 0) }
      cursor.setDate(cursor.getDate() + 7)
      return entry
    })
  }, [history])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="max-w-md py-6">
        <h1 className="text-xl font-bold tracking-tight">Progress</h1>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Once you finish a couple of sessions this page shows whether your lifts are moving:
          top weight per exercise over time, weekly volume, and how consistent you have been.
          Nothing to plot yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="hidden lg:block text-xl font-bold tracking-tight">Progress</h1>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line rounded-lg overflow-hidden">
        <Stat label="This week" value={String(stats.thisWeek)} unit="sessions" />
        <Stat label="Week streak" value={String(stats.streakWeeks)} unit={stats.streakWeeks === 1 ? 'week' : 'weeks'} />
        <Stat label="This month" value={String(stats.thisMonth)} unit="sessions" />
        <Stat label="Month volume" value={stats.monthVolume.toLocaleString()} unit="kg" />
      </section>

      {/* ── What changed ─────────────────────────────────────────────────── */}
      {highlights.length > 0 && (
        <section>
          <h2 className="font-semibold">What changed</h2>
          <p className="mt-0.5 text-xs text-muted">
            Last {TREND_WINDOW_DAYS} days vs the {TREND_WINDOW_DAYS} before
          </p>
          <ul className="mt-2 border-t border-line">
            {highlights.map(t => {
              const dir = volumeDirection(t)
              return (
                <li key={t.exerciseId} className="border-b border-line">
                  <button
                    onClick={() => setSelectedExercise(t.exerciseId)}
                    className="w-full flex items-center gap-3 py-3 px-1 -mx-1 text-left hover:bg-raised transition-colors"
                  >
                    <TrendIcon pct={dir} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{t.name}</span> volume{' '}
                        <span className={changeClass(dir)}>{volumeWording(t)}</span>
                      </p>
                      <p className="mt-0.5 text-2xs text-faint num">
                        {fmtVolume(t.previousVolume)} → {fmtVolume(t.volume)} · {t.sessions} session
                        {t.sessions === 1 ? '' : 's'}
                        {t.oneRmChangePct !== null &&
                          t.best1RM > 0 &&
                          Math.round(t.oneRmChangePct) !== 0 && (
                            <> · est. 1RM {pctWording(t.oneRmChangePct)} to {t.best1RM} kg</>
                          )}
                      </p>
                    </div>
                    <ArrowRight size={15} className="text-faint shrink-0" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8 lg:items-start space-y-8 lg:space-y-0">
        {/* ── Exercise progression ───────────────────────────────────────── */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Exercise progression</h2>
            <div className="seg" role="group" aria-label="Metric">
              {(Object.keys(METRIC_LABELS) as Metric[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  aria-pressed={metric === m}
                  title={METRIC_LABELS[m]}
                >
                  {METRIC_SHORT[m]}
                </button>
              ))}
            </div>
          </div>

          <select
            className="field mt-3 max-w-sm"
            value={selectedExercise ?? ''}
            onChange={e => setSelectedExercise(Number(e.target.value))}
            aria-label="Exercise"
          >
            {exerciseOptions.map(opt => (
              <option key={opt.id} value={opt.id}>
                {opt.name} — {opt.count} session{opt.count === 1 ? '' : 's'}
              </option>
            ))}
          </select>

          <ExerciseChart points={series} metric={metric} />

          {selectedTrend && <TrendPanel trend={selectedTrend} />}
        </section>

        {/* ── Weekly volume ──────────────────────────────────────────────── */}
        <section>
          <h2 className="font-semibold">Weekly volume</h2>
          <p className="mt-0.5 text-xs text-muted">Last {WEEKS_SHOWN} weeks, total kg lifted</p>
          <WeeklyVolumeChart data={weeklyVolume} />
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="section-label">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="num text-2xl font-bold leading-none">{value}</span>
        <span className="text-xs text-muted">{unit}</span>
      </div>
    </div>
  )
}

// ─── Trend readouts ──────────────────────────────────────────────────────────

/** Gains read as positive; anything else stays neutral — a deload is not a failure. */
function changeClass(pct: number) {
  return pct > 0 ? 'text-success font-semibold' : 'text-muted font-semibold'
}

function TrendIcon({ pct }: { pct: number }) {
  const Icon = pct >= 0 ? TrendingUp : TrendingDown
  return (
    <span
      className={`shrink-0 w-8 h-8 grid place-items-center rounded-lg ${
        pct > 0 ? 'bg-success-soft text-success' : 'bg-raised text-muted'
      }`}
    >
      <Icon size={16} />
    </span>
  )
}

function trendSentence(t: ExerciseTrend): string {
  if (t.sessions === 0) {
    return `No ${t.name} logged in the last ${t.windowDays} days.`
  }
  const sessions = `${t.sessions} session${t.sessions === 1 ? '' : 's'}`

  if (t.startedLoading) {
    return `${t.name} volume is up from nothing — ${t.volume.toLocaleString()} kg across ${sessions}, where the previous ${t.windowDays} days were bodyweight only. No percentage: there is no baseline to divide by.`
  }
  if (t.volumeChangePct === null) {
    if (t.volume === 0) {
      return `${t.name} is bodyweight only — ${sessions} logged, but no weight to build a volume trend from. Add the weight you hang or wear to track it.`
    }
    return `First ${t.windowDays}-day block with ${t.name} logged — ${t.volume.toLocaleString()} kg across ${sessions}.`
  }
  return `${t.name} volume ${pctWording(t.volumeChangePct)} over the last ${t.windowDays} days — ${t.volume.toLocaleString()} kg across ${sessions}, against ${t.previousVolume.toLocaleString()} kg before.`
}

function TrendPanel({ trend }: { trend: ExerciseTrend }) {
  return (
    <div className="mt-4 panel p-4">
      <div className="section-label">
        Last {trend.windowDays} days vs the {trend.windowDays} before
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <TrendCell
          label="Volume"
          value={fmtVolume(trend.volume)}
          was={fmtVolume(trend.previousVolume)}
          pct={trend.volumeChangePct}
        />
        <TrendCell
          label="Est. 1RM"
          value={trend.best1RM > 0 ? `${trend.best1RM} kg` : '—'}
          was={trend.previousBest1RM > 0 ? `${trend.previousBest1RM} kg` : '—'}
          pct={trend.oneRmChangePct}
        />
        <TrendCell
          label="Sessions"
          value={String(trend.sessions)}
          was={String(trend.previousSessions)}
          pct={null}
        />
      </dl>
      <p className="mt-3 text-xs text-muted leading-relaxed">{trendSentence(trend)}</p>
    </div>
  )
}

function TrendCell({
  label,
  value,
  was,
  pct,
}: {
  label: string
  value: string
  was: string
  pct: number | null
}) {
  return (
    <div>
      <dt className="section-label">{label}</dt>
      <dd className="mt-0.5">
        <div className="num text-lg font-bold leading-tight">{value}</div>
        <div className="mt-0.5 text-2xs num">
          {pct !== null && (
            <span className={changeClass(pct)}>
              {pct > 0 ? '+' : ''}
              {Math.round(pct)}%{' '}
            </span>
          )}
          <span className="text-faint">was {was}</span>
        </div>
      </dd>
    </div>
  )
}
