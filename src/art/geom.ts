// Геометрия процедурного арта: сглаженные контуры, сужающиеся штрихи, капли, шум.
import { useId } from 'react'
import { mulberry32 } from './rng'

/** Точка; третье число — «натяжение» касательной в этой точке (0 — острый угол). */
export type Pt = [number, number] | [number, number, number]

/** Компактная запись числа для атрибута d (1 знак после запятой). */
export function f(n: number): string {
  const v = Math.round(n * 10) / 10
  return v === 0 ? '0' : String(v)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function clamp(v: number, a = 0, b = 1): number {
  return v < a ? a : v > b ? b : v
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

const tk = (p: Pt): number => (p.length === 3 ? p[2] : 1)

/** Сглаженный контур через точки (Catmull-Rom → кубические Безье). */
export function smooth(pts: readonly Pt[], closed = true, tension = 1): string {
  const n = pts.length
  if (n < 2) return ''
  const get = (i: number): Pt => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  const segs = closed ? n : n - 1
  const t = tension / 6
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1)
    const p1 = get(i)
    const p2 = get(i + 1)
    const p3 = get(i + 2)
    const k1 = tk(p1) * t
    const k2 = tk(p2) * t
    d +=
      `C${f(p1[0] + (p2[0] - p0[0]) * k1)} ${f(p1[1] + (p2[1] - p0[1]) * k1)} ` +
      `${f(p2[0] - (p3[0] - p1[0]) * k2)} ${f(p2[1] - (p3[1] - p1[1]) * k2)} ${f(p2[0])} ${f(p2[1])}`
  }
  return closed ? d + 'Z' : d
}

/** Ломаная. */
export function poly(pts: readonly Pt[], closed = true): string {
  let d = ''
  for (let i = 0; i < pts.length; i++) d += (i ? 'L' : 'M') + f(pts[i][0]) + ' ' + f(pts[i][1])
  return closed ? d + 'Z' : d
}

export function ellipsePath(cx: number, cy: number, rx: number, ry = rx): string {
  return (
    `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0` + `a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`
  )
}

/** Много кругов одним path — экономия DOM-узлов. */
export function dotsPath(list: readonly (readonly [number, number, number])[]): string {
  let d = ''
  for (const [x, y, r] of list) d += ellipsePath(x, y, r)
  return d
}

/** Точки кубической кривой Безье. */
export function bezierPts(p0: Pt, c1: Pt, c2: Pt, p1: Pt, n: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    const a = u * u * u
    const b = 3 * u * u * t
    const c = 3 * u * t * t
    const e = t * t * t
    out.push([a * p0[0] + b * c1[0] + c * c2[0] + e * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + e * p1[1]])
  }
  return out
}

/** Точки квадратичной кривой. */
export function quadPts(p0: Pt, c: Pt, p1: Pt, n: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]])
  }
  return out
}

/**
 * Сужающийся штрих вдоль ломаной: ширина w0 в начале → w1 в конце.
 * ease > 1 — ширина держится дольше и резко сходит на нет.
 */
export function taper(pts: readonly Pt[], w0: number, w1: number, ease = 1, roundStart = true): string {
  const n = pts.length
  if (n < 2) return ''
  const L: number[] = [0]
  for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const total = L[n - 1] || 1
  const left: Pt[] = []
  const right: Pt[] = []
  let sx = 0
  let sy = 0
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    let dx = b[0] - a[0]
    let dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    if (i === 0) {
      sx = dx
      sy = dy
    }
    const w = lerp(w0, w1, Math.pow(L[i] / total, ease)) / 2
    left.push([pts[i][0] - dy * w, pts[i][1] + dx * w])
    right.push([pts[i][0] + dy * w, pts[i][1] - dx * w])
  }
  const outline: Pt[] = []
  if (roundStart && w0 > 0.5) outline.push([pts[0][0] - sx * w0 * 0.45, pts[0][1] - sy * w0 * 0.45])
  outline.push(...left.slice(0, n - 1))
  if (w1 < 0.6) {
    const tip = pts[n - 1]
    outline.push([tip[0], tip[1], 0])
  } else {
    outline.push(left[n - 1], right[n - 1])
  }
  for (let i = n - 2; i >= 0; i--) outline.push(right[i])
  return smooth(outline, true)
}

