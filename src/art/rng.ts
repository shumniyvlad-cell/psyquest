// Детерминированный ГПСЧ: одинаковый сид → одинаковая картинка при каждом рендере.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rangeRand(r: () => number, a: number, b: number): number {
  return a + (b - a) * r()
}

/** Случайный элемент массива */
export function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length) % list.length]
}
