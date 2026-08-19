import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AlertCircle, Check, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  const iconColor: Record<ToastType, string> = {
    success: 'text-success',
    error: 'text-danger',
    info: 'text-muted',
  }

  const icons: Record<ToastType, JSX.Element> = {
    success: <Check size={16} strokeWidth={2.5} />,
    error: <AlertCircle size={16} />,
    info: <Info size={16} />,
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed z-50 flex flex-col gap-2 pointer-events-none
                   bottom-[4.75rem] inset-x-3 mb-safe
                   lg:bottom-5 lg:right-5 lg:left-auto lg:inset-x-auto lg:w-80"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-surface border border-line-strong
                       shadow-[var(--shadow-pop)] pointer-events-auto"
          >
            <span className={`shrink-0 mt-0.5 ${iconColor[t.type]}`}>{icons[t.type]}</span>
            <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 -mr-1 -mt-0.5 p-1 text-faint hover:text-ink transition-colors"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
