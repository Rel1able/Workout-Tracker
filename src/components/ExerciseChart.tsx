import { useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { ExercisePoint } from '../services/statsService'
import { formatDate } from '../lib/dates'

export type Metric = 'maxWeight' | 'est1RM' | 'volume' | 'maxReps'

export const METRIC_LABELS: Record<Metric, string> = {
  maxWeight: 'Top weight',
  est1RM: 'Estimated 1RM',
  volume: 'Session volume',
  maxReps: 'Best reps',
}
export const METRIC_SHORT: Record<Metric, string> = {
  maxWeight: 'Weight',
  est1RM: '1RM',
  volume: 'Volume',
  maxReps: 'Reps',
}
export const METRIC_UNITS: Record<Metric, string> = {
  maxWeight: 'kg',
  est1RM: 'kg',
  volume: 'kg',
  maxReps: 'reps',
}

// SVG coordinate space. The SVG scales to its container width via viewBox.
const W = 640
const H = 240
const PAD = { top: 14, right: 10, bottom: 26, left: 46 }
const PLOT_W = W - PAD.left - PAD.right

/**
 * Line chart of one metric across sessions (plain SVG, no chart library).
 *
 * A point is selected by hovering (mouse), tapping or dragging (touch/pen),
 * or with the arrow keys once the chart has focus. The selection shows a
 * guide line and a readout with that session's date and numbers. Mouse
 * selection clears when the cursor leaves; touch selection stays until the
 * next tap, because a finger "leaving" is just lifting it to read.
 */
export default function ExerciseChart({ points, metric }: { points: ExercisePoint[]; metric: Metric }) {
  const [active, setActive] = useState<number | null>(null)

  // A different exercise or metric means old indices no longer make sense
  useEffect(() => setActive(null), [points, metric])

  if (points.length === 0) {
    return <p className="mt-4 text-sm text-muted">No sets recorded for this exercise yet.</p>
  }

  const values = points.map(p => p[metric])
  const maxV = Math.max(...values)
  const minV = Math.min(...values)
  const span = maxV - minV || Math.max(1, maxV * 0.1)
  const yMax = maxV + span * 0.12
  const yMin = Math.max(0, minV - span * 0.12)

  const x = (i: number) =>
    points.length === 1 ? PAD.left + PLOT_W / 2 : PAD.left + (i / (points.length - 1)) * PLOT_W
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom)

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[metric]).toFixed(1)}`).join(' ')
  const areaPath = `${path} L${x(points.length - 1).toFixed(1)},${H - PAD.bottom} L${x(0).toFixed(1)},${H - PAD.bottom} Z`

  const gridVals = [yMin, (yMin + yMax) / 2, yMax]
  const latest = values[values.length - 1]
  const previous = values.length > 1 ? values[values.length - 2] : null
  const best = maxV
  const delta = previous !== null ? latest - previous : null
  const unit = METRIC_UNITS[metric]

  /** Nearest point to the pointer, by horizontal position only. */
  function indexAt(e: PointerEvent<SVGSVGElement>) {
    if (points.length === 1) return 0
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((svgX - PAD.left) / PLOT_W) * (points.length - 1))
    return Math.min(points.length - 1, Math.max(0, i))
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    const last = points.length - 1
    if (e.key === 'ArrowLeft') setActive(a => Math.max(0, (a ?? last + 1) - 1))
    else if (e.key === 'ArrowRight') setActive(a => Math.min(last, (a ?? -1) + 1))
    else if (e.key === 'Escape') setActive(null)
    else return
    e.preventDefault()
  }

  const sel = active !== null ? points[active] : null
  // Readout position as % of chart width, kept away from the edges so it never clips
  const selLeftPct = active !== null ? (x(active) / W) * 100 : 0
  const readoutAlign =
    selLeftPct < 20 ? 'translate-x-0' : selLeftPct > 80 ? '-translate-x-full' : '-translate-x-1/2'
  // Put the readout in whichever half of the plot the selected point is NOT in
  const readoutVertical = sel && y(sel[metric]) < H / 2 ? 'bottom-8' : 'top-0'

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
                {delta > 0 ? '+' : ''}
                {Math.round(delta * 10) / 10}
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="section-label">Best</div>
          <div className="mt-0.5 num text-2xl font-bold leading-none">{best.toLocaleString()}</div>
        </div>
      </div>

      <div className="relative mt-3">
        {sel && (
          <div
            className={`pointer-events-none absolute z-10 ${readoutVertical} ${readoutAlign} rounded-md border border-line-strong bg-raised px-2.5 py-1.5 shadow-[var(--shadow-pop)]`}
            style={{ left: `${selLeftPct}%` }}
            role="status"
          >
            <div className="text-2xs text-muted whitespace-nowrap">
              {formatDate(sel.date, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div className="num text-sm font-bold whitespace-nowrap">
              {sel[metric].toLocaleString()} <span className="text-xs font-normal text-muted">{unit}</span>
            </div>
            <div className="num text-2xs text-faint whitespace-nowrap">
              {sel.maxWeight} kg top · {sel.maxReps} reps · {sel.volume.toLocaleString()} kg vol
            </div>
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          // touch-pan-y: vertical swipes still scroll the page, horizontal drags scrub the chart
          className="w-full touch-pan-y select-none cursor-crosshair rounded-md"
          role="img"
          aria-label={`${METRIC_LABELS[metric]} over time. Use left and right arrow keys to inspect sessions.`}
          tabIndex={0}
          onPointerDown={e => setActive(indexAt(e))}
          onPointerMove={e => setActive(indexAt(e))}
          onPointerLeave={e => {
            if (e.pointerType === 'mouse') setActive(null)
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
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

          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--line-strong)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p[metric])}
              r={i === active ? 5.5 : 3}
              fill={i === active ? 'var(--accent)' : 'var(--bg)'}
              stroke="var(--accent)"
              strokeWidth="2"
            />
          ))}

          <text
            x={x(0)}
            y={H - 7}
            fill="var(--text-faint)"
            fontSize="11"
            textAnchor={points.length === 1 ? 'middle' : 'start'}
          >
            {formatDate(points[0].date)}
          </text>
          {points.length > 1 && (
            <text x={x(points.length - 1)} y={H - 7} fill="var(--text-faint)" fontSize="11" textAnchor="end">
              {formatDate(points[points.length - 1].date)}
            </text>
          )}
        </svg>
      </div>

      <p className="mt-1 text-2xs text-faint lg:hidden">Tap or drag across the chart to see each session.</p>

      {metric === 'est1RM' && (
        <p className="mt-2 text-2xs text-muted leading-relaxed">
          Epley estimate (weight × (1 + reps/30)) from the best set of each session. Sessions with
          no weight logged plot as zero.
        </p>
      )}
    </div>
  )
}
