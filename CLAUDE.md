# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server, http://localhost:5173
npm run build     # tsc (typecheck, noEmit) && vite build -> dist/
npm run preview   # serve the built dist/
```

No test runner, no linter, and no CI are configured. `npm run build` is the only automated check — it fails on any TypeScript error (`strict: true`), so run it after non-trivial changes.

Requires `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`); [src/lib/supabase.ts](src/lib/supabase.ts) throws at import time if either is missing, so the app is fully dead without them.

Schema changes go in a new file under [supabase/migrations/](supabase/migrations/) and are applied by pasting into the Supabase SQL Editor — there is no local Supabase CLI setup in the repo.

## Architecture

React 18 + TypeScript + Vite SPA. Supabase is the entire backend: auth, Postgres, and RLS. There is no server code — every query runs from the browser with the anon key, and **RLS policies in `001_initial.sql` are the only authorization layer**. Any new table must enable RLS and add `auth.uid()`-scoped policies, otherwise it is world-readable.

Layers, strictly one-directional:

`pages/*` → `contexts/*` + `services/*` → `lib/supabase.ts` → Supabase

- **`services/*.ts`** — the only place `supabase` is imported besides the contexts. Each function takes `userId` explicitly and throws `new Error(error.message)` on failure; callers catch and surface via `useToast()`.
- **`contexts/AuthContext.tsx`** — session state; auth methods return `{ error: string | null }` rather than throwing.
- **`contexts/WorkoutContext.tsx`** — the single source of truth for the *in-progress* workout. Everything else is derived.
- **`types/database.ts`** — hand-written row types mirroring the SQL schema (not generated). Update it alongside any migration.

### Workout session lifecycle (the core of the app)

A workout lives in three states, all driven by `WorkoutContext`:

1. **Draft** (`isDraft: true`) — created by `initSession(date)`. Held in React state, mirrored to `localStorage` under `wt:active-session:v1`, and auto-saved to Supabase on an 800ms debounce via `upsertWorkoutDraft`. A draft row is a `workouts` row with `finished_at IS NULL`.
2. **Finished** — `finishWorkout()` sets `finished_at` and computes PRs; `markFinished()` flips `isDraft` off.
3. **Editing a finished workout** (`isEditing: true`, `isDraft: false`) — `initEditSession(workout)`. No auto-save; the user saves explicitly through `saveWorkout()`.

On mount, `DashboardPage` calls `fetchDraftWorkout` and hands any result to `resumeDraftSession`, so a draft survives across devices; `localStorage` covers the same session offline. `discardSession()` awaits the in-flight autosave before deleting, so a debounce cannot resurrect a discarded draft.

Key invariants to preserve when touching this area:
- `workouts` has `UNIQUE (user_id, workout_date)` — one workout per day per user. `upsertWorkoutDraft` refuses to reuse a row whose `finished_at` is set.
- Session items carry a client-side `localId` (`SessionExercise` / `SessionSet` in `types/database.ts`); DB ids only exist after a save. Never key off `id` inside a session.
- Persisting exercises/sets is **delete-then-reinsert** of all `workout_exercises` + `workout_sets` for that workout, not a diff. Row ids are therefore not stable across saves.
- Sets with neither reps nor weight > 0 are filtered out before insert.

### Personal records

`calculateAndSavePRs` runs only on finish/save, not on draft autosave. It compares per-exercise `max_weight` and `max_reps` against `personal_records` and upserts on `user_id,exercise_id,record_type`, returning human-readable labels the page shows as toasts.

### Stats and charts

[src/services/statsService.ts](src/services/statsService.ts) fetches finished workouts once and derives everything client-side — `computeOverviewStats` (weekly streak by Monday-start weeks), `buildExerciseSeries`, `buildLastPerformanceMap` (feeds the "last time you did this" hints in the session editor), `buildExerciseTrends` + `topMovers` (last `TREND_WINDOW_DAYS` vs the window before, powering the "What changed" list), and `best1RM` / `weightForReps` (Epley one-rep-max estimate, used by both the session editor and the `est1RM` chart metric). `buildExerciseTrends` is a single pass over the history — call it once per page and derive from the result. Trends always lead with volume, but volume is `reps × weight_kg`, so bodyweight work scores 0 and `volumeChangePct` is `null` — there is no percentage change from a zero baseline. The `startedLoading` flag marks the "was bodyweight, now loaded" case so the UI can state a direction without a percentage; anything reading `volumeChangePct` must handle the null. Charts in `ProgressPage` are hand-rolled inline SVG; there is no charting library.

## Styling

Tailwind, but **colors come from CSS custom properties**, not Tailwind's palette. [src/index.css](src/index.css) defines tokens (`--bg`, `--surface`, `--accent`, …) for dark (default) and light, and [tailwind.config.js](tailwind.config.js) maps them to semantic utility names: `bg-bg`, `text-ink`, `text-muted`, `border-line`, `bg-accent`. Do not introduce raw Tailwind colors (`bg-gray-800`, `text-blue-500`) — they break theming.

Reusable component classes are declared in `@layer components` in `index.css`: `.btn-primary` / `.btn-secondary` / `.btn-quiet` / `.btn-danger` (+ `.btn-sm` / `.btn-lg`), `.field`, `.num-input`, `.panel`, `.seg`, `.icon-btn`, `.section-label`. Prefer these over re-deriving the same utility strings.

Theme: `useTheme()` in [src/lib/theme.ts](src/lib/theme.ts) persists to `localStorage` key `wt:theme` and sets `document.documentElement.dataset.theme`; an inline script in [index.html](index.html) applies it before first paint to avoid a flash. `system` means "no `data-theme` attribute" and falls through to `prefers-color-scheme`.

Mobile-first: `Layout` renders a sidebar at `lg:` and a fixed bottom nav below it. Inputs are forced to 16px to stop iOS zoom-on-focus, and `.pb-safe` / `.mb-safe` handle the notch inset.

Icons come from `lucide-react`.
