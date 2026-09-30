import { useReducedMotion } from 'motion/react'

/** Меньше движения: настройка игры (html[data-reduced-motion]) важнее системной. */
export function useCalm(): boolean {
  const os = useReducedMotion()
  const attr = typeof document !== 'undefined' ? document.documentElement.dataset.reducedMotion : undefined
  if (attr === 'true') return true
  if (attr === 'false') return false
  return !!os
}

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')
