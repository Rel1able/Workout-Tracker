import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
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
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600/20 mb-3">
            <KeyRound size={28} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Set New Password</h1>
        </div>

        <div className="card">
          {!ready ? (
            <div className="text-center py-6 space-y-3">
              <Spinner size="lg" />
              <p className="text-gray-400 text-sm">
                Verifying reset link… If nothing happens, your link may be expired.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="btn-secondary w-full"
              >
                Back to sign in
              </button>
            </div>
          ) : done ? (
            <div className="bg-emerald-900/40 border border-emerald-800 text-emerald-300 text-sm rounded-lg px-3 py-3 text-center">
              Password updated! Redirecting…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">New Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="bg-red-900/40 border border-red-800 text-red-300 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading && <Spinner size="sm" />}
                Update Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
