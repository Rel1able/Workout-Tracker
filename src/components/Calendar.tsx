import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { fetchWorkoutDates } from '../services/workoutService'

interface CalendarProps {
  onDayClick: (date: string) => void
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
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

  // Build grid — weeks start Monday
  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const monthCount = [...workoutDates].length

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold">{MONTHS[viewMonth]} {viewYear}</h2>
          <p className="text-xs text-muted num">
            {monthCount} workout{monthCount === 1 ? '' : 's'} this month
          </p>
        </div>
        <div className="flex">
          <button onClick={prevMonth} className="icon-btn" aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <button onClick={nextMonth} className="icon-btn" aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d, i) => (
          <div key={i} className="text-center text-2xs font-semibold text-faint py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
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
              aria-label={`${dateStr}${hasWorkout ? ' — workout logged' : ''}`}
              className={`relative h-9 rounded text-[0.8125rem] num transition-colors
                ${hasWorkout
                  ? 'bg-accent-soft text-accent font-semibold hover:bg-accent hover:text-[var(--accent-ink)]'
                  : isFuture
                  ? 'text-faint cursor-default'
                  : 'text-muted hover:bg-raised hover:text-ink'}
                ${isToday ? 'ring-1 ring-inset ring-accent' : ''}`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </section>
  )
}
