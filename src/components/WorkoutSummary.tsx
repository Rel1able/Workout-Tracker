import { Pencil, Plus } from 'lucide-react'
import Modal from './Modal'
import Skeleton from './Skeleton'
import { Workout, WorkoutExercise } from '../types/database'
import { workoutVolume } from '../services/statsService'
import { formatDate } from '../lib/dates'

function formatDuration(start: string, end: string): string | null {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  if (mins <= 0) return null
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`
}

interface WorkoutSummaryProps {
  isOpen: boolean
  onClose: () => void
  workout: (Workout & { workout_exercises: WorkoutExercise[] }) | null
  loading: boolean
  date: string
  onStartWorkout?: () => void
  onEditWorkout?: (workout: Workout & { workout_exercises: WorkoutExercise[] }) => void
}

export default function WorkoutSummary({
  isOpen,
  onClose,
  workout,
  loading,
  date,
  onStartWorkout,
  onEditWorkout,
}: WorkoutSummaryProps) {
  const formatted = formatDate(date, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const volume = workout ? Math.round(workoutVolume(workout)) : 0
  const duration =
    workout?.started_at && workout?.finished_at
      ? formatDuration(workout.started_at, workout.finished_at)
      : null
  const setCount = (workout?.workout_exercises ?? []).reduce(
    (n, we) => n + (we.workout_sets ?? []).length,
    0
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={formatted}>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : workout ? (
        <div className="space-y-5">
          {/* Meta */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Meta label="Volume" value={volume > 0 ? `${volume.toLocaleString()} kg` : '—'} />
            <Meta label="Sets" value={String(setCount)} />
            <Meta label="Duration" value={duration ?? '—'} />
            {workout.started_at && (
              <Meta
                label="Started"
                value={new Date(workout.started_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
            )}
          </div>

          {/* Exercises */}
          <div>
            {workout.workout_exercises
              ?.slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(we => {
                const sets = (we.workout_sets ?? []).slice().sort((a, b) => a.set_number - b.set_number)
                const top = sets.reduce((m, s) => Math.max(m, s.weight_kg ?? 0), 0)
                return (
                  <section key={we.id} className="py-3 border-b border-line first:border-t">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-semibold text-sm truncate">{we.exercise?.name}</h3>
                      {top > 0 && (
                        <span className="num text-2xs text-faint shrink-0">top {top} kg</span>
                      )}
                    </div>
                    {sets.length > 0 ? (
                      <ol className="mt-1.5 space-y-0.5">
                        {sets.map(s => (
                          <li key={s.id} className="flex items-center gap-3 text-[0.8125rem]">
                            <span className="num w-4 text-faint">{s.set_number}</span>
                            <span className="num font-medium">
                              {s.weight_kg != null ? `${s.weight_kg} kg` : '– kg'}
                            </span>
                            <span className="text-faint">×</span>
                            <span className="num font-medium">{s.reps ?? '–'}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-1 text-[0.8125rem] text-muted">No sets recorded</p>
                    )}
                  </section>
                )
              })}
          </div>

          {workout.notes && (
            <div>
              <div className="section-label">Notes</div>
              <p className="mt-1 text-sm text-muted leading-relaxed whitespace-pre-line">
                {workout.notes}
              </p>
            </div>
          )}

          {onEditWorkout && (
            <button
              onClick={() => { onEditWorkout(workout); onClose() }}
              className="btn-secondary w-full"
            >
              <Pencil size={15} /> Edit this workout
            </button>
          )}
        </div>
      ) : (
        <div className="py-4">
          <p className="text-sm font-semibold">Rest day</p>
          <p className="mt-1 text-sm text-muted leading-relaxed">
            Nothing was logged on this date.
          </p>
          {onStartWorkout && (
            <button onClick={() => { onClose(); onStartWorkout() }} className="btn-primary mt-4">
              <Plus size={16} /> Start today's workout
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="section-label">{label}</div>
      <div className="num text-base font-bold mt-0.5">{value}</div>
    </div>
  )
}
