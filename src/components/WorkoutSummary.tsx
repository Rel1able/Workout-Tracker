import { Pencil } from 'lucide-react'
import Modal from './Modal'
import Spinner from './Spinner'
import { Workout, WorkoutExercise } from '../types/database'

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
  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={formatted}>
      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="lg" /></div>
      ) : workout ? (
        <div className="space-y-4">
          {/* Workout meta */}
          <div className="flex gap-4 text-sm text-gray-400">
            {workout.started_at && (
              <span>
                Started: {new Date(workout.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {workout.finished_at && (
              <span>
                Finished: {new Date(workout.finished_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Exercises */}
          {workout.workout_exercises
            ?.sort((a, b) => a.sort_order - b.sort_order)
            .map(we => (
              <div key={we.id} className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3">{we.exercise?.name}</h3>
                {we.workout_sets && we.workout_sets.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-left">
                        <th className="pb-1 font-medium w-12">Set</th>
                        <th className="pb-1 font-medium">Reps</th>
                        <th className="pb-1 font-medium">Weight (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {we.workout_sets
                        .sort((a, b) => a.set_number - b.set_number)
                        .map(s => (
                          <tr key={s.id} className="text-gray-300">
                            <td className="py-0.5 text-gray-500">{s.set_number}</td>
                            <td className="py-0.5">{s.reps ?? '–'}</td>
                            <td className="py-0.5">{s.weight_kg != null ? `${s.weight_kg}` : '–'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-sm">No sets recorded</p>
                )}
              </div>
            ))}

          {workout.notes && (
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">Notes</p>
              <p className="text-gray-300 text-sm">{workout.notes}</p>
            </div>
          )}

          {onEditWorkout && (
            <button
              onClick={() => { onEditWorkout(workout); onClose() }}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Pencil size={16} />
              Edit Workout
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-6 space-y-4">
          <p className="text-gray-400">No workout logged for this day.</p>
          {onStartWorkout && (
            <button onClick={() => { onClose(); onStartWorkout() }} className="btn-primary">
              Start Workout
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}
