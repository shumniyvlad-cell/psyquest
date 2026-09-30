// Боссы — чернильные кляксы Роршаха: симметричные, живые, со светящимися глазами.
// Правая половина генерируется по сиду, левая — её зеркало (<use>). Один фильтр «рваного края»
// (feTurbulence + feDisplacementMap) статичен; анимации — transform/opacity на HTML-обёртке.
import { useMemo, type CSSProperties, type JSX } from 'react'
import './art.css'
import { blob, clamp, cx, dotsPath, f, lerp, mix, quadPts, smooth, taper, useUid, type Pt } from './geom'
import { mulberry32, rangeRand } from './rng'

export type InkForm = 'blot' | 'mask' | 'cloud' | 'imp' | 'block' | 'brute' | 'vortex' | 'hydra' | 'ember'
export type InkState = 'idle' | 'hit' | 'attack' | 'dying' | 'dead'

export interface InkblotProps {
  seed: number
  /** основной цвет чернил */
  ink?: string
  /** отлив */
  sheen?: string
  eyes?: 0 | 1 | 2 | 3 | 4
  eyeColor?: string
  /** 0..1 — от плавных капель к колючим брызгам */
  spiky?: number
  /** для Гидры: отростки-головы по верхней дуге с подписями, мёртвые растворяются */
  heads?: { label: string; alive: boolean }[]
  /** 0..1 — меньше → бледнее/суше чернила, появляются трещины */
  hp?: number
  state?: InkState
  /** ширина, px */
  size?: number
  /** рисовать на карточке Роршаха */
  card?: boolean
  className?: string
  /** архетип силуэта (по умолчанию — свободная клякса по сиду) */
  form?: InkForm
}

const W = 400
const H = 320
const AX = 200

type EyeStyle = 'round' | 'slit' | 'angry' | 'hollow' | 'narrow' | 'tired'

interface EyeGeo {
  x: number
  y: number
  s: number
  style: EyeStyle
  /** −1 левый, 1 правый, 0 на оси */
  side: -1 | 0 | 1
  delay: number
  ghost?: boolean
}

interface HeadGeo {
  neck: string
  head: string
  eyes: [number, number][]
  drops: string
  label: { x: number; y: number; lines: string[] }
  hx: number
  hy: number
}

class Half {
  wash: string[] = []
  body: string[] = []
  core: string[] = []
  strokes: string[] = []
  drops: [number, number, number][] = []
  shine: string[] = []
  marks: string[] = []
  markFill: string[] = []
  hot: [number, number, number][] = []
  r: () => number
  constructor(r: () => number) {
    this.r = r
  }
  mass(x: number, y: number, rx: number, ry: number, o: { n?: number; jit?: number; spike?: number; rot?: number; wash?: number; core?: number } = {}) {
    const n = o.n ?? 10
    const jit = o.jit ?? 0.2
    const sp = o.spike ?? 0
    const rot = o.rot ?? 0
    const wk = o.wash ?? 1.16
    const ck = o.core ?? 0.56
    this.wash.push(blob(this.r, x, y, rx * wk, ry * wk, n, jit * 1.3, sp * 0.4, rot))
    this.body.push(blob(this.r, x, y, rx, ry, n, jit, sp, rot))
    if (ck > 0) this.core.push(blob(this.r, x, y, rx * ck, ry * ck, n, jit, 0, rot))
  }
  angular(src: Pt[], tension = 0.3) {
    // точки на оси уводим чуть за ось, чтобы половины перекрывались (иначе фильтр даёт щель)
    const pts = src.map((p): Pt => (p[0] <= AX + 0.5 ? [AX - 5, p[1]] : p))
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0])
    const sc = (k: number) => pts.map((p): Pt => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k, tension])
    this.wash.push(smooth(sc(1.08), true))
    this.body.push(smooth(sc(1), true))
    this.core.push(smooth(sc(0.62), true))
  }
  shape(pts: Pt[]) {
    this.body.push(smooth(pts, true))
  }
  stroke(pts: Pt[], w0: number, w1: number, drop = true, ease = 1.1) {
    this.strokes.push(taper(pts, w0, w1, ease))
    if (drop) {
      const a = pts[pts.length - 2]
      const b = pts[pts.length - 1]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const l = Math.hypot(dx, dy) || 1
      const k = rangeRand(this.r, 7, 16)
      this.drops.push([b[0] + (dx / l) * k, b[1] + (dy / l) * k, rangeRand(this.r, 1.6, 3.6)])
      if (this.r() < 0.5) this.drops.push([b[0] + (dx / l) * k * 2, b[1] + (dy / l) * k * 2, rangeRand(this.r, 0.9, 2)])
    }
  }
  curve(p0: Pt, c: Pt, p1: Pt, w0: number, w1: number, drop = true) {
    this.stroke(quadPts(p0, c, p1, 12), w0, w1, drop)
  }
  splat(x: number, y: number, count: number, spread: number, rMin = 1.2, rMax = 4.5) {
    for (let i = 0; i < count; i++) {
      const a = rangeRand(this.r, -Math.PI, Math.PI)
      const d = spread * Math.sqrt(this.r())
      this.drops.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, rangeRand(this.r, rMin, rMax)])
    }
  }
  gleam(x: number, y: number, rx: number, ry: number) {
    this.shine.push(blob(this.r, x, y, rx, ry, 8, 0.25))
  }
}

