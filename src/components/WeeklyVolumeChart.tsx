import { useState } from 'react'
import { formatDate } from '../lib/dates'

export interface WeekVolume {
  /** Monday of the week, `YYYY-MM-DD`. */
  week: string
  /** Total kg lifted that week. */
  volume: number
}

/**
 * Bar per week, oldest first. Each bar is a button, so hover, tap and keyboard
 * all select it; the footer then shows that week's total instead of the range.
 */
export default function WeeklyVolumeChart({ data }: { data: WeekVolume[] }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(...data.map(d => d.volume), 1)
  const sel = active !== null ? data[active] : null

  return (
    <div className="mt-3" onMouseLeave={() => setActive(null)}>
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => (
          <button
            key={d.week}
            type="button"
            className="flex-1 h-full flex items-end rounded-sm"
            onClick={() => setActive(i === active ? null : i)}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            aria-label={`Week of ${formatDate(d.week)}: ${d.volume.toLocaleString()} kg`}
            aria-pressed={i === active}
          >
            <div
              className={`w-full rounded-sm transition-opacity ${d.volume > 0 ? 'bg-accent' : 'bg-line'} ${
                active !== null && i !== active ? 'opacity-40' : ''
              }`}
              style={{ height: d.volume > 0 ? `${Math.max(4, (d.volume / max) * 100)}%` : '2px' }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-2xs text-faint num" aria-live="polite">
        {sel ? (
          <span className="text-ink">
            Week of {formatDate(sel.week)} — <span className="font-semibold">{sel.volume.toLocaleString()} kg</span>
          </span>
        ) : (
          <>
            <span>{formatDate(data[0].week)}</span>
            <span>This week</span>
          </>
        )}
      </div>
    </div>
  )
}
