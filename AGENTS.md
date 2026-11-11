# AGENTS.md

Workout tracker. React 18 + TypeScript (strict) + Vite SPA; Supabase is the whole backend (auth, Postgres, RLS) — no server code.

## Commands

```bash
npm run dev       # Vite dev server, http://localhost:5173
npm run typecheck # tsc only — fastest check after an edit
npm run build     # tsc (typecheck, noEmit) && vite build -> dist/
npm run preview   # serve the built dist/
```

No tests, linter, or CI. `npm run typecheck` / `npm run build` are the only checks — run it after non-trivial changes.
Needs `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`); the app throws at import without them.

## Hard rules

- **Layering is one-way:** `pages/*` → `contexts/*` + `services/*` → `lib/supabase.ts`. Import `supabase` only in services and contexts.
- **Services** take `userId` explicitly and `throw new Error(error.message)`; callers surface errors via `useToast()`.
- **RLS is the only authorization.** Any new table must enable RLS with `auth.uid()`-scoped policies.
- **Schema changes** = new file in `supabase/migrations/` (pasted into Supabase SQL Editor) + update hand-written `src/types/database.ts`.
- **Colors** come from CSS-variable tokens (`bg-bg`, `text-ink`, `border-line`, `bg-accent`). Never raw Tailwind colors (`bg-gray-800`).
- **Workout session:** never key off DB `id` inside a session — use `localId`. Saves are delete-then-reinsert.
- **Dates:** `workout_date` is a local `YYYY-MM-DD` string. Use helpers in `src/lib/dates.ts` (`toIsoDate`, `todayIso`, `weekStart`, `formatDate`) — don't re-implement them or call `new Date('YYYY-MM-DD')` (parses as UTC, shifts the day).
- **Charts** are hand-rolled SVG in `src/components/*Chart.tsx`, no chart library. Interactions must work on touch (pointer events), not only hover/`title`.

## Where things go

- Page-specific UI used once → keep it inside the page file. Reused or >~150 lines → `src/components/`.
- Pure logic shared by several files → `src/lib/`. Anything that talks to Supabase → `src/services/`.
- Keep folders flat; don't add new top-level dirs for one file.

## Topic docs — read only when the task touches the topic

| Topic | File |
|-------|------|
| Layers, services, contexts, DB/migrations, directory map | [docs/architecture.md](docs/architecture.md) |
| Draft / finish / edit lifecycle, autosave, session invariants | [docs/workout-session.md](docs/workout-session.md) |
| PRs, stats service, trends, 1RM, charts | [docs/stats-and-prs.md](docs/stats-and-prs.md) |
| Tailwind tokens, component classes, theme, mobile layout | [docs/styling.md](docs/styling.md) |
