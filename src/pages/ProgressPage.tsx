import { useState, useEffect, useMemo } from 'react'
import { Flame, CalendarCheck, Weight, TrendingUp, Hash } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import Spinner from '../components/Spinner'
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
  maxWeight: 'Top weight (kg)',
  volume: 'Volume (kg)',
  maxReps: 'Max reps',
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

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Progress</h1>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<CalendarCheck size={18} className="text-emerald-400" />} label="This week" value={String(stats.thisWeek)} />
        <StatCard icon={<Flame size={18} className="text-orange-400" />} label="Week streak" value={String(stats.streakWeeks)} />
        <StatCard icon={<Hash size={18} className="text-sky-400" />} label="This month" value={String(stats.thisMonth)} />
        <StatCard icon={<Weight size={18} className="text-purple-400" />} label="Month volume" value={`${stats.monthVolume.toLocaleString()} kg`} />
      </div>

      {/* Exercise progression chart */}
      <div className="card space-y-4">
        <h2 className="font-bold text-white flex items-center gap-2">
          <TrendingUp size={20} className="text-emerald-400" />
          Exercise Progression
        </h2>

        {exerciseOptions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">
            No workout history yet. Finish a workout to see your progress here.
          </p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className="input flex-1"
                value={selectedExercise ?? ''}
                onChange={e => setSelectedExercise(Number(e.target.value))}
              >
                {exerciseOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} ({opt.count}×)
                  </option>
                ))}
              </select>
              <div className="flex rounded-xl border border-gray-700 overflow-hidden text-sm">
                {(Object.keys(METRIC_LABELS) as Metric[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`px-3 py-2 font-medium transition-colors flex-1 whitespace-nowrap ${
                      metric === m ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    {m === 'maxWeight' ? 'Weight' : m === 'volume' ? 'Volume' : 'Reps'}
                  </button>
                ))}
              </div>
            </div>

            <LineChart points={series} metric={metric} />
          </>
        )}
      </div>

      {/* Recent workouts */}
      <div className="card space-y-3">
        <h2 className="font-bold text-white">Recent Workouts</h2>
        {history.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {history.slice(0, 10).map(w => {
              const vol = Math.round(workoutVolume(w))
              const exNames = (w.workout_exercises ?? [])
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(we => we.exercise?.name)
                .filter(Boolean)
              return (
                <li key={w.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">
                      {new Date(w.workout_date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{exNames.join(' · ')}</div>
                  </div>
                  <div className="text-emerald-400 text-sm font-semibold shrink-0 tabular-nums">
                    {vol > 0 ? `${vol.toLocaleString()} kg` : '—'}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card !p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">{icon}{label}</div>
      <div className="text-xl font-bold text-white mt-1 tabular-nums">{value}</div>
    </div>
  )
}

// ─── Lightweight SVG line chart (no dependencies) ────────────────────────────

function LineChart({ points, metric }: { points: ExercisePoint[]; metric: Metric }) {
  if (points.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-6">No data for this exercise yet.</p>
  }

  const values = points.map(p => p[metric])
  const W = 600
  const H = 220
  const PAD = { top: 16, right: 16, bottom: 28, left: 44 }

  const maxV = Math.max(...values)
  const minV = Math.min(...values)
  const span = maxV - minV || 1
  // Pad the value range 10% so the line doesn't hug the edges
  const yMax = maxV + span * 0.1
  const yMin = Math.max(0, minV - span * 0.1)

  const x = (i: number) =>
    points.length === 1
      ? W / 2
      : PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) =>
    PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom)

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[metric]).toFixed(1)}`).join(' ')
  const areaPath = `${path} L${x(points.length - 1).toFixed(1)},${H - PAD.bottom} L${x(0).toFixed(1)},${H - PAD.bottom} Z`

  const fmtDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Y-axis gridlines: min, mid, max
  const gridVals = [yMin, (yMin + yMax) / 2, yMax]

  const latest = values[values.length - 1]
  const best = Math.max(...values)

  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-xs text-gray-400">
        <span>Latest: <span className="text-white font-semibold tabular-nums">{latest.toLocaleString()}</span></span>
        <span>Best: <span className="text-emerald-400 font-semibold tabular-nums">{best.toLocaleString()}</span></span>
        <span className="ml-auto text-gray-600">{METRIC_LABELS[metric]}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${METRIC_LABELS[metric]} over time`}>
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#1f2937" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(v) + 4} fill="#6b7280" fontSize="11" textAnchor="end">
              {Math.round(v).toLocaleString()}
            </text>
          </g>
        ))}

        {points.length > 1 && <path d={areaPath} fill="url(#chartFill)" />}
        <path d={path} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p[metric])} r="3.5" fill="#030712" stroke="#10b981" strokeWidth="2">
            <title>{`${fmtDate(p.date)}: ${p[metric].toLocaleString()}`}</title>
          </circle>
        ))}

        <text x={x(0)} y={H - 8} fill="#6b7280" fontSize="11" textAnchor={points.length === 1 ? 'middle' : 'start'}>
          {fmtDate(points[0].date)}
        </text>
        {points.length > 1 && (
          <text x={x(points.length - 1)} y={H - 8} fill="#6b7280" fontSize="11" textAnchor="end">
            {fmtDate(points[points.length - 1].date)}
          </text>
        )}
      </svg>
    </div>
  )
}
