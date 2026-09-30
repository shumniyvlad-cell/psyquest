import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { EngineState, ReelEngine } from './engine'

const IDLE: EngineState = { playing: false }
const noopSubscribe = () => () => {}
const idleSnapshot = () => IDLE

export function useEngineState(engine: ReelEngine | null): EngineState {
  return useSyncExternalStore(engine ? engine.subscribe : noopSubscribe, engine ? engine.getState : idleSnapshot)
}

/** Время воспроизведения без ре-рендеров: колбэк сам обновляет DOM через ref. */
export function useEngineTick(engine: ReelEngine | null, fn: (t: number, dur: number) => void) {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  useEffect(() => {
    if (!engine) return
    return engine.onTick((t, d) => ref.current(t, d))
  }, [engine])
}

/** Учитывает и системную настройку, и игровую (html[data-reduced-motion]). */
export function prefersReducedMotion(): boolean {
  if (typeof document === 'undefined') return false
  const flag = document.documentElement.dataset.reducedMotion
  if (flag === 'true') return true
  if (flag === 'false') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
