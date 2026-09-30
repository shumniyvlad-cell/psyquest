// Мелкие контролы «Монтажной»: поле секунд, переключатель, группа чипов, растущее поле текста.
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { sfx } from '../../audio/engine'
import { fmtSecFixed, parseSec, round1 } from './util'

interface ConfirmProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Подтверждение внутри слоя «Монтажной». Общий Modal живёт в портале под z-index 60,
 * а редактор — z-index 70, поэтому диалог рисуем здесь же.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmProps) {
  const id = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const cancelFn = useRef(onCancel)
  useEffect(() => {
    cancelFn.current = onCancel
  })
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      cancelFn.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus({ preventScroll: true })
    }
  }, [open])
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="ve-confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="ve-confirm-backdrop" onClick={onCancel} />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${id}-t`}
            aria-describedby={`${id}-d`}
            className="ve-confirm-box panel"
            initial={{ y: 14, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          >
            <h2 id={`${id}-t`} className="display t-25">
              {title}
            </h2>
            <div id={`${id}-d`} className="muted">
              {children}
            </div>
            <div className="ve-modal-actions">
              <button
                ref={cancelRef}
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  sfx('click')
                  onCancel()
                }}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  sfx('close')
                  onConfirm()
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

type AutoTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; ref?: Ref<HTMLTextAreaElement> }

/** Textarea, которая растёт под текст — длинная фраза видна целиком. */
export function AutoTextarea({ value, ref: outer, ...rest }: AutoTextareaProps) {
  const inner = useRef<HTMLTextAreaElement | null>(null)
  const fit = () => {
    const el = inner.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }
  useLayoutEffect(fit, [value])
  useEffect(() => {
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    <textarea
      {...rest}
      value={value}
      ref={(el) => {
        inner.current = el
        if (typeof outer === 'function') outer(el)
        else if (outer) outer.current = el
      }}
    />
  )
}

interface SecInputProps {
  label: string
  value: number
  onCommit: (v: number) => void
  /** Шаг стрелок ↑/↓; с Shift — ×10 */
  step?: number
  hideLabel?: boolean
  disabled?: boolean
}

/** Секунды с десятыми: печатать можно и «4,5», и «4.5», и «1:04,5». Применяется по Enter или при уходе с поля. */
export function SecInput({ label, value, onCommit, step = 0.1, hideLabel, disabled }: SecInputProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const v = parseSec(draft)
    setDraft(null)
    if (v !== null) onCommit(round1(v))
  }
  return (
    <div className="ve-num">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'field-label'}>
        {label}
      </label>
      <span className="ve-num-box">
        <input
          id={id}
          className="input num"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={draft ?? fmtSecFixed(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            else if (e.key === 'Escape') setDraft(null)
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              setDraft(null)
              const d = (e.shiftKey ? step * 10 : step) * (e.key === 'ArrowUp' ? 1 : -1)
              onCommit(round1(value + d))
            }
          }}
        />
        <span className="ve-num-unit" aria-hidden="true">
          с
        </span>
      </span>
    </div>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
  hint?: ReactNode
  disabled?: boolean
}

export function Switch({ checked, onChange, children, hint, disabled }: SwitchProps) {
  return (
    <label className={`ve-switch${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          sfx('select')
          onChange(e.target.checked)
        }}
      />
      <span className="ve-switch-ui" aria-hidden="true" />
      <span className="ve-switch-text">
        <span>{children}</span>
        {hint ? <span className="ve-switch-hint">{hint}</span> : null}
      </span>
    </label>
  )
}

interface ChipsProps<T extends string> {
  label: string
  value: T
  options: { id: T; name: string }[]
  onChange: (v: T) => void
}

export function Chips<T extends string>({ label, value, options, onChange }: ChipsProps<T>) {
  return (
    <div className="ve-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="chip"
          aria-pressed={value === o.id}
          onClick={() => {
            if (value === o.id) return
            sfx('select')
            onChange(o.id)
          }}
        >
          {o.name}
        </button>
      ))}
    </div>
  )
}
