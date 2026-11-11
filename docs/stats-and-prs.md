# Personal records, stats, and charts

## Personal records

`calculateAndSavePRs` ([src/services/prService.ts](../src/services/prService.ts)) runs only on finish/save, not on draft autosave. It compares per-exercise `max_weight` and `max_reps` against `personal_records` and upserts on `user_id,exercise_id,record_type`, returning human-readable labels the page shows as toasts.

## Stats

[src/services/statsService.ts](../src/services/statsService.ts) fetches finished workouts once and derives everything client-side:

- `computeOverviewStats` — weekly streak by Monday-start weeks.
- `buildExerciseSeries` — per-exercise time series for charts.
- `buildLastPerformanceMap` — feeds the "last time you did this" hints in the session editor.
- `buildExerciseTrends` + `topMovers` — last `TREND_WINDOW_DAYS` vs the window before; powers the "What changed" list. `buildExerciseTrends` is a single pass over the history — **call it once per page and derive from the result.**
- `best1RM` / `weightForReps` — Epley one-rep-max estimate, used by both the session editor and the `est1RM` chart metric.

### Volume and the null case

Trends always lead with volume, but volume is `reps × weight_kg`, so bodyweight work scores 0 and `volumeChangePct` is `null` — there is no percentage change from a zero baseline. The `startedLoading` flag marks the "was bodyweight, now loaded" case so the UI can state a direction without a percentage. **Anything reading `volumeChangePct` must handle the null.**

## Charts

Charts are hand-rolled inline SVG; there is no charting library.

- [src/components/ExerciseChart.tsx](../src/components/ExerciseChart.tsx) — per-exercise line chart. Also owns the `Metric` type and its labels/units. Selection uses pointer events on the `<svg>` (nearest point by x), so hover, tap and drag all work; `touch-action: pan-y` keeps vertical page scroll. Arrow keys work when focused.
- [src/components/WeeklyVolumeChart.tsx](../src/components/WeeklyVolumeChart.tsx) — weekly bars; each bar is a `<button>` so tap/keyboard select it.

Don't rely on SVG `<title>` or the HTML `title` attribute for data readouts — they never show on phones.
