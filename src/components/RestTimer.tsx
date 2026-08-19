import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Timer, X } from 'lucide-react'

const PRESETS = [60, 90, 120, 180]
const DEFAULT_REST = 90

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export interface RestTimerState {
  remaining: number
  running: boolean
  done: boolean
  lastPreset: number
  start: (seconds?: number) => void
  stop: () => void
  extend: (seconds: number) => void
}

/**
 * Rest countdown driven by a wall-clock deadline, so it stays accurate when the
 * phone locks or the tab is backgrounded. State lives in the page so a set can
 * start the rest automatically when it is marked done.
 */
export function useRestTimer(): RestTimerState {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [lastPreset, setLastPreset] = useState(DEFAULT_REST)
  const doneRef = useRef(false)

  const start = useCallback((seconds: number = DEFAULT_REST) => {
    doneRef.current = false
    setLastPreset(seconds)
    setEndsAt(Date.now() + seconds * 1000)
    setRemaining(seconds)
  }, [])

  const stop = useCallback(() => {
    setEndsAt(null)
    setRemaining(0)
  }, [])

  const extend = useCallback((seconds: number) => {
    setEndsAt(e => (e === null ? null : e + seconds * 1000))
  }, [])

  useEffect(() => {
    if (endsAt === null) return
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0 && !doneRef.current) {
        doneRef.current = true
        if (navigator.vibrate) navigator.vibrate([180, 90, 180])
        setTimeout(() => setEndsAt(null), 2000)
      }
    }
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
  }, [endsAt])

  return {
    remaining,
    running: endsAt !== null,
    done: endsAt !== null && remaining === 0,
    lastPreset,
    start,
    stop,
    extend,
  }
}

/** Inline rest control — sits in the workout action bar, not floating over content. */
export function RestTimerControl({ timer }: { timer: RestTimerState }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const { running, done, remaining, start, stop, extend } = timer

  useEffect(() => {
    if (running) setPickerOpen(false)
  }, [running])

  if (running) {
    return (
      <div
        className={`flex items-center gap-1 h-11 pl-3 pr-1.5 rounded-lg border ${
          done ? 'border-success bg-success-soft' : 'border-line bg-surface'
        }`}
      >
        <Timer size={15} className={done ? 'text-success' : 'text-muted'} />
        <span
          className={`num font-bold text-[0.9375rem] min-w-[2.75rem] text-center ${
            done ? 'text-success' : ''
          }`}
        >
          {done ? 'Go' : fmt(remaining)}
        </span>
        {!done && (
          <>
            <button
              onClick={() => extend(15)}
              className="h-8 px-1.5 rounded text-xs font-bold text-muted hover:text-ink hover:bg-raised transition-colors"
            >
              +15
            </button>
            <button onClick={stop} className="icon-btn w-8 h-8" aria-label="Stop rest timer">
              <X size={15} />
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      {pickerOpen && (
        <div className="absolute bottom-full mb-2 left-0 flex gap-1 p-1 rounded-lg bg-surface border border-line shadow-[var(--shadow-pop)]">
          {PRESETS.map(s => (
            <button
              key={s}
              onClick={() => start(s)}
              className="h-9 px-2.5 rounded num text-sm font-semibold text-ink hover:bg-accent hover:text-[var(--accent-ink)] transition-colors"
            >
              {fmt(s)}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setPickerOpen(o => !o)}
        className="flex items-center gap-1.5 h-11 px-3 rounded-lg border border-line bg-surface
                   text-sm font-semibold text-muted hover:text-ink transition-colors"
      >
        <Timer size={15} />
        Rest
      </button>
    </div>
  )
}
