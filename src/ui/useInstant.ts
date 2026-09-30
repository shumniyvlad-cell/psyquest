import { useEffect, useState } from 'react'
import { useGame } from '../game/store'

const query = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null)

/** true — показывать всё сразу, без анимаций: настройка «Меньше анимации» или системная. */
export function useInstant() {
  const setting = useGame((s) => s.settings.reducedMotion)
  const [system, setSystem] = useState(() => !!query()?.matches)
  useEffect(() => {
    const q = query()
    if (!q) return
    const on = () => setSystem(q.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return setting || system
}

export const isInstantNow = () => useGame.getState().settings.reducedMotion || !!query()?.matches