interface InkGeo {
  half: Half
  eyes: EyeGeo[]
  cx: number
  cy: number
  scale: number
  disp: number
  cracks: string
  fly: { x: number; y: number; r: number; dx: number; dy: number; dl: number }[]
  embers: { x: number; y: number; dl: number; sx: number }[]
  heads: HeadGeo[]
}

const FORMS: InkForm[] = ['blot', 'mask', 'cloud', 'imp', 'block', 'brute', 'vortex', 'ember']

function spikes(h: Half, x: number, y: number, n: number, len: [number, number], spread: [number, number], w: [number, number]) {
  const r = h.r
  for (let i = 0; i < n; i++) {
    const a = rangeRand(r, spread[0], spread[1])
    const L = rangeRand(r, len[0], len[1])
    const bend = rangeRand(r, -0.25, 0.25)
    const p0: Pt = [x + Math.cos(a) * 16, y + Math.sin(a) * 14]
    const c: Pt = [x + Math.cos(a + bend) * L * 0.55, y + Math.sin(a + bend) * L * 0.5]
    const p1: Pt = [x + Math.cos(a) * L, y + Math.sin(a) * L * 0.85]
    if (p1[0] < AX + 4) continue
    h.curve(p0, c, p1, rangeRand(r, w[0], w[1]), 0.2)
  }
}

function eyePair(y: number, dx: number, s: number, style: EyeStyle, delay: number): EyeGeo[] {
  return [
    { x: AX - dx, y, s, style, side: -1, delay },
    { x: AX + dx, y, s, style, side: 1, delay },
  ]
}

function layoutEyes(n: number, y: number, dx: number, s: number, style: EyeStyle, delay: number): EyeGeo[] {
  if (n <= 0) return []
  if (n === 1) return [{ x: AX, y, s: s * 1.35, style, side: 0, delay }]
  if (n === 2) return eyePair(y, dx, s, style, delay)
  if (n === 3) return [...eyePair(y + s * 0.4, dx, s, style, delay), { x: AX, y: y - s * 1.9, s: s * 0.8, style, side: 0, delay }]
  return [...eyePair(y - s * 0.3, dx * 0.8, s, style, delay), ...eyePair(y + s * 1.9, dx * 1.35, s * 0.72, style, delay + 0.3)]
}

