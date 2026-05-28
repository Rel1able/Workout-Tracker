import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Play, Trophy } from 'lucide-react'
import Calendar from '../components/Calendar'
import TemplateSelector from '../components/TemplateSelector'
import WorkoutSummary from '../components/WorkoutSummary'
import { useAuth } from '../contexts/AuthContext'
import { useWorkoutSession } from '../contexts/WorkoutContext'
import { useToast } from '../components/Toast'
import { fetchWorkoutByDate, fetchDraftWorkout } from '../services/workoutService'
import { fetchPersonalRecords } from '../services/prService'
import { WorkoutTemplate, Workout, WorkoutExercise, PersonalRecord } from '../types/database'
import Spinner from '../components/Spinner'

// Live clock hook
function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { initSession, initEditSession, resumeDraftSession, hasActiveSession } = useWorkoutSession()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const now = useClock()

  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryDate, setSummaryDate] = useState<string>(todayStr())
  const [summaryWorkout, setSummaryWorkout] = useState<(Workout & { workout_exercises: WorkoutExercise[] }) | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [prs, setPrs] = useState<PersonalRecord[]>([])
  const [prsLoading, setPrsLoading] = useState(false)

  // Load PRs on mount
  useEffect(() => {
    if (!user) return
    setPrsLoading(true)
    fetchPersonalRecords(user.id)
      .then(data => setPrs(data.slice(0, 8)))
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setPrsLoading(false))
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // If no active local session, check DB for an unfinished draft for today
  useEffect(() => {
    if (!user || hasActiveSession) return
    fetchDraftWorkout(user.id, todayStr())
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
    const today = todayStr()
    if (template && template.template_exercises) {
      const exercises = template.template_exercises
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(te => ({
          exercise_id: te.exercise_id,
          exercise_name: te.exercise?.name ?? 'Unknown',
        }))
      initSession(today, exercises)
    } else {
      initSession(today)
    }
    navigate('/workout')
  }

  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return (
    <div className="space-y-6">
      {/* Date & Clock */}
      <div className="card text-center">
        <div className="text-3xl font-bold text-white tracking-tight">{formattedTime}</div>
        <div className="text-gray-400 mt-1">{formattedDate}</div>
        {hasActiveSession ? (
          <button
            onClick={() => navigate('/workout')}
            className="btn-primary mt-4 px-8 text-base inline-flex items-center gap-2"
          >
            <Play size={18} /> Continue Workout
          </button>
        ) : (
          <button
            onClick={() => setTemplateSelectorOpen(true)}
            className="btn-primary mt-4 px-8 text-base inline-flex items-center gap-2"
          >
            <Plus size={18} /> Start Workout
          </button>
        )}
      </div>

      {/* Calendar */}
      <Calendar onDayClick={handleDayClick} />

      {/* Personal Records */}
      <div className="card">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2">
          <Trophy size={20} className="text-amber-400" />
          <span>Personal Records</span>
        </h2>
        {prsLoading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : prs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {prs.map(pr => (
              <div key={pr.id} className="bg-gray-800 rounded-lg px-3 py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{pr.exercise?.name}</div>
                  <div className="text-xs text-gray-500">
                    {pr.record_type === 'max_weight' ? 'Max Weight' : 'Max Reps'}
                  </div>
                </div>
                <div className="text-emerald-400 font-bold text-lg">
                  {pr.record_type === 'max_weight' ? `${pr.value} kg` : `${pr.value} reps`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-4">
            No PRs yet — complete a workout to set some records!
          </p>
        )}
      </div>

      {/* Modals */}
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
          summaryDate === todayStr()
            ? () => setTemplateSelectorOpen(true)
            : undefined
        }
        onEditWorkout={handleEditWorkout}
      />
    </div>
  )
}
