import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { sfx } from '../audio/engine'
import { useInstant } from './useInstant'
import './modal.css'

interface ModalProps {
  open: boolean
  onClose?: () => void
  title?: ReactNode
  children: ReactNode
  width?: number
  /** sheet — выезжает справа (на телефоне снизу), dialog — по центру */
  kind?: 'dialog' | 'sheet'
  className?: string
  /** Нельзя закрыть кликом по фону */
  locked?: boolean
}

export function Modal({ open, onClose, title, children, width = 560, kind = 'dialog', className, locked }: ModalProps) {
  useEffect(() => {
    if (!open || !onClose || locked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, locked])

  const close = () => {
    if (locked || !onClose) return
    sfx('close')
    onClose()
  }

  const isSheet = kind === 'sheet'
  const instant = useInstant()

  if (instant) {
    if (!open) return null
    return createPortal(
      <div className={`modal-root modal-${kind}`}>
        <div className="modal-backdrop" onClick={close} />
        <div
          role="dialog"
          aria-modal="true"
          className={['modal-box panel', className].filter(Boolean).join(' ')}
          style={{ '--modal-w': `${width}px` } as CSSProperties}
        >
          {title || (onClose && !locked) ? (
            <div className="modal-head">
              {title ? <h2 className="display t-25 modal-title">{title}</h2> : <span />}
              {onClose && !locked ? (
                <button className="btn btn-quiet btn-icon modal-x" onClick={close} aria-label="Закрыть">
                  <X size={20} />
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="modal-body scroll">{children}</div>
        </div>
      </div>,
      document.body,
    )
  }

  // Портал в body: предок с backdrop-filter или transform иначе ломает position: fixed
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`modal-root modal-${kind}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="modal-backdrop" onClick={close} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={['modal-box panel', className].filter(Boolean).join(' ')}
            style={{ '--modal-w': `${width}px` } as CSSProperties}
            initial={isSheet ? { x: 40, opacity: 0 } : { y: 18, scale: 0.97, opacity: 0 }}
            animate={isSheet ? { x: 0, opacity: 1 } : { y: 0, scale: 1, opacity: 1 }}
            exit={isSheet ? { x: 40, opacity: 0 } : { y: 12, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          >
            {title || (onClose && !locked) ? (
              <div className="modal-head">
                {title ? <h2 className="display t-25 modal-title">{title}</h2> : <span />}
                {onClose && !locked ? (
                  <button className="btn btn-quiet btn-icon modal-x" onClick={close} aria-label="Закрыть">
                    <X size={20} />
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="modal-body scroll">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
