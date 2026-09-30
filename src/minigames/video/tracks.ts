// Музыка из игры для роликов: офлайн-рендер Tone.js с кэшем по треку и длине.
import { renderThemeToBuffer } from '../../audio/engine'
import type { ThemeId } from '../../audio/themes'
import { MAX_TOTAL_SEC } from './types'
import { clamp } from './util'

interface Entry {
  promise: Promise<AudioBuffer>
  buffer: AudioBuffer | null
}

const cache = new Map<string, Entry>()
const LIMIT = 4

/** Рендерим с запасом, кратно 10 с: мелкая правка монтажа не заставляет рендерить заново. */
export function trackLength(duration: number): number {
  return clamp(Math.ceil(Math.max(duration, 1) / 10) * 10, 10, MAX_TOTAL_SEC)
}

const keyOf = (id: ThemeId, len: number) => `${id}:${len}`

export function cachedTrack(id: ThemeId, len: number): AudioBuffer | null {
  return cache.get(keyOf(id, len))?.buffer ?? null
}

export function getTrack(id: ThemeId, len: number): Promise<AudioBuffer> {
  const key = keyOf(id, len)
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit.promise
  }
  const entry: Entry = { promise: renderThemeToBuffer(id, len), buffer: null }
  entry.promise.then(
    (b) => {
      entry.buffer = b
    },
    () => {
      cache.delete(key)
    },
  )
  cache.set(key, entry)
  while (cache.size > LIMIT) {
    const first = cache.keys().next().value
    if (first === undefined) break
    cache.delete(first)
  }
  return entry.promise
}
