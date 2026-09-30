import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { sfx, type SfxName } from '../audio/engine'

type Variant = 'lit' | 'aurora' | 'ghost' | 'quiet' | 'danger'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  block?: boolean
  /** Звук при нажатии; false — без звука */
  sound?: SfxName | false
}

export function Button({
  variant = 'ghost',
  size = 'md',
  icon,
  block,
  sound = 'click',
  className,
  children,
  onClick,
  type = 'button',
  ...rest
}: Props) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size !== 'md' && `btn-${size}`,
    block && 'btn-block',
    !children && icon && 'btn-icon',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type={type}
      className={cls}
      onClick={(e) => {
        if (sound) sfx(sound)
        onClick?.(e)
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
