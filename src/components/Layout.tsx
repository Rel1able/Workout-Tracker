import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  Dumbbell,
  LineChart,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useWorkoutSession } from '../contexts/WorkoutContext'
import { useTheme } from '../lib/theme'

const NAV = [
  { to: '/', label: 'Today', icon: CalendarDays },
  { to: '/workout', label: 'Log', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: LineChart },
  { to: '/templates', label: 'Templates', icon: ClipboardList },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { hasActiveSession } = useWorkoutSession()
  const { resolved, toggle } = useTheme()
  const { pathname } = useLocation()

  const ThemeIcon = resolved === 'dark' ? Sun : Moon

  return (
    <div className="min-h-screen lg:flex">
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[15rem] lg:shrink-0 border-r border-line bg-surface">
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-line">
          <span className="w-6 h-6 rounded bg-accent text-[var(--accent-ink)] grid place-items-center">
            <Dumbbell size={14} strokeWidth={2.5} />
          </span>
          <span className="font-bold tracking-tight">Workout Tracker</span>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2.5 h-10 px-3 rounded-lg text-sm font-semibold transition-colors ${
                  active ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink hover:bg-raised'
                }`}
              >
                <Icon size={17} />
                {label}
                {to === '/workout' && hasActiveSession && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" title="Workout in progress" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-2 border-t border-line">
          <div className="px-3 pb-2 pt-1 text-2xs text-faint truncate">{user?.email}</div>
          <div className="flex gap-1">
            <button onClick={toggle} className="btn-quiet btn-sm flex-1" title="Switch theme">
              <ThemeIcon size={15} />
              {resolved === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button onClick={signOut} className="btn-quiet btn-sm" title="Sign out" aria-label="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* ── Mobile top bar ───────────────────────────────── */}
        <header className="lg:hidden sticky top-0 z-30 bg-bg border-b border-line">
          <div className="h-[3.25rem] px-4 flex items-center justify-between">
            <h1 className="font-bold tracking-tight text-[0.9375rem]">
              {NAV.find(n => n.to === pathname)?.label ?? 'Workout Tracker'}
            </h1>
            <div className="flex items-center gap-0.5">
              <button onClick={toggle} className="icon-btn" aria-label="Switch theme">
                <ThemeIcon size={17} />
              </button>
              <button onClick={signOut} className="icon-btn" aria-label="Sign out">
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-content mx-auto px-4 sm:px-6 py-5 lg:py-8 pb-28 lg:pb-8">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tabs ─────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-bg border-t border-line pb-safe">
        <div className="grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex flex-col items-center justify-center gap-1 h-14 text-2xs font-semibold ${
                  active ? 'text-accent' : 'text-faint'
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                {label}
                {to === '/workout' && hasActiveSession && !active && (
                  <span className="absolute top-2.5 right-[calc(50%-0.9rem)] w-1.5 h-1.5 rounded-full bg-accent" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
