import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Check, KeyRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Supabase's recovery link puts the session in the URL hash. The auth
  // client picks it up automatically; we just wait for the PASSWORD_RECOVERY
  // event (or an existing session) before showing the form.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/'), 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded bg-accent text-[var(--accent-ink)] grid place-items-center">
            <KeyRound size={15} strokeWidth={2.5} />
          </span>
          <span className="font-bold tracking-tight">Workout Tracker</span>
        </div>
        <h1 className="mt-6 text-xl font-bold tracking-tight">Set a new password</h1>

        {!ready ? (
          <div className="mt-5 space-y-4">
            <p className="flex items-center gap-2.5 text-sm text-muted">
              <Spinner size="sm" />
              Checking your reset link…
            </p>
            <p className="text-sm text-muted leading-relaxed">
              If this does not continue in a few seconds, the link has probably expired. Request a
              new one from the sign-in page.
            </p>
            <button onClick={() => navigate('/login')} className="btn-secondary w-full">
              Back to sign in
            </button>
          </div>
        ) : done ? (
          <p className="mt-5 flex items-start gap-2 text-sm text-success">
            <Check size={15} className="shrink-0 mt-0.5" />
            Password updated. Taking you to your workouts…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="new-password" className="section-label">New password</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                className="field mt-1.5"
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="section-label">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                className="field mt-1.5"
                placeholder="Repeat it"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className="flex items-start gap-2 text-sm text-danger">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
              {loading && <Spinner size="sm" />}
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
