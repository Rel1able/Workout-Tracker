# 💪 Workout Tracker

A full-stack workout tracking app built with **React + TypeScript**, **Vite**, **Tailwind CSS**, and **Supabase**.

## Features

- 📅 **Monthly calendar** – days with logged workouts are highlighted
- 🏋️ **Workout sessions** – add exercises, log sets (reps + weight), finish & save
- 📋 **Templates** – create reusable workout templates with custom exercise lists
- 🏆 **Personal records** – auto-detected and displayed on the dashboard
- 🔒 **Auth** – email/password login via Supabase Auth
- 📱 **Mobile-friendly** – responsive Tailwind layout

---

## Quick Start

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project. Note your:

- **Project URL** (e.g. `https://xxxx.supabase.co`)
- **Anon public key** (found in Project Settings → API)

### 2. Run the database migration

In the Supabase dashboard, open the **SQL Editor** and paste the contents of:

```
supabase/migrations/001_initial.sql
```

Run it. This creates all tables, RLS policies, and seeds default exercises.

> ⚠️ If your Supabase project has email confirmation enabled (default), users need to confirm their email before logging in. You can disable this in **Authentication → Providers → Email → Confirm email**.

### 3. Clone and install

```bash
# Unzip the project, then:
cd workout-tracker
npm install
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Project Structure

```
src/
├── contexts/
│   ├── AuthContext.tsx       # Supabase auth state & helpers
│   └── WorkoutContext.tsx    # In-memory workout session state
├── components/
│   ├── Calendar.tsx          # Monthly calendar grid
│   ├── ExercisePicker.tsx    # Searchable exercise modal
│   ├── Layout.tsx            # App shell / navbar
│   ├── Modal.tsx             # Reusable modal wrapper
│   ├── ProtectedRoute.tsx    # Auth guard
│   ├── Spinner.tsx           # Loading spinner
│   ├── TemplateSelector.tsx  # Template selection modal
│   ├── Toast.tsx             # Toast notification system
│   └── WorkoutSummary.tsx    # Read-only workout day summary
├── pages/
│   ├── LoginPage.tsx         # Sign in / create account
│   ├── DashboardPage.tsx     # Calendar + PRs + start workout
│   ├── WorkoutSessionPage.tsx # Active workout editor
│   └── TemplatesPage.tsx     # Template CRUD
├── services/
│   ├── exerciseService.ts    # Fetch / add exercises
│   ├── prService.ts          # Fetch personal records
│   ├── templateService.ts    # Template CRUD
│   └── workoutService.ts     # Save workouts + PR calculation
├── types/
│   └── database.ts           # TypeScript types for all DB rows
└── lib/
    └── supabase.ts           # Supabase client singleton
```

---

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Deploy to Vercel, Netlify, or any static host.

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public API key |

---

## Database Schema

| Table | Description |
|---|---|
| `profiles` | User display names (auto-created on signup) |
| `exercises` | Default + custom exercises |
| `workout_templates` | User-created templates |
| `template_exercises` | Exercises within a template |
| `workouts` | Completed workout sessions |
| `workout_exercises` | Exercises within a workout |
| `workout_sets` | Individual sets (reps + weight) |
| `personal_records` | Best max_weight and max_reps per exercise |

All tables have **Row Level Security (RLS)** enabled — users can only access their own data.
