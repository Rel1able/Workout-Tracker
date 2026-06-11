import { useState, useEffect, useRef, useCallback } from 'react'
import { Timer, X, Plus } from 'lucide-react'

const PRESETS = [60, 90, 120, 180]

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Floating rest timer. Counts down using a wall-clock deadline so it stays
 * accurate when the phone locks or the tab is backgrounded.
 */
export default function RestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const doneRef = useRef(false)

  const start = useCallback((seconds: number) => {
    doneRef.current = false
    setEndsAt(Date.now() + seconds * 1000)
    setRemaining(seconds)
    setPickerOpen(false)
  }, [])

  const stop = useCallback(() => {
    setEndsAt(null)
    setRemaining(0)
  }, [])

  useEffect(() => {
    if (endsAt === null) return
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0 && !doneRef.current) {
        doneRef.current = true
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])
        setTimeout(() => setEndsAt(null), 1500)
      }
    }
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
  }, [endsAt])

  const running = endsAt !== null

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 z-30 flex flex-col items-end gap-2">
      {pickerOpen && !running && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-2 flex gap-1.5">
          {PRESETS.map(s => (
            <button
              key={s}
              onClick={() => start(s)}
              className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
            >
              {fmt(s)}
            </button>
          ))}
        </div>
      )}

      {running ? (
        <div
          className={`flex items-center gap-2 rounded-2xl shadow-2xl px-4 py-3 border transition-colors ${
            remaining === 0
              ? 'bg-emerald-600 border-emerald-500'
              : 'bg-gray-900 border-gray-700'
          }`}
        >
          <Timer size={18} className={remaining === 0 ? 'text-white' : 'text-emerald-400'} />
          <span className="font-bold text-white tabular-nums text-lg min-w-[3.5rem] text-center">
            {remaining === 0 ? 'Go!' : fmt(remaining)}
          </span>
          {remaining > 0 && (
            <>
              <button
                onClick={() => setEndsAt(e => (e === null ? null : e + 15000))}
                className="text-gray-400 hover:text-white transition-colors flex items-center text-xs font-semibold"
                aria-label="Add 15 seconds"
              >
                <Plus size={14} />15s
              </button>
              <button
                onClick={stop}
                className="text-gray-500 hover:text-red-400 transition-colors"
                aria-label="Stop timer"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => setPickerOpen(o => !o)}
          className="flex items-center gap-2 bg-gray-900 border border-gray-700 hover:border-emerald-600 text-gray-300 hover:text-emerald-400 rounded-2xl shadow-2xl px-4 py-3 font-semibold text-sm transition-colors"
        >
          <Timer size={18} />
          Rest
        </button>
      )}
    </div>
  )
}
