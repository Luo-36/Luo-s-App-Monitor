import React from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useToastStore } from '@/store/useToastStore'
import type { ToastKind } from '@/store/useToastStore'

const iconMap: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
  info: <Info className="w-4 h-4 text-primary" />
}

const borderMap: Record<ToastKind, string> = {
  success: 'border-emerald-400/25',
  error: 'border-red-400/25',
  info: 'border-primary/25'
}

/** Global toast viewport — mounted once in App. */
export const ToastViewport: React.FC = () => {
  const { toasts, dismiss } = useToastStore()

  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex w-[320px] flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`
            pointer-events-auto flex items-start gap-2.5 px-3.5 py-3
            rounded-xl bg-slate-800/95 backdrop-blur-xl
            border ${borderMap[t.kind]} shadow-2xl shadow-black/30
            animate-slide-up
          `}
        >
          <span className="mt-0.5 shrink-0">{iconMap[t.kind]}</span>
          <p className="flex-1 text-sm text-white leading-relaxed break-words">
            {t.message}
          </p>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="关闭提示"
            className="p-1 -m-1 rounded-md text-text-secondary hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

export default ToastViewport