function buildInk(seed: number, form: InkForm, spiky: number, eyeCount: number, heads: { label: string; alive: boolean }[] | undefined): InkGeo {
  const r = mulberry32(seed * 7919 + 13)
  const h = new Half(r)
  let eyes: EyeGeo[] = []
  let cxC = AX
  let cyC = 160
  let scale = 1
  let disp = 7
  const blinkDelay = -rangeRand(r, 0, 6)
  const sp = clamp(spiky)
  const embers: InkGeo['embers'] = []

  switch (form) {
    case 'mask': {
      const mask: Pt[] = [
        [200, 40],
        [222, 46],
        [252, 26, 0],
        [252, 64],
        [262, 100],
        [258, 144],
        [246, 186],
        [228, 226],
        [210, 256],
        [200, 266, 0.4],
      ]
      const full = [...mask, ...mask.slice(1, -1).reverse().map((p): Pt => [400 - p[0], p[1], p.length === 3 ? p[2] : 1])]
      h.wash.push(smooth(full.map((p): Pt => [200 + (p[0] - 200) * 1.12, 150 + (p[1] - 150) * 1.08, p.length === 3 ? p[2] : 1])))
      h.body.push(smooth(full))
      h.core.push(smooth(full.map((p): Pt => [200 + (p[0] - 200) * 0.66, 150 + (p[1] - 150) * 0.7, p.length === 3 ? p[2] : 1])))
      h.curve([252, 140], [316, 170], [334, 250], 16, 0.3)
      h.curve([236, 212], [274, 250], [290, 300], 12, 0.3)
      h.curve([250, 30], [292, 12], [322, 22], 7, 0.2)
      h.curve([260, 96], [318, 90], [346, 120], 8, 0.2)
      h.splat(300, 200, 6, 60, 1.2, 3.4)
      h.gleam(226, 80, 14, 6)
      h.gleam(232, 176, 8, 16)
      // «улыбка» маски и слёзы-трещины — цветом карточки
      h.marks.push('M200 222Q214 226 228 212')
      h.marks.push('M226 150Q230 170 226 190')
      eyes = layoutEyes(eyeCount, 124, 27, 13, 'hollow', blinkDelay)
      cyC = 150
      disp = 6
      break
    }
    case 'cloud': {
      for (let i = 0; i < 12; i++) {
        const x = AX + Math.pow(r(), 0.8) * 165
        const y = 160 + rangeRand(r, -52, 52) * (1 - (x - AX) / 260)
        const rr = rangeRand(r, 24, 48) * (1 - (x - AX) / 420)
        h.mass(x, y, rr * 1.15, rr, { n: 11, jit: 0.12, wash: 1.4, core: 0 })
      }
      h.splat(330, 150, 10, 70, 1, 3.4)
      eyes = [
        ...layoutEyes(Math.min(eyeCount, 4), 136, 38, 9, 'round', blinkDelay),
        { x: AX - 118, y: 150, s: 5, style: 'round', side: -1, delay: -1.3, ghost: true },
        { x: AX + 118, y: 150, s: 5, style: 'round', side: 1, delay: -2.1, ghost: true },
        { x: AX - 72, y: 106, s: 4.2, style: 'round', side: -1, delay: -3.4, ghost: true },
        { x: AX + 72, y: 106, s: 4.2, style: 'round', side: 1, delay: -0.6, ghost: true },
        { x: AX - 64, y: 204, s: 4.6, style: 'round', side: -1, delay: -4.4, ghost: true },
        { x: AX + 64, y: 204, s: 4.6, style: 'round', side: 1, delay: -2.8, ghost: true },
      ]
      disp = 13
      break
    }
    case 'imp': {
      scale = 0.74
      h.mass(200, 200, 44, 50, { spike: 0.25 + sp * 0.2, n: 12 })
      h.mass(200, 134, 34, 30, { n: 10 })
      h.stroke(quadPts([226, 128], [270, 96], [318, 84], 12), 20, 0.2)
      h.stroke(quadPts([214, 108], [224, 86], [236, 64], 8), 11, 0.2)
      h.curve([236, 188], [268, 214], [292, 236], 14, 4, false)
      h.curve([290, 234], [300, 244], [306, 256], 5, 0.2)
      h.curve([288, 238], [304, 238], [316, 242], 5, 0.2)
      h.curve([220, 238], [232, 262], [238, 290], 14, 3)
      spikes(h, 206, 176, Math.round(6 + sp * 8), [90, 150], [-1.2, 1.4], [4, 9])
      h.splat(290, 170, 10, 70)
      h.marks.push('M200 150L208 157L216 150L224 156L230 148')
      h.gleam(226, 206, 10, 20)
      eyes = layoutEyes(eyeCount, 128, 15, 8.5, 'angry', blinkDelay)
      cyC = 170
      break
    }
    case 'block': {
      h.angular([
        [200, 100],
        [268, 104],
        [298, 132],
        [292, 212],
        [262, 250],
        [200, 256],
      ])
      h.angular([
        [200, 50],
        [232, 54],
        [240, 96],
        [200, 104],
      ])
      h.angular([
        [292, 114],
        [330, 126],
        [348, 206],
        [338, 264],
        [304, 268],
        [296, 212],
      ])
      h.angular([
        [214, 248],
        [254, 248],
        [262, 298],
        [216, 300],
      ])
      h.stroke(quadPts([238, 256], [240, 272], [240, 296], 6), 7, 1.5)
      h.stroke(quadPts([322, 266], [324, 282], [322, 300], 6), 6, 1.2)
      h.splat(330, 290, 5, 30, 1.4, 3.2)
      h.gleam(254, 150, 16, 24)
      h.gleam(318, 180, 7, 22)
      // зашитый рот
      h.marks.push('M200 90H222')
      h.markFill.push('M205 84h2.4v12H205ZM213 84h2.4v12H213Z')
      eyes = layoutEyes(eyeCount, 72, 14, 9, 'narrow', blinkDelay)
      cyC = 170
      disp = 4
      break
    }
    case 'brute': {
      h.mass(200, 176, 118, 60, { spike: 0.2 + sp * 0.2, n: 14 })
      h.mass(200, 146, 40, 36, { n: 10 })
      for (let i = 0; i < 4; i++) {
        const x = 222 + i * 22
        const y = 128 + i * 6
        h.stroke(quadPts([x, y + 6], [x + 6 + i * 4, y - 24], [x + 12 + i * 8, y - 44 - rangeRand(r, 0, 18)], 8), 18, 0.2)
      }
      h.mass(320, 232, 30, 26, { spike: 0.3, n: 10 })
      h.curve([290, 184], [312, 200], [318, 224], 34, 26, false)
      h.curve([214, 222], [228, 256], [232, 290], 20, 6)
      spikes(h, 230, 200, Math.round(5 + sp * 7), [110, 170], [-0.2, 1.3], [5, 10])
      h.splat(330, 270, 12, 60)
      h.markFill.push('M186 168L190 150L194 168Z')
      h.markFill.push('M206 168L210 150L214 168Z')
      h.gleam(270, 170, 22, 10)
      eyes = layoutEyes(eyeCount, 136, 17, 9.5, 'angry', blinkDelay)
      cyC = 176
      break
    }
    case 'vortex': {
      h.mass(200, 160, 34, 38, { n: 12, jit: 0.12, core: 0.7 })
      // два встречных вихря-завитка (зеркально) + малые завихрения и «ветер»
      const curl = (cxv: number, cyv: number, R0: number, R1: number, th0: number, turns: number, w: number) => {
        const pts: Pt[] = []
        for (let i = 0; i <= 22; i++) {
          const t = i / 22
          const R = R0 + (R1 - R0) * Math.pow(t, 0.8)
          const th = th0 + t * turns * Math.PI * 2
          pts.push([cxv + Math.cos(th) * R, cyv + Math.sin(th) * R * 0.88])
        }
        h.stroke(pts, w, 1, false, 0.75)
      }
      curl(286, 148, 64, 9, Math.PI * 0.98, 1.15, 30)
      curl(262, 238, 40, 6, Math.PI * 1.05, 1.1, 18)
      curl(262, 70, 30, 5, Math.PI * 0.9, 1.05, 14)
      h.curve([214, 132], [238, 96], [240, 76], 16, 6, false)
      h.curve([216, 196], [236, 222], [236, 238], 16, 6, false)
      for (let i = 0; i < 6; i++) {
        const y = rangeRand(r, 60, 270)
        const x0 = rangeRand(r, 330, 350)
        h.curve([x0, y], [x0 + 18, y - 8], [x0 + rangeRand(r, 30, 44), y - rangeRand(r, 10, 22)], rangeRand(r, 3, 6), 0.2)
      }
      h.splat(330, 160, 12, 70, 1, 3.4)
      h.marks.push('M292 118L284 132L296 136L286 152')
      eyes = layoutEyes(Math.max(1, eyeCount), 160, 20, 13, 'slit', blinkDelay)
      disp = 8
      break
    }
    case 'hydra': {
      h.mass(200, 228, 150, 52, { n: 14, spike: sp * 0.2 })
      h.mass(312, 240, 42, 34, { n: 10 })
      h.curve([250, 262], [262, 282], [258, 304], 16, 2)
      h.curve([320, 262], [338, 280], [350, 300], 12, 1.5)
      h.splat(340, 210, 8, 50)
      h.gleam(260, 222, 30, 8)
      eyes = layoutEyes(eyeCount, 224, 30, 9, 'angry', blinkDelay)
      cyC = 226
      break
    }
    case 'ember': {
      h.mass(200, 214, 80, 62, { n: 12, spike: sp * 0.15 })
      h.mass(200, 150, 34, 30, { n: 10 })
      // языки пламени: S-образные, сужаются к острию
      const tongue = (x0: number, y0: number, hgt: number, lean: number, w: number) => {
        const pts: Pt[] = []
        for (let i = 0; i <= 14; i++) {
          const t = i / 14
          pts.push([x0 + lean * t + Math.sin(t * Math.PI * 1.6) * 9 * (1 - t * 0.4), y0 - hgt * t])
        }
        h.stroke(pts, w, 0.2, false, 0.7)
        h.hot.push([x0 + lean + 6, y0 - hgt - rangeRand(r, 6, 14), rangeRand(r, 1.4, 2.6)])
      }
      tongue(208, 128, 92, 16, 20)
      tongue(236, 156, 96, 30, 22)
      tongue(262, 184, 88, 44, 20)
      tongue(276, 222, 70, 50, 16)
      tongue(222, 140, 50, 30, 10)
      tongue(252, 176, 56, 46, 10)
      h.curve([232, 268], [240, 290], [236, 310], 12, 2)
      h.splat(310, 250, 8, 50)
      for (let i = 0; i < 10; i++) h.hot.push([rangeRand(r, 206, 330), rangeRand(r, 60, 250), rangeRand(r, 1, 2.4)])
      h.gleam(240, 226, 14, 24)
      for (let i = 0; i < 7; i++) embers.push({ x: rangeRand(r, 150, 250), y: rangeRand(r, 60, 150), dl: -rangeRand(r, 0, 3.6), sx: rangeRand(r, -30, 30) })
      eyes = layoutEyes(eyeCount, 146, 15, 8.5, 'tired', blinkDelay)
      cyC = 190
      break
    }
    default: {
      const ry = rangeRand(r, 58, 76)
      const cy = rangeRand(r, 140, 168)
      h.mass(200, cy, rangeRand(r, 44, 58), ry, { n: 12, spike: sp * 0.3 })
      const k = 4 + Math.floor(r() * 3)
      for (let i = 0; i < k; i++) {
        const x = 200 + rangeRand(r, 30, 140)
        const y = rangeRand(r, 70, 250)
        const rx = rangeRand(r, 20, 46) * (1 - (x - 200) / 320)
        h.mass(x, y, rx, rx * rangeRand(r, 0.7, 1.2), { n: 10, spike: sp * 0.5, rot: r() * 3 })
        h.curve([200 + (x - 200) * 0.25, cy + (y - cy) * 0.2], [200 + (x - 200) * 0.6, (cy + y) / 2 + rangeRand(r, -20, 20)], [x, y], rx * 0.8, rx * 0.5, false)
      }
      h.curve([214, cy - ry * 0.7], [244, cy - ry - 30], [276, cy - ry - 36], 16, 0.4)
      spikes(h, 206, cy, Math.round(sp * 9), [120, 180], [-1.4, 1.4], [3, 8])
      h.splat(300, cy, 14, 100)
      h.gleam(226, cy - 10, 12, 24)
      eyes = layoutEyes(eyeCount, cy - ry * 0.3, 24, 10, 'round', blinkDelay)
      cyC = cy
    }
  }
  if (form !== 'block' && form !== 'cloud') {
    // немного случайных брызг для любой формы
    h.splat(cxC + 150 * scale, cyC, Math.round(4 + sp * 8), 60, 0.8, 2.6)
  }

  // трещины (правая половина): ломаные от ядра наружу
  let cracks = ''
  const cr = mulberry32(seed + 404)
  for (let i = 0; i < 5; i++) {
    let x = AX + rangeRand(cr, 6, 40)
    let y = cyC + rangeRand(cr, -40, 40)
    let a = rangeRand(cr, -1.2, 1.2)
    cracks += `M${f(x)} ${f(y)}`
    for (let s = 0; s < 5; s++) {
      a += rangeRand(cr, -0.6, 0.6)
      x += Math.cos(a) * rangeRand(cr, 8, 18)
      y += Math.sin(a) * rangeRand(cr, 8, 18)
      cracks += `L${f(x)} ${f(y)}`
      if (cr() < 0.3) cracks += `M${f(x)} ${f(y)}l${f(rangeRand(cr, -10, 10))} ${f(rangeRand(cr, 6, 12))}M${f(x)} ${f(y)}`
    }
  }

  // брызги для «растворения»
  const fr = mulberry32(seed + 808)
  const fly = Array.from({ length: 28 }, () => {
    const a = rangeRand(fr, -Math.PI, Math.PI)
    const d0 = rangeRand(fr, 0, 70)
    const x = AX + Math.cos(a) * d0 * 1.3
    const y = cyC + Math.sin(a) * d0
    const d1 = rangeRand(fr, 60, 170)
    return { x, y, r: rangeRand(fr, 2, 7), dx: Math.cos(a) * d1, dy: Math.sin(a) * d1 * 0.8 + rangeRand(fr, 0, 30), dl: rangeRand(fr, 0, 0.25) }
  })

  // головы (Гидра): по верхней дуге, пары симметричны
  const headGeo: HeadGeo[] = []
  const list = heads ?? (form === 'hydra' ? Array.from({ length: 5 }, () => ({ label: '', alive: true })) : [])
  const n = list.length
  if (n > 0) {
    const hr = mulberry32(seed + 1201)
    const pair = Array.from({ length: Math.ceil(n / 2) }, () => ({ len: rangeRand(hr, 0.9, 1.08), bend: rangeRand(hr, 0.12, 0.26) }))
    const bx = AX
    const by = form === 'hydra' ? 226 : cyC + 20
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1)
      const side = t < 0.5 ? -1 : t > 0.5 ? 1 : 0
      const pi = Math.min(i, n - 1 - i)
      const pr = pair[pi]
      const a = lerp(-Math.PI + 0.5, -0.5, t)
      const x0 = bx + Math.cos(a) * 96
      const y0 = by + Math.sin(a) * 34
      const hx = bx + Math.cos(a) * 168 * pr.len
      const hy = Math.max(58, by + Math.sin(a) * 150 * pr.len)
      const mx = (x0 + hx) / 2 - side * 26 * pr.bend * 4
      const my = (y0 + hy) / 2 + 10
      const neckPts = quadPts([x0, y0], [mx, my], [hx, hy], 12)
      const ang = Math.atan2(hy - my, hx - mx)
      const hb = blob(hr, hx + Math.cos(ang) * 6, hy + Math.sin(ang) * 6, 22, 15, 10, 0.14, 0.1, ang)
      const px = -Math.sin(ang)
      const py = Math.cos(ang)
      const ex = hx + Math.cos(ang) * 10
      const ey = hy + Math.sin(ang) * 10
      const e1: [number, number] = [ex + px * 7, ey + py * 7]
      const e2: [number, number] = [ex - px * 7, ey - py * 7]
      const dd: [number, number, number][] = Array.from({ length: 7 }, () => [hx + rangeRand(hr, -28, 28), hy + rangeRand(hr, -20, 24), rangeRand(hr, 1.4, 4)])
      const label = list[i].label
      const words = label.split(' ')
      let lines = [label]
      if (label.length > 13 && words.length > 1) {
        let best = 1
        let bestD = Infinity
        for (let k = 1; k < words.length; k++) {
          const d = Math.abs(words.slice(0, k).join(' ').length - words.slice(k).join(' ').length)
          if (d < bestD) {
            bestD = d
            best = k
          }
        }
        lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')]
      }
      headGeo.push({
        neck: taper(neckPts, 26, 13, 1),
        head: hb,
        eyes: [e1, e2],
        drops: dotsPath(dd),
        label: { x: clamp(hx, 48, 352), y: Math.max(18 + lines.length * 12, hy - 28 - (lines.length - 1) * 12), lines },
        hx,
        hy,
      })
    }
  }

  return { half: h, eyes, cx: cxC, cy: cyC, scale, disp, cracks, fly, embers, heads: headGeo }
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

