import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Dumbbell, LogOut, Home, TrendingUp, ClipboardList } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const TABS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/templates', label: 'Templates', icon: ClipboardList },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <nav className="sticky top-0 z-30 bg-gray-950/90 backdrop-blur border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-emerald-400 text-lg tracking-tight flex items-center gap-1.5">
            <Dumbbell size={20} />
            WorkoutTracker
          </Link>
          <div className="flex items-center gap-1">
            {user && (
              <>
                {/* Desktop nav links */}
                <div className="hidden sm:flex items-center gap-1 mr-2">
                  {TABS.map(({ to, label }) => {
                    const active = location.pathname === to
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? 'bg-emerald-600 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                      >
                        {label}
                      </Link>
                    )
                  })}
                </div>
                <button
                  onClick={signOut}
                  className="text-gray-500 hover:text-red-400 transition-colors text-sm px-2 py-2 rounded-lg flex items-center gap-1"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main content — bottom padding clears the mobile tab bar */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24 sm:pb-6">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      {user && (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-gray-950/95 backdrop-blur border-t border-gray-800 pb-safe">
          <div className="grid grid-cols-3 max-w-2xl mx-auto">
            {TABS.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                    active ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
