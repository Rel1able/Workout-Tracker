import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Check, Dumbbell } from 'lucide-react'
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
        setSuccessMsg('Account created. Confirm your email address, then sign in.')
        setMode('login')
      }
    } else {
      const { error } = await sendPasswordReset(email)
      if (error) setError(error)
      else setSuccessMsg('If an account exists for that address, a reset link is on its way.')
    }

    setLoading(false)
  }

  const submitLabel =
    mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded bg-accent text-[var(--accent-ink)] grid place-items-center">
            <Dumbbell size={16} strokeWidth={2.5} />
          </span>
          <span className="font-bold tracking-tight">Workout Tracker</span>
        </div>
        <h1 className="mt-6 text-xl font-bold tracking-tight">
          {mode === 'forgot' ? 'Reset your password' : 'Log every set, see every gain'}
        </h1>
        <p className="mt-1.5 text-sm text-muted leading-relaxed">
          {mode === 'forgot'
            ? 'Enter your email and we will send you a link to set a new password.'
            : 'Sessions, weights, reps and personal records — kept in one place across your devices.'}
        </p>

        {mode !== 'forgot' && (
          <div className="seg mt-6 w-full" role="group" aria-label="Account">
            <button
              onClick={() => switchMode('login')}
              aria-pressed={mode === 'login'}
              className="flex-1"
            >
              Sign in
            </button>
            <button
              onClick={() => switchMode('register')}
              aria-pressed={mode === 'register'}
              className="flex-1"
            >
              Create account
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="name" className="section-label">Display name</label>
              <input
                id="name"
                type="text"
                className="field mt-1.5"
                placeholder="Your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="section-label">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="field mt-1.5"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label htmlFor="password" className="section-label">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="field mt-1.5"
                placeholder={mode === 'register' ? 'At least 6 characters' : ''}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={mode === 'register' ? 6 : undefined}
              />
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 text-sm text-danger">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </p>
          )}

          {successMsg && (
            <p className="flex items-start gap-2 text-sm text-success">
              <Check size={15} className="shrink-0 mt-0.5" />
              {successMsg}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
            {loading && <Spinner size="sm" />}
            {submitLabel}
          </button>

          {mode !== 'register' && (
            <button
              type="button"
              onClick={() => switchMode(mode === 'forgot' ? 'login' : 'forgot')}
              className="block w-full text-center text-sm text-muted hover:text-ink transition-colors"
            >
              {mode === 'forgot' ? 'Back to sign in' : 'Forgot your password?'}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