function InkEye({ e, u, blink = true }: { e: EyeGeo; u: string; blink?: boolean }) {
  const s = e.s
  const rot = e.style === 'angry' ? 20 * (e.side === -1 ? 1 : e.side === 1 ? -1 : 0) : 0
  const tr = `translate(${f(e.x)} ${f(e.y)})`
  const dl = { animationDelay: `${f(e.delay)}s` } as CSSProperties
  const shape =
    e.style === 'narrow'
      ? `M${-s * 1.4} 0Q0 ${-s * 0.42} ${s * 1.4} 0Q0 ${s * 0.3} ${-s * 1.4} 0Z`
      : e.style === 'round'
        ? `M${-s} 0A${s} ${s} 0 1 0 ${s} 0A${s} ${s} 0 1 0 ${-s} 0Z`
        : `M${-s * 1.2} 0Q0 ${-s * 1.05} ${s * 1.2} 0Q0 ${s * 0.95} ${-s * 1.2} 0Z`
  return (
    <g transform={tr}>
      <circle className="art-ink-eyeglow" r={f(s * (e.ghost ? 2.4 : 3.3))} fill={`url(#${u}eg)`} opacity={e.ghost ? 0.6 : 1} />
      <g transform={rot ? `rotate(${rot})` : undefined}>
        <g className={blink ? 'art-ink-eye' : undefined} style={dl}>
          {e.style === 'hollow' && <path d={`M${-s * 1.45} 0Q0 ${-s * 1.3} ${s * 1.45} 0Q0 ${s * 1.15} ${-s * 1.45} 0Z`} fill="#0b0612" />}
          <path d={shape} fill={`url(#${u}ei)`} transform={e.style === 'hollow' ? 'scale(0.62)' : undefined} />
          {e.style === 'slit' || e.style === 'angry' ? (
            <ellipse rx={f(s * 0.22)} ry={f(s * 0.72)} fill="#1a0610" />
          ) : e.style === 'narrow' ? null : (
            <circle r={f(s * (e.style === 'hollow' ? 0.26 : 0.4))} fill="#1a0610" />
          )}
          {e.style === 'tired' && <path d={`M${-s * 1.3} ${-s * 0.1}Q0 ${-s * 1.2} ${s * 1.3} ${-s * 0.1}L${s * 1.3} ${-s * 1.2}L${-s * 1.3} ${-s * 1.2}Z`} fill="#20080e" />}
          {e.style === 'angry' && <path d={`M${-s * 1.4} ${-s * 0.2}L${s * 1.4} ${-s * 0.75}L${s * 1.4} ${-s * 1.6}L${-s * 1.4} ${-s * 1.6}Z`} fill="#150a18" />}
          <circle cx={f(-s * 0.32)} cy={f(-s * 0.3)} r={f(Math.max(0.8, s * 0.16))} fill="#fffaf0" opacity={0.9} />
        </g>
      </g>
    </g>
  )
}

