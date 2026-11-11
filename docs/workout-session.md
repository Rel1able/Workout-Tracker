# Workout session lifecycle

The core of the app. A workout lives in three states, all driven by `WorkoutContext` ([src/contexts/WorkoutContext.tsx](../src/contexts/WorkoutContext.tsx)):

1. **Draft** (`isDraft: true`) — created by `initSession(date)`. Held in React state, mirrored to `localStorage` under `wt:active-session:v1`, and auto-saved to Supabase on an 800ms debounce via `upsertWorkoutDraft`. A draft row is a `workouts` row with `finished_at IS NULL`.
2. **Finished** — `finishWorkout()` sets `finished_at` and computes PRs; `markFinished()` flips `isDraft` off.
3. **Editing a finished workout** (`isEditing: true`, `isDraft: false`) — `initEditSession(workout)`. No auto-save; the user saves explicitly through `saveWorkout()`.

On mount, `DashboardPage` calls `fetchDraftWorkout` and hands any result to `resumeDraftSession`, so a draft survives across devices; `localStorage` covers the same session offline. `discardSession()` awaits the in-flight autosave before deleting, so a debounce cannot resurrect a discarded draft.

## Invariants to preserve

- `workouts` has `UNIQUE (user_id, workout_date)` — one workout per day per user. `upsertWorkoutDraft` refuses to reuse a row whose `finished_at` is set.
- Session items carry a client-side `localId` (`SessionExercise` / `SessionSet` in `types/database.ts`); DB ids only exist after a save. **Never key off `id` inside a session.**
- Persisting exercises/sets is **delete-then-reinsert** of all `workout_exercises` + `workout_sets` for that workout, not a diff. Row ids are therefore not stable across saves.
- Sets with neither reps nor weight > 0 are filtered out before insert.
- Personal records are computed only on finish/save, never on draft autosave (see [stats-and-prs.md](stats-and-prs.md)).
