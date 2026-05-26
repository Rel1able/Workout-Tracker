import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'

type Mode = 'login' | 'register' | 'forgot'

export default function LoginPage() {
  const { signIn, signUp, sendPasswordReset } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setSuccessMsg(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error)
      else navigate('/')
    } else if (mode === 'register') {
      const { error } = await signUp(email, password, displayName)
      if (error) {
        setError(error)
      } else {
        setSuccessMsg('Account created! Check your email to confirm, then log in.')
        setMode('login')
      }
    } else {
      const { error } = await sendPasswordReset(email)
      if (error) setError(error)
      else setSuccessMsg('If an account exists, a reset link has been sent. Check your inbox.')
    }

    setLoading(false)
  }

  const title =
    mode === 'login' ? 'Sign In'
    : mode === 'register' ? 'Create Account'
    : 'Reset Password'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600/20 mb-3">
            <Dumbbell size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">WorkoutTracker</h1>
          <p className="text-gray-400 text-sm mt-1">Track your gains, crush your PRs</p>
        </div>

        <div className="card">
          {mode !== 'forgot' ? (
            <div className="flex bg-gray-800 rounded-lg p-1 mb-6">
              {(['login', 'register'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-colors capitalize ${
                    mode === m ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>
          ) : (
            <h2 className="text-lg font-bold text-white mb-4">Reset Password</h2>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Display Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Your name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder={mode === 'register' ? 'Min 6 characters' : '••••••••'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={mode === 'register' ? 6 : undefined}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-900/40 border border-red-800 text-red-300 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-900/40 border border-emerald-800 text-emerald-300 text-sm rounded-lg px-3 py-2">
                {successMsg}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <Spinner size="sm" />}
              {title}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="block w-full text-center text-sm text-gray-400 hover:text-emerald-400 transition-colors"
              >
                Forgot your password?
              </button>
            )}

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="block w-full text-center text-sm text-gray-400 hover:text-emerald-400 transition-colors"
              >
                Back to sign in
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
