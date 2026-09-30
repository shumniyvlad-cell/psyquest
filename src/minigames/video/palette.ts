// Цвета для canvas берём из токенов global.css (с запасными значениями на случай раннего вызова).

const FALLBACK = {
  night: '#0e1330',
  night2: '#151b42',
  dusk: '#1e2558',
  paper: '#f2e8d5',
  paperDim: '#c9c0d8',
  fog: '#8e8bb8',
  lantern: '#ffb547',
  lanternHi: '#ffd68a',
  lanternDeep: '#d9822b',
  aurora: '#6fe3c8',
  auroraDeep: '#2fb89a',
  ink: '#221238',
  inkHi: '#7a3bd1',
  ember: '#ff6b5a',
  rose: '#ff8fb1',
  card: '#efe4cc',
}

export type Palette = typeof FALLBACK

const VARS: Record<keyof Palette, string> = {
  night: '--night',
  night2: '--night-2',
  dusk: '--dusk',
  paper: '--paper',
  paperDim: '--paper-dim',
  fog: '--fog',
  lantern: '--lantern',
  lanternHi: '--lantern-hi',
  lanternDeep: '--lantern-deep',
  aurora: '--aurora',
  auroraDeep: '--aurora-deep',
  ink: '--ink',
  inkHi: '--ink-hi',
  ember: '--ember',
  rose: '--rose',
  card: '--card',
}

let cached: Palette | null = null

export function palette(): Palette {
  if (cached) return cached
  const out: Palette = { ...FALLBACK }
  try {
    const cs = getComputedStyle(document.documentElement)
    let found = 0
    for (const key of Object.keys(VARS) as (keyof Palette)[]) {
      const v = cs.getPropertyValue(VARS[key]).trim()
      if (/^#[0-9a-f]{6}$/i.test(v)) {
        out[key] = v
        found++
      }
    }
    // Стили ещё не подключены — не кэшируем, спросим позже
    if (!found) return out
  } catch {
    return out
  }
  cached = out
  return out
}

/** '#ffb547' + 0.4 → 'rgba(255, 181, 71, 0.4)' */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1, 7), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Смешать два hex-цвета: k=0 → a, k=1 → b */
export function mix(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1, 7), 16)
  const y = parseInt(b.slice(1, 7), 16)
  const ch = (s: number) => {
    const p = (x >> s) & 255
    const q = (y >> s) & 255
    return Math.round(p + (q - p) * k)
  }
  const v = (ch(16) << 16) | (ch(8) << 8) | ch(0)
  return `#${v.toString(16).padStart(6, '0')}`
}
