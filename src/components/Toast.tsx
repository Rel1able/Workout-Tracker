import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

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

  const typeStyles: Record<ToastType, string> = {
    success: 'bg-emerald-800 border-emerald-600 text-emerald-100',
    error: 'bg-red-900 border-red-700 text-red-100',
    info: 'bg-gray-800 border-gray-600 text-gray-100',
  }

  const typeIcons: Record<ToastType, JSX.Element> = {
    success: <CheckCircle2 size={18} />,
    error: <AlertCircle size={18} />,
    info: <Info size={18} />,
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-3 rounded-lg border shadow-xl pointer-events-auto transition-all ${typeStyles[t.type]}`}
          >
            <span className="shrink-0 mt-0.5">{typeIcons[t.type]}</span>
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-current opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X size={16} />
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
