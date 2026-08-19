import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Extra CSS classes on the inner panel */
  className?: string
}

export default function Modal({ isOpen, onClose, title, children, className = '' }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`relative bg-surface border-t sm:border border-line rounded-t-xl sm:rounded-xl
                    w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col
                    shadow-[var(--shadow-pop)] ${className}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sm:hidden flex justify-center pt-2 shrink-0">
          <div className="w-9 h-1 rounded-full bg-line-strong" />
        </div>
        {title && (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-line shrink-0">
            <h2 className="font-semibold">{title}</h2>
            <button onClick={onClose} className="icon-btn -mr-1.5" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-4 sm:px-5 py-4 overflow-y-auto pb-safe">{children}</div>
      </div>
    </div>
  )
}
