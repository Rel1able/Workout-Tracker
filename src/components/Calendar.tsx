import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchWorkoutDates } from '../services/workoutService'

interface CalendarProps {
  onDayClick: (date: string) => void
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

export default function Calendar({ onDayClick }: CalendarProps) {
  const { user } = useAuth()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set())

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const loadDates = useCallback(async () => {
    if (!user) return
    const firstDay = `${viewYear}-${pad(viewMonth + 1)}-01`
    const lastDay = `${viewYear}-${pad(viewMonth + 1)}-${new Date(viewYear, viewMonth + 1, 0).getDate()}`
    try {
      const dates = await fetchWorkoutDates(user.id, firstDay, lastDay)
      setWorkoutDates(new Set(dates))
    } catch {
      // fail silently for calendar
    }
  }, [user, viewYear, viewMonth])

  useEffect(() => { loadDates() }, [loadDates])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Build grid
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete rows
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="btn-ghost px-2 py-1 text-lg">‹</button>
        <span className="font-bold text-white text-lg">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="btn-ghost px-2 py-1 text-lg">›</button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />

          const dateStr = toDateStr(viewYear, viewMonth, day)
          const isToday = dateStr === todayStr
          const hasWorkout = workoutDates.has(dateStr)
          const isFuture = dateStr > todayStr

          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(dateStr)}
              disabled={isFuture && !hasWorkout}
              className={`
                relative flex flex-col items-center justify-center h-10 rounded-lg text-sm font-medium transition-all
                ${isToday
                  ? 'bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-900/40'
                  : hasWorkout
                  ? 'bg-gray-800 text-white hover:bg-gray-700'
                  : isFuture
                  ? 'text-gray-700 cursor-default'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
              `}
            >
              {day}
              {hasWorkout && !isToday && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
