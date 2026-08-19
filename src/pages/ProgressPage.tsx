import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import Skeleton from '../components/Skeleton'
import {
  fetchWorkoutHistory,
  computeOverviewStats,
  buildExerciseSeries,
  workoutVolume,
  DetailedWorkout,
  ExercisePoint,
} from '../services/statsService'

type Metric = 'maxWeight' | 'volume' | 'maxReps'

const METRIC_LABELS: Record<Metric, string> = {
  maxWeight: 'Top weight',
  volume: 'Session volume',
  maxReps: 'Best reps',
}
const METRIC_UNITS: Record<Metric, string> = {
  maxWeight: 'kg',
  volume: 'kg',
  maxReps: 'reps',
}
const WEEKS_SHOWN = 12

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function weekStart(d: Date) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7))
  copy.setHours(0, 0, 0, 0)
  return copy
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

  // Volume per calendar week, oldest first, including weeks without a session
  const weeklyVolume = useMemo(() => {
    const byWeek = new Map<string, number>()
    for (const w of history) {
      const key = isoDate(weekStart(new Date(w.workout_date + 'T12:00:00')))
      byWeek.set(key, (byWeek.get(key) ?? 0) + workoutVolume(w))
    }
    const cursor = weekStart(new Date())
    cursor.setDate(cursor.getDate() - 7 * (WEEKS_SHOWN - 1))
    return Array.from({ length: WEEKS_SHOWN }, () => {
      const key = isoDate(cursor)
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

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8 lg:items-start space-y-8 lg:space-y-0">
        {/* ── Exercise progression ───────────────────────────────────────── */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Exercise progression</h2>
            <div className="seg" role="group" aria-label="Metric">
              {(Object.keys(METRIC_LABELS) as Metric[]).map(m => (
                <button key={m} onClick={() => setMetric(m)} aria-pressed={metric === m}>
                  {m === 'maxWeight' ? 'Weight' : m === 'volume' ? 'Volume' : 'Reps'}
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

          <LineChart points={series} metric={metric} />
        </section>

        {/* ── Weekly volume ──────────────────────────────────────────────── */}
        <section>
          <h2 className="font-semibold">Weekly volume</h2>
          <p className="mt-0.5 text-xs text-muted">Last {WEEKS_SHOWN} weeks, total kg lifted</p>
          <WeeklyVolume data={weeklyVolume} />
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

// ─── Line chart (plain SVG, no dependencies) ─────────────────────────────────

function LineChart({ points, metric }: { points: ExercisePoint[]; metric: Metric }) {
  if (points.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted">No sets recorded for this exercise yet.</p>
    )
  }

  const values = points.map(p => p[metric])
  const W = 640
  const H = 240
  const PAD = { top: 14, right: 10, bottom: 26, left: 46 }

  const maxV = Math.max(...values)
  const minV = Math.min(...values)
  const span = maxV - minV || Math.max(1, maxV * 0.1)
  const yMax = maxV + span * 0.12
  const yMin = Math.max(0, minV - span * 0.12)

  const x = (i: number) =>
    points.length === 1 ? (W + PAD.left - PAD.right) / 2 : PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom)

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[metric]).toFixed(1)}`).join(' ')
  const areaPath = `${path} L${x(points.length - 1).toFixed(1)},${H - PAD.bottom} L${x(0).toFixed(1)},${H - PAD.bottom} Z`

  const fmtDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const gridVals = [yMin, (yMin + yMax) / 2, yMax]
  const latest = values[values.length - 1]
  const previous = values.length > 1 ? values[values.length - 2] : null
  const best = Math.max(...values)
  const delta = previous !== null ? latest - previous : null
  const unit = METRIC_UNITS[metric]

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <div className="section-label">{METRIC_LABELS[metric]}, latest</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="num text-2xl font-bold leading-none">{latest.toLocaleString()}</span>
            <span className="text-xs text-muted">{unit}</span>
            {delta !== null && delta !== 0 && (
              <span
                className={`num text-xs font-semibold ${delta > 0 ? 'text-success' : 'text-muted'}`}
                title="Change since the previous session"
              >
                {delta > 0 ? '+' : ''}{Math.round(delta * 10) / 10}
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="section-label">Best</div>
          <div className="mt-0.5 num text-2xl font-bold leading-none">{best.toLocaleString()}</div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full mt-3"
        role="img"
        aria-label={`${METRIC_LABELS[metric]} over time`}
      >
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(v) + 4} fill="var(--text-faint)" fontSize="11" textAnchor="end">
              {Math.round(v).toLocaleString()}
            </text>
          </g>
        ))}

        {points.length > 1 && <path d={areaPath} fill="var(--accent-soft)" />}
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p[metric])} r="3" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2">
            <title>{`${fmtDate(p.date)} — ${p[metric].toLocaleString()} ${unit}`}</title>
          </circle>
        ))}

        <text
          x={x(0)}
          y={H - 7}
          fill="var(--text-faint)"
          fontSize="11"
          textAnchor={points.length === 1 ? 'middle' : 'start'}
        >
          {fmtDate(points[0].date)}
        </text>
        {points.length > 1 && (
          <text x={x(points.length - 1)} y={H - 7} fill="var(--text-faint)" fontSize="11" textAnchor="end">
            {fmtDate(points[points.length - 1].date)}
          </text>
        )}
      </svg>
    </div>
  )
}

// ─── Weekly volume bars ──────────────────────────────────────────────────────

function WeeklyVolume({ data }: { data: { week: string; volume: number }[] }) {
  const max = Math.max(...data.map(d => d.volume), 1)
  const label = (week: string) =>
    new Date(week + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="mt-3">
      <div className="flex items-end gap-1 h-32">
        {data.map(d => (
          <div key={d.week} className="flex-1 h-full flex items-end" title={`Week of ${label(d.week)} — ${d.volume.toLocaleString()} kg`}>
            <div
              className={`w-full rounded-sm ${d.volume > 0 ? 'bg-accent' : 'bg-line'}`}
              style={{ height: d.volume > 0 ? `${Math.max(4, (d.volume / max) * 100)}%` : '2px' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-2xs text-faint num">
        <span>{label(data[0].week)}</span>
        <span>This week</span>
      </div>
    </div>
  )
}
