import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const navLink = (to: string, label: string) => {
    const active = location.pathname === to
    return (
      <Link
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
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-gray-950/90 backdrop-blur border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-emerald-400 text-lg tracking-tight">
            💪 WorkoutTracker
          </Link>
          <div className="flex items-center gap-2">
            {user && (
              <>
                {navLink('/', 'Dashboard')}
                {navLink('/templates', 'Templates')}
                <button
                  onClick={signOut}
                  className="text-gray-500 hover:text-red-400 transition-colors text-sm px-2 py-1 rounded-lg"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  )
}
