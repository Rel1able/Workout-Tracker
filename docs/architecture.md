# Architecture

React 18 + TypeScript + Vite SPA. Supabase is the entire backend: auth, Postgres, and RLS. There is no server code — every query runs from the browser with the anon key, and **RLS policies in `001_initial.sql` are the only authorization layer**.

## Layers (strictly one-directional)

`pages/*` → `contexts/*` + `services/*` → `lib/supabase.ts` → Supabase

- **`services/*.ts`** — the only place `supabase` is imported besides the contexts. Each function takes `userId` explicitly and throws `new Error(error.message)` on failure; callers catch and surface via `useToast()`.
- **`contexts/AuthContext.tsx`** — session state; auth methods return `{ error: string | null }` rather than throwing.
- **`contexts/WorkoutContext.tsx`** — the single source of truth for the *in-progress* workout. Everything else is derived. See [workout-session.md](workout-session.md).
- **`types/database.ts`** — hand-written row types mirroring the SQL schema (not generated). Update it alongside any migration.
- **`lib/supabase.ts`** — throws at import time if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing, so the app is dead without `.env` (see `.env.example`).

## Database changes

- Schema changes go in a new file under `supabase/migrations/` and are applied by pasting into the Supabase SQL Editor. No local Supabase CLI setup.
- Any new table must enable RLS and add `auth.uid()`-scoped policies, otherwise it is world-readable.
- Update `src/types/database.ts` in the same change.

## Directory map

| Path | Contents |
|------|----------|
| `src/pages/` | Dashboard, Login, Progress, ResetPassword, Templates, WorkoutSession |
| `src/components/` | Calendar, ExerciseChart, ExercisePicker, Layout, Modal, ProtectedRoute, RestTimer, Skeleton, Spinner, TemplateSelector, Toast, WeeklyVolumeChart, WorkoutSummary |
| `src/services/` | exercise, pr, stats, template, workout |
| `src/lib/` | `supabase.ts` (client), `theme.ts` (theme hook), `dates.ts` (local-date helpers — pure, importable from any layer) |
| `supabase/migrations/` | SQL schema |

## Related

- Workout draft/finish/edit lifecycle: [workout-session.md](workout-session.md)
- PRs, stats, charts: [stats-and-prs.md](stats-and-prs.md)
- Styling: [styling.md](styling.md)
