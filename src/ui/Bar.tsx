interface Props {
  value: number
  max: number
  variant?: 'gold' | 'mint' | 'ink' | 'ember'
  label?: string
  className?: string
  height?: number
}

export function Bar({ value, max, variant = 'gold', label, className, height }: Props) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const cls = ['bar', variant !== 'gold' && `bar-${variant}`, className].filter(Boolean).join(' ')
  return (
    <div
      className={cls}
      style={height ? { height } : undefined}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-label={label}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}
