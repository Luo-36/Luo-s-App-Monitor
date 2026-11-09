import React from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'
import { useConfirmStore } from '@/store/useConfirmStore'

/** Renders the single app-wide confirm dialog driven by useConfirmStore. */
export const ConfirmDialogHost: React.FC = () => {
  const { isOpen, options, respond } = useConfirmStore()

  if (!options) return null

  const danger = options.danger ?? false

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => respond(false)}
      title={options.title}
      maxWidth="max-w-sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => respond(false)}>
            {options.cancelLabel ?? '取消'}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => respond(true)}
          >
            {options.confirmLabel ?? '确定'}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3 py-1">
        {danger && (
          <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
        )}
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
          {options.message}
        </p>
      </div>
    </Modal>
  )
}

export default ConfirmDialogHost