export function Inkblot({
  seed,
  ink = '#221238',
  sheen = '#7a3bd1',
  eyes = 2,
  eyeColor = '#ff9a3c',
  spiky = 0.3,
  heads,
  hp = 1,
  state = 'idle',
  size = 360,
  card = true,
  className,
  form,
}: InkblotProps): JSX.Element {
  const u = useUid()
  const shape: InkForm = form ?? FORMS[Math.abs(Math.floor(seed)) % FORMS.length]
  const headsKey = heads ? heads.map((h) => h.label).join('|') : ''
  const g = useMemo(
    () => buildInk(seed, shape, spiky, eyes, heads),
    // alive-состояния голов геометрию не меняют — только стили
    [seed, shape, spiky, eyes, headsKey],
  )
  const life = clamp(hp)
  const dry = clamp((0.7 - life) / 0.55)
  const inkO = 0.5 + 0.5 * life
  const half = `${u}half`
  const tr = g.scale !== 1 ? `translate(${AX} ${g.cy}) scale(${g.scale}) translate(${-AX} ${-g.cy})` : undefined
  const heightPx = (size * H) / W
  const markColor = '#efe4cc'
  const isDead = state === 'dead'
  const alive = heads ?? []
  return (
    <div
      className={cx('art-inkblot', card && 'art-inkblot--card', `art-ink--${state}`, `art-ink-form--${shape}`, className)}
      style={{ width: size, height: heightPx, borderRadius: card ? size * 0.035 : 0 }}
      aria-hidden="true"
    >
      {card && (
        <svg className="art-ink-card" viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <radialGradient id={`${u}vig`} cx="0.5" cy="0.48" r="0.72">
              <stop offset="0.55" stopColor="#7a5a30" stopOpacity="0" />
              <stop offset="0.85" stopColor="#7a5a30" stopOpacity="0.12" />
              <stop offset="1" stopColor="#5a3a1a" stopOpacity="0.32" />
            </radialGradient>
            <radialGradient id={`${u}scorch`} cx="0.5" cy="0.55" r="0.45">
              <stop offset="0" stopColor="#6a3010" stopOpacity="0.28" />
              <stop offset="0.7" stopColor="#8a4a1a" stopOpacity="0.1" />
              <stop offset="1" stopColor="#8a4a1a" stopOpacity="0" />
            </radialGradient>
            <filter id={`${u}grain`} x="0" y="0" width="1" height="1">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed % 97} stitchTiles="stitch" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.32  0 0 0 0 0.24  0 0 0 0 0.14  1.5 0 0 0 -0.62" />
            </filter>
          </defs>
          <rect width={W} height={H} rx={14} fill="#efe4cc" />
          {shape === 'ember' && !isDead && <rect width={W} height={H} fill={`url(#${u}scorch)`} />}
          <rect width={W} height={H} rx={14} fill={`url(#${u}vig)`} />
          <rect width={W} height={H} rx={14} filter={`url(#${u}grain)`} opacity={0.4} />
          <rect x={12} y={12} width={W - 24} height={H - 24} rx={8} fill="none" stroke="#b8a47c" strokeWidth={1} opacity={0.45} />
          <path d={`M${AX} 16V${H - 16}`} stroke="#d4c3a0" strokeWidth={1} opacity={0.8} />
          <path d={`M${AX + 1.2} 16V${H - 16}`} stroke="#fff8e8" strokeWidth={1} opacity={0.55} />
          <text x={AX} y={31} fontSize={11} fill="#8a7654" textAnchor="middle" fontFamily="var(--font-display)" letterSpacing="0.1em">
            {ROMAN[Math.abs(seed) % 10]}
          </text>
          {isDead && (
            <g opacity={0.06} fill={ink}>
              {[tr, `matrix(-1 0 0 1 ${W} 0)${tr ? ' ' + tr : ''}`].map((t, i) => (
                <g key={i} transform={t}>
                  {g.half.body.map((d, k) => (
                    <path key={k} d={d} />
                  ))}
                  {g.half.strokes.map((d, k) => (
                    <path key={`s${k}`} d={d} />
                  ))}
                </g>
              ))}
            </g>
          )}
        </svg>
      )}
      {!isDead && (
        <div className="art-ink-body">
          <svg viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <filter id={`${u}ink`} x="-15%" y="-15%" width="130%" height="130%">
                <feTurbulence type="fractalNoise" baseFrequency="0.034" numOctaves={2} seed={seed % 89} result="t" />
                <feDisplacementMap in="SourceGraphic" in2="t" scale={g.disp} xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <radialGradient id={`${u}fill`} cx={AX} cy={g.cy} r={200} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor={ink} />
                <stop offset="0.42" stopColor={ink} stopOpacity="0.97" />
                <stop offset="0.72" stopColor={mix(ink, sheen, 0.4)} stopOpacity="0.92" />
                <stop offset="1" stopColor={sheen} stopOpacity="0.8" />
              </radialGradient>
            </defs>
            <g style={{ opacity: inkO }} className="art-lh-fade">
              {/* сначала «разводы» обеих половин, потом плотные чернила — иначе зеркальный развод ложится поверх */}
              <g id={`${half}w`} filter={`url(#${u}ink)`} transform={tr}>
                <g fill={mix(ink, sheen, 0.55)} opacity={0.3 * (0.35 + 0.65 * life)}>
                  {g.half.wash.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>
              </g>
              <use href={`#${half}w`} transform={`matrix(-1 0 0 1 ${W} 0)`} />
              <g id={half} filter={`url(#${u}ink)`} transform={tr}>
                <g fill={`url(#${u}fill)`} opacity={shape === 'cloud' ? 0.8 : 1}>
                  {g.half.body.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                  {g.half.strokes.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                  <path d={dotsPath(g.half.drops)} />
                </g>
                <g fill={mix(ink, '#000000', 0.3)} opacity={0.5}>
                  {g.half.core.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>
                <g fill={sheen} opacity={0.32}>
                  {g.half.shine.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>
                {g.half.hot.length > 0 && <path d={dotsPath(g.half.hot)} fill={mix(sheen, '#ffe6a0', 0.35)} />}
              </g>
              <use href={`#${half}`} transform={`matrix(-1 0 0 1 ${W} 0)`} />
              {/* метки цветом карточки: рот, клыки, швы (симметрично) */}
              {(g.half.marks.length > 0 || g.half.markFill.length > 0) && (
                <g transform={tr}>
                  {[undefined, `matrix(-1 0 0 1 ${W} 0)`].map((t, i) => (
                    <g key={i} transform={t}>
                      <path d={g.half.marks.join('')} fill="none" stroke={markColor} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
                      <path d={g.half.markFill.join('')} fill={markColor} opacity={0.9} />
                    </g>
                  ))}
                </g>
              )}
              {/* трещины при низком hp */}
              {dry > 0 && (
                <g transform={tr} style={{ opacity: dry }} className="art-lh-fade">
                  {[undefined, `matrix(-1 0 0 1 ${W} 0)`].map((t, i) => (
                    <path key={i} d={g.cracks} transform={t} fill="none" stroke={markColor} strokeWidth={1.4} strokeLinecap="round" opacity={0.85} />
                  ))}
                </g>
              )}
            </g>
            {/* головы Гидры */}
            {g.heads.length > 0 && (
              <g>
                {g.heads.map((hd, i) => {
                  const on = alive[i]?.alive ?? true
                  return (
                    <g key={i} className={cx('art-ink-head', !on && 'art-ink-head--dead')}>
                      <g filter={`url(#${u}ink)`} fill={`url(#${u}fill)`} opacity={inkO}>
                        <path d={hd.neck} />
                        <path d={hd.head} />
                      </g>
                      {!on && <path d={hd.drops} fill={ink} />}
                    </g>
                  )
                })}
              </g>
            )}
            {/* подписи голов */}
            {g.heads.map((hd, i) => {
              const on = alive[i]?.alive ?? true
              const lines = hd.label.lines.filter(Boolean)
              if (!lines.length) return null
              const wMax = Math.max(...lines.map((l) => l.length)) * 6.2
              return (
                <g key={i} className="art-ink-label" opacity={on ? 1 : 0.45}>
                  <text x={f(hd.label.x)} y={f(hd.label.y)} fontSize={12.5} fill="#3a2440" textAnchor="middle" fontFamily="var(--font-display)">
                    {lines.map((l, k) => (
                      <tspan key={k} x={f(hd.label.x)} dy={k ? 13 : 0}>
                        {l}
                      </tspan>
                    ))}
                  </text>
                  {!on && (
                    <path
                      d={lines.map((_, k) => `M${f(hd.label.x - wMax / 2)} ${f(hd.label.y - 4 + k * 13)}H${f(hd.label.x + wMax / 2)}`).join('')}
                      stroke="#8e1f4a"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                    />
                  )}
                </g>
              )
            })}
          </svg>
          {/* глаза — отдельный слой без фильтра */}
          <svg viewBox={`0 0 ${W} ${H}`} className="art-ink-eyes">
            <defs>
              <radialGradient id={`${u}eg`}>
                <stop offset="0" stopColor={eyeColor} stopOpacity={f(0.55 + 0.35 * life)} />
                <stop offset="0.35" stopColor={eyeColor} stopOpacity="0.26" />
                <stop offset="1" stopColor={eyeColor} stopOpacity="0" />
              </radialGradient>
              <radialGradient id={`${u}ei`} cx="0.45" cy="0.42" r="0.62">
                <stop offset="0" stopColor="#fff6d8" />
                <stop offset="0.45" stopColor={eyeColor} />
                <stop offset="1" stopColor={mix(eyeColor, '#5a0a10', 0.45)} />
              </radialGradient>
            </defs>
            <g transform={tr}>
              {g.eyes.map((e, i) => (
                <InkEye key={i} e={e} u={u} />
              ))}
            </g>
            {g.heads.map((hd, i) =>
              (alive[i]?.alive ?? true)
                ? hd.eyes.map(([x, y], k) => (
                    <InkEye key={`${i}-${k}`} e={{ x, y, s: 4.2, style: 'angry', side: k ? 1 : -1, delay: -i * 0.7 }} u={u} />
                  ))
                : null,
            )}
          </svg>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="art-ink-fx">
        <defs>
          <radialGradient id={`${u}fl`}>
            <stop offset="0" stopColor="#fffdf2" stopOpacity="0.95" />
            <stop offset="0.4" stopColor="#fff3d0" stopOpacity="0.5" />
            <stop offset="1" stopColor="#fff3d0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${u}em`}>
            <stop offset="0" stopColor="#fffbe6" />
            <stop offset="0.18" stopColor="#ffd68a" stopOpacity="0.85" />
            <stop offset="0.45" stopColor="#ffb547" stopOpacity="0.3" />
            <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
          </radialGradient>
        </defs>
        {state === 'hit' && <ellipse className="art-ink-flash" cx={AX} cy={g.cy} rx={210} ry={170} fill={`url(#${u}fl)`} />}
        {state === 'dying' &&
          g.fly.map((d, i) => (
            <g key={i} transform={`translate(${f(d.x)} ${f(d.y)})`}>
              <circle
                className="art-a art-ink-drop"
                r={f(d.r)}
                fill={i % 3 ? ink : sheen}
                style={{ '--dx': `${f(d.dx)}px`, '--dy': `${f(d.dy)}px`, animationDelay: `${f(d.dl)}s` } as CSSProperties}
              />
            </g>
          ))}
        {shape === 'ember' &&
          !isDead &&
          state !== 'dying' &&
          g.embers.map((e, i) => (
            <g key={i} transform={`translate(${f(e.x)} ${f(e.y)})`}>
              <circle
                className="art-a art-ink-rise"
                r={1.8}
                fill={sheen}
                style={{ animationDelay: `${f(e.dl)}s`, '--sx': `${f(e.sx)}px`, '--sy': '-90px' } as CSSProperties}
              />
            </g>
          ))}
        {isDead && (
          <g className="art-ink-dead-in">
            <circle cx={AX} cy={170} r={70} fill={`url(#${u}em)`} className="art-ink-ember" />
            <g transform={`translate(${AX} 176)`}>
              <path d="M0 -26C9 -14 11 -4 0 6C-11 -4 -9 -14 0 -26Z" fill="#ffc15a" />
              <path d="M0 -14C4 -8 5 -2 0 3C-5 -2 -4 -8 0 -14Z" fill="#fff6d8" />
            </g>
            {[0, 1, 2].map((i) => (
              <g key={i} transform={`translate(${AX - 8 + i * 8} 160)`}>
                <circle className="art-a art-ink-rise" r={1.4} fill="#ffd68a" style={{ animationDelay: `${-i * 1.2}s`, '--sx': `${(i - 1) * 10}px`, '--sy': '-50px' } as CSSProperties} />
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}

export type BossLookId = 'impostor' | 'fog' | 'goblin' | 'golem' | 'troll' | 'storm' | 'hydra' | 'burnout'

export const BOSS_LOOKS: Record<BossLookId, Omit<InkblotProps, 'state' | 'hp' | 'heads' | 'size' | 'className'>> = {
  impostor: { seed: 1107, form: 'mask', ink: '#221238', sheen: '#7a3bd1', eyes: 2, eyeColor: '#ffc15a', spiky: 0.15 },
  fog: { seed: 2203, form: 'cloud', ink: '#37345c', sheen: '#9d9ac8', eyes: 4, eyeColor: '#e6e0ff', spiky: 0 },
  goblin: { seed: 3319, form: 'imp', ink: '#5a1030', sheen: '#8e1f4a', eyes: 2, eyeColor: '#ffd34d', spiky: 0.85 },
  golem: { seed: 4441, form: 'block', ink: '#101a30', sheen: '#3d5a8c', eyes: 2, eyeColor: '#8fd8ff', spiky: 0.05 },
  troll: { seed: 5527, form: 'brute', ink: '#1f0b1a', sheen: '#b3243f', eyes: 2, eyeColor: '#ff5a3a', spiky: 0.95 },
  storm: { seed: 6607, form: 'vortex', ink: '#141c3c', sheen: '#4fbfae', eyes: 1, eyeColor: '#dffff6', spiky: 0.45 },
  hydra: { seed: 7759, form: 'hydra', ink: '#221238', sheen: '#7a3bd1', eyes: 0, eyeColor: '#ffb547', spiky: 0.3 },
  burnout: { seed: 8821, form: 'ember', ink: '#3a0a14', sheen: '#ff7a2a', eyes: 2, eyeColor: '#ff8a3d', spiky: 0.4 },
}
