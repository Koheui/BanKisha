'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/src/lib/utils'
import { XIcon, CheckIcon, AlertCircleIcon, InfoIcon } from 'lucide-react'

interface Toast {
  id: string
  title?: string
  description?: string
  type?: 'success' | 'error' | 'info'
  duration?: number
}

interface ToasterState {
  toasts: Toast[]
}

let toastCounter = 0

export function useToast() {
  const [state, setState] = useState<ToasterState>({ toasts: [] })

  const toast = ({
    title,
    description,
    type = 'info',
    duration = 5000,
  }: Omit<Toast, 'id'>) => {
    const id = (++toastCounter).toString()
    const newToast = { id, title, description, type, duration }
    
    setState(prev => ({ toasts: [...prev.toasts, newToast] }))
    
    if (duration > 0) {
      setTimeout(() => {
        dismiss(id)
      }, duration)
    }
  }

  const dismiss = (id: string) => {
    setState(prev => ({ toasts: prev.toasts.filter(toast => toast.id !== id) }))
  }

  return {
    toast,
    dismiss,
    toasts: state.toasts,
  }
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const handleToast = (event: CustomEvent<Toast>) => {
      const toast = event.detail
      setToasts(prev => [...prev, toast])

      if (toast.duration && toast.duration > 0) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toast.id))
        }, toast.duration)
      }
    }

    window.addEventListener('toast', handleToast as EventListener)
    return () => window.removeEventListener('toast', handleToast as EventListener)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(onDismiss, 150)
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckIcon className="w-5 h-5" />
      case 'error':
        return <AlertCircleIcon className="w-5 h-5" />
      default:
        return <InfoIcon className="w-5 h-5" />
    }
  }

  const getTypeClasses = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900 dark:text-green-200'
      case 'error':
        return 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm transition-all duration-300 min-w-80 max-w-md',
        getTypeClasses(),
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      )}
    >
      <div className="mt-0.5">{getIcon()}</div>
      <div className="flex-1">
        {toast.title && (
          <div className="font-medium">{toast.title}</div>
        )}
        {toast.description && (
          <div className="text-sm opacity-90">{toast.description}</div>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="opacity-70 hover:opacity-100 transition-opacity mt-0.5"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
