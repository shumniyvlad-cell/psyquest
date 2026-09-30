// Детерминированный генератор случайных чисел для мини-игр запуска.
// Одно и то же зерно — одна и та же партия: удобно для повторов и баланс-прогонов.

export interface Rng {
  /** Число в [0, 1) */
  next(): number
  /** Целое в [min, max] включительно */
  int(min: number, max: number): number
  chance(p: number): boolean
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
  /** Текущее внутреннее состояние — из него можно продолжить ту же последовательность */
  readonly state: number
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const out = items.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const tmp = out[i]
        out[i] = out[j]
        out[j] = tmp
      }
      return out
    },
    get state() {
      return a
    },
  }
}

/** Случайное зерно для новой партии */
export const randomSeed = () => Math.floor(Math.random() * 4294967296) >>> 0

/** Стохастическое округление: 1,3 → 1 с шансом 70% и 2 с шансом 30% */
export function roundChance(value: number, rng: Rng): number {
  if (value <= 0) return 0
  const base = Math.floor(value)
  return base + (rng.next() < value - base ? 1 : 0)
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Русское склонение по числу: plural(5, ['заявка', 'заявки', 'заявок']) */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n))
  const d10 = abs % 10
  const d100 = abs % 100
  if (d10 === 1 && d100 !== 11) return forms[0]
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return forms[1]
  return forms[2]
}
