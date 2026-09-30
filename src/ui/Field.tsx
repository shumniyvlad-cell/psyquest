import type { ReactNode } from 'react'

interface Props {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  htmlFor?: string
  className?: string
}

export function Field({ label, hint, children, htmlFor, className }: Props) {
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  )
}