/** Точки «капли»: полярный контур с дрожанием и (опционально) острыми шипами. */
export function blobPts(
  r: () => number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n = 9,
  jitter = 0.22,
  spike = 0,
  rot = 0,
): Pt[] {
  const pts: Pt[] = []
  const step = (Math.PI * 2) / n
  for (let i = 0; i < n; i++) {
    const a = rot + i * step + (r() - 0.5) * step * 0.35
    let k = 1 + (r() - 0.5) * 2 * jitter
    let t = 1
    if (spike > 0 && i % 2 === 0) {
      k *= 1 + spike * (0.35 + r() * 0.8)
      t = 0.12 + (1 - spike) * 0.5
    } else if (spike > 0) {
      k *= 1 - spike * 0.12
    }
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k, t])
  }
  return pts
}

export function blob(
  r: () => number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n = 9,
  jitter = 0.22,
  spike = 0,
  rot = 0,
): string {
  return smooth(blobPts(r, cx, cy, rx, ry, n, jitter, spike, rot), true)
}

/** Одномерный value-noise, значения в [-1, 1]. */
export function noise1(seed: number): (x: number) => number {
  const r = mulberry32(seed)
  const v = new Float32Array(256)
  for (let i = 0; i < 256; i++) v[i] = r() * 2 - 1
  return (x: number) => {
    const i = Math.floor(x)
    const t = x - i
    const s = t * t * (3 - 2 * t)
    const a = v[i & 255]
    const b = v[(i + 1) & 255]
    return a + (b - a) * s
  }
}

/** Фрактальная сумма октав шума, нормирована в ~[-1, 1]. */
export function fbm(n: (x: number) => number, x: number, oct = 4): number {
  let sum = 0
  let amp = 1
  let norm = 0
  let fr = 1
  for (let o = 0; o < oct; o++) {
    sum += n(x * fr + o * 17.31) * amp
    norm += amp
    amp *= 0.5
    fr *= 2.03
  }
  return sum / norm
}

/** Уникальный префикс id для градиентов/фильтров конкретного экземпляра SVG. */
export function useUid(): string {
  return 'a' + useId().replace(/[^a-zA-Z0-9]/g, '')
}

/** Смешивание hex-цветов; если цвет не hex — возвращается как есть. */
export function mix(c1: string, c2: string, t: number): string {
  const a = parseHex(c1)
  const b = parseHex(c2)
  if (!a || !b) return t < 0.5 ? c1 : c2
  const m = (i: number) => Math.round(lerp(a[i], b[i], t))
  return '#' + [m(0), m(1), m(2)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

function parseHex(c: string): [number, number, number] | null {
  const s = c.trim()
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s)
  if (m3) return [parseInt(m3[1] + m3[1], 16), parseInt(m3[2] + m3[2], 16), parseInt(m3[3] + m3[3], 16)]
  const m6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(s)
  if (m6) return [parseInt(m6[1], 16), parseInt(m6[2], 16), parseInt(m6[3], 16)]
  return null
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/** Линейная интерполяция y по ломаной (точки отсортированы по x). */
export function interp(pts: readonly Pt[]): (x: number) => number {
  return (x: number) => {
    if (x <= pts[0][0]) return pts[0][1]
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const a = pts[i - 1]
        const b = pts[i]
        return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1))
      }
    }
    return pts[pts.length - 1][1]
  }
}

/** Колокол: 1 в центре, 0 на расстоянии w. */
export function bell(x: number, c: number, w: number): number {
  const t = (x - c) / w
  return Math.exp(-t * t * 2.2)
}
