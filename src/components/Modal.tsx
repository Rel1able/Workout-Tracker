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
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className={`relative bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl pb-safe ${className}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-2">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
