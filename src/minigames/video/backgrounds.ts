// «Живые фоны» — процедурные анимации на canvas. Время — глобальное время ролика,
// поэтому несколько клипов одного фона подряд склеиваются без шва.
import type { BgPreset, TextTone } from './types'
import { mix, palette, rgba } from './palette'
import { easeInOut } from './util'

export interface BgPresetInfo {
  id: BgPreset
  name: string
  hint: string
}

export const BG_PRESETS: BgPresetInfo[] = [
  { id: 'aurora', name: 'Аврора', hint: 'Мягкие переливы мяты и фиолета' },
  { id: 'night', name: 'Ночь', hint: 'Звёзды и дрейфующий туман' },
  { id: 'paper', name: 'Бумага', hint: 'Тёплая бумага, тёмный текст' },
  { id: 'pulse', name: 'Пульс', hint: 'Дышащий свет фонаря' },
]

export const bgName = (p: BgPreset) => BG_PRESETS.find((x) => x.id === p)?.name ?? 'Фон'
export const bgTone = (p: BgPreset): TextTone => (p === 'paper' ? 'dark' : 'light')

type Ctx = CanvasRenderingContext2D

function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Мягкое пятно света: радиальный градиент, можно вытянуть по осям. */
function glow(ctx: Ctx, x: number, y: number, r: number, color: string, a: number, sx = 1, sy = 1, mid = 0.45) {
  if (a <= 0.002 || r <= 0) return
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(sx, sy)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
  g.addColorStop(0, rgba(color, a))
  g.addColorStop(mid, rgba(color, a * 0.42))
  g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(-r, -r, r * 2, r * 2)
  ctx.restore()
}

function vertical(ctx: Ctx, w: number, h: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  for (const [o, c] of stops) g.addColorStop(o, c)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function vignette(ctx: Ctx, w: number, h: number, a: number, color: string) {
  const g = ctx.createRadialGradient(w / 2, h * 0.48, h * 0.26, w / 2, h * 0.5, h * 0.8)
  g.addColorStop(0, rgba(color, 0))
  g.addColorStop(1, rgba(color, a))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

const sprites = new Map<string, HTMLCanvasElement>()

/** Готовая «светлячковая» точка — дешевле, чем shadowBlur на каждом кадре. */
function sprite(color: string): HTMLCanvasElement {
  const hit = sprites.get(color)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  if (x) {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, rgba(color, 1))
    g.addColorStop(0.16, rgba(color, 0.85))
    g.addColorStop(0.45, rgba(color, 0.2))
    g.addColorStop(1, rgba(color, 0))
    x.fillStyle = g
    x.fillRect(0, 0, 64, 64)
  }
  sprites.set(color, c)
  return c
}

interface Star {
  x: number
  y: number
  r: number
  sp: number
  ph: number
  big: boolean
}

const starSets = new Map<string, Star[]>()

function starsFor(count: number, seed: number): Star[] {
  const key = `${count}:${seed}`
  const hit = starSets.get(key)
  if (hit) return hit
  const rnd = mulberry32(seed)
  const list: Star[] = []
  for (let i = 0; i < count; i++) {
    list.push({
      x: rnd(),
      y: Math.pow(rnd(), 1.35),
      r: 0.55 + rnd() * 1.35,
      sp: 0.5 + rnd() * 1.9,
      ph: rnd() * Math.PI * 2,
      big: rnd() < 0.06,
    })
  }
  starSets.set(key, list)
  return list
}

function drawStars(ctx: Ctx, w: number, h: number, t: number, count: number, seed: number, alpha: number, color: string) {
  const u = w / 720
  const glint = sprite(color)
  ctx.fillStyle = color
  for (const s of starsFor(count, seed)) {
    const tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph)
    const a = alpha * (0.3 + 0.7 * tw)
    const x = s.x * w
    const y = s.y * h
    const r = Math.max(0.6, s.r * u)
    ctx.globalAlpha = a
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    if (s.big) {
      const d = 26 * u * (0.8 + 0.4 * tw)
      ctx.globalAlpha = a * 0.75
      ctx.drawImage(glint, x - d / 2, y - d / 2, d, d)
      ctx.globalAlpha = a * 0.45
      ctx.fillRect(x - 10 * u, y - 0.6 * u, 20 * u, 1.2 * u)
      ctx.fillRect(x - 0.6 * u, y - 10 * u, 1.2 * u, 20 * u)
    }
  }
  ctx.globalAlpha = 1
}

// ---------- Аврора ----------

function curtain(ctx: Ctx, w: number, h: number, t: number, y0: number, amp: number, color: string, alpha: number, speed: number, phase: number) {
  const n = 9
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1)
    const x = w * (-0.08 + 1.16 * k)
    const y = h * (y0 + amp * Math.sin(k * Math.PI * 2.4 + t * speed + phase) + 0.012 * Math.sin(t * 0.9 + i * 1.3))
    const a = alpha * (0.55 + 0.45 * Math.sin(t * 0.55 + i * 1.7 + phase))
    glow(ctx, x, y, w * 0.2, color, a, 0.7, 2.6, 0.5)
  }
}

function drawAurora(ctx: Ctx, w: number, h: number, t: number) {
  const P = palette()
  vertical(ctx, w, h, [
    [0, mix(P.night, '#000000', 0.35)],
    [0.5, P.night2],
    [1, P.night],
  ])
  drawStars(ctx, w, h * 0.7, t, 60, 11, 0.5, P.paper)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  glow(ctx, w * (0.25 + 0.12 * Math.sin(t * 0.13)), h * (0.36 + 0.05 * Math.sin(t * 0.21 + 1)), w * 0.7, P.aurora, 0.2, 1, 1.5)
  glow(ctx, w * (0.78 + 0.1 * Math.sin(t * 0.11 + 2)), h * (0.6 + 0.06 * Math.cos(t * 0.17)), w * 0.78, P.inkHi, 0.3, 1, 1.4)
  glow(ctx, w * (0.5 + 0.18 * Math.cos(t * 0.09)), h * (0.88 + 0.03 * Math.sin(t * 0.23)), w * 0.66, P.auroraDeep, 0.22, 1.3, 0.8)
  curtain(ctx, w, h, t, 0.3, 0.05, P.aurora, 0.2, 0.26, 0)
  curtain(ctx, w, h, t, 0.46, 0.06, P.inkHi, 0.24, -0.18, 2.1)
  curtain(ctx, w, h, t, 0.62, 0.04, P.aurora, 0.12, 0.14, 4.2)
  ctx.restore()
  vignette(ctx, w, h, 0.5, mix(P.night, '#000000', 0.75))
}

// ---------- Ночь ----------

function drawNight(ctx: Ctx, w: number, h: number, t: number) {
  const P = palette()
  vertical(ctx, w, h, [
    [0, mix(P.night, '#000000', 0.45)],
    [0.55, P.night],
    [1, P.dusk],
  ])
  glow(ctx, w * 0.5, h * 1.02, w * 0.95, P.lantern, 0.14, 1.3, 0.55)
  // луна — в верхней полосе, чтобы не спорить с текстом
  const mx = w * 0.8
  const my = h * 0.085
  const mr = w * 0.04
  glow(ctx, mx, my, mr * 5, P.lanternHi, 0.12)
  const mg = ctx.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, mr * 0.1, mx, my, mr)
  mg.addColorStop(0, mix(P.paper, '#ffffff', 0.55))
  mg.addColorStop(1, P.lanternHi)
  ctx.fillStyle = mg
  ctx.beginPath()
  ctx.arc(mx, my, mr, 0, Math.PI * 2)
  ctx.fill()
  drawStars(ctx, w, h * 0.82, t, 150, 3, 0.95, P.paper)
  // туман: пятна уходят за край целиком, поэтому перенос не виден
  const span = w * 3.2
  for (let i = 0; i < 7; i++) {
    const speed = w * (0.014 + 0.006 * (i % 3))
    const x = ((i * 0.31 * span + t * speed) % span) - w * 1.1
    const y = h * (0.5 + 0.075 * i) + h * 0.012 * Math.sin(t * 0.25 + i)
    glow(ctx, x, y, w * (0.5 + 0.08 * (i % 2)), P.fog, 0.12 + 0.02 * (i % 3), 1.7, 0.4)
  }
  vignette(ctx, w, h, 0.45, mix(P.night, '#000000', 0.7))
}

// ---------- Бумага ----------

let grain: HTMLCanvasElement | null = null
const GRAIN = 192

function grainTile(): HTMLCanvasElement {
  if (grain) return grain
  const c = document.createElement('canvas')
  c.width = c.height = GRAIN
  const x = c.getContext('2d')
  if (x) {
    const img = x.createImageData(GRAIN, GRAIN)
    const rnd = mulberry32(42)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      if (rnd() < 0.5) {
        d[i] = 70
        d[i + 1] = 48
        d[i + 2] = 24
        d[i + 3] = Math.floor(rnd() * 34)
      } else {
        d[i] = 255
        d[i + 1] = 252
        d[i + 2] = 240
        d[i + 3] = Math.floor(rnd() * 26)
      }
    }
    x.putImageData(img, 0, 0)
    // волокна бумаги
    x.globalAlpha = 0.09
    x.strokeStyle = '#8a6a3a'
    x.lineWidth = 0.6
    for (let i = 0; i < 26; i++) {
      const sx = rnd() * GRAIN
      const sy = rnd() * GRAIN
      x.beginPath()
      x.moveTo(sx, sy)
      x.quadraticCurveTo(sx + (rnd() - 0.5) * 40, sy + (rnd() - 0.5) * 40, sx + (rnd() - 0.5) * 60, sy + (rnd() - 0.5) * 60)
      x.stroke()
    }
  }
  grain = c
  return c
}

const patterns = new WeakMap<Ctx, CanvasPattern>()

function drawPaper(ctx: Ctx, w: number, h: number, t: number) {
  const P = palette()
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.05, w * 0.5, h * 0.5, h * 0.78)
  g.addColorStop(0, mix(P.paper, '#ffffff', 0.45))
  g.addColorStop(0.55, P.paper)
  g.addColorStop(1, mix(P.card, P.lanternDeep, 0.18))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  glow(ctx, w * (0.28 + 0.1 * Math.sin(t * 0.1)), h * (0.24 + 0.05 * Math.cos(t * 0.13)), w * 0.85, P.lanternHi, 0.2)
  glow(ctx, w * (0.8 + 0.06 * Math.cos(t * 0.08)), h * (0.78 + 0.04 * Math.sin(t * 0.11)), w * 0.7, P.rose, 0.07)
  let pat = patterns.get(ctx)
  if (!pat) {
    const p = ctx.createPattern(grainTile(), 'repeat')
    if (p) {
      patterns.set(ctx, p)
      pat = p
    }
  }
  if (pat) {
    // зерно «живёт» 12 раз в секунду, как плёнка
    const f = Math.floor(t * 12)
    const ox = (f * 71) % GRAIN
    const oy = (f * 113) % GRAIN
    ctx.save()
    ctx.translate(-ox, -oy)
    ctx.fillStyle = pat
    ctx.fillRect(0, 0, w + GRAIN, h + GRAIN)
    ctx.restore()
  }
  vignette(ctx, w, h, 0.2, mix(P.lanternDeep, '#3a2410', 0.5))
}

// ---------- Пульс ----------

function fireflies(ctx: Ctx, w: number, h: number, t: number, color: string) {
  const rnd = mulberry32(7)
  const sp = sprite(color)
  const u = w / 720
  for (let i = 0; i < 16; i++) {
    const x0 = rnd() * w
    const speed = (12 + rnd() * 22) * u
    const ph = rnd() * Math.PI * 2
    const size = (10 + rnd() * 16) * u
    const off = rnd() * h * 1.3
    const y = h * 1.1 - ((off + t * speed) % (h * 1.3))
    const x = x0 + Math.sin(t * 0.5 + ph) * 26 * u
    ctx.globalAlpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.3 + ph * 2))
    ctx.drawImage(sp, x - size / 2, y - size / 2, size, size)
  }
  ctx.globalAlpha = 1
}

function drawPulse(ctx: Ctx, w: number, h: number, t: number) {
  const P = palette()
  vertical(ctx, w, h, [
    [0, mix(P.ink, '#000000', 0.2)],
    [0.5, mix(P.ink, P.lanternDeep, 0.12)],
    [1, P.night],
  ])
  // дыхание: вдох 40% цикла, выдох 60%
  const cycle = 8
  const ph = (((t % cycle) + cycle) % cycle) / cycle
  const b = ph < 0.4 ? easeInOut(ph / 0.4) : 1 - easeInOut((ph - 0.4) / 0.6)
  const cx = w * 0.5
  const cy = h * 0.47
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  glow(ctx, cx, cy, w * (0.95 + 0.18 * b), P.lanternDeep, 0.16 + 0.1 * b, 1, 1.35)
  glow(ctx, cx, cy, w * (0.55 + 0.14 * b), P.lantern, 0.18 + 0.14 * b, 1, 1.2)
  glow(ctx, cx, cy, w * (0.26 + 0.08 * b), P.lanternHi, 0.14 + 0.14 * b, 1, 1.1)
  fireflies(ctx, w, h, t, P.lanternHi)
  ctx.restore()
  vignette(ctx, w, h, 0.55, mix(P.night, '#000000', 0.6))
}

export function drawBackground(ctx: Ctx, preset: BgPreset, w: number, h: number, t: number): void {
  switch (preset) {
    case 'aurora':
      drawAurora(ctx, w, h, t)
      break
    case 'night':
      drawNight(ctx, w, h, t)
      break
    case 'paper':
      drawPaper(ctx, w, h, t)
      break
    case 'pulse':
      drawPulse(ctx, w, h, t)
      break
  }
}

const thumbs = new Map<BgPreset, string>()

/** Статичная миниатюра фона 9:16 для списков и таймлайна. */
export function bgThumb(p: BgPreset): string {
  const hit = thumbs.get(p)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 108
  c.height = 192
  const x = c.getContext('2d')
  if (!x) return ''
  drawBackground(x, p, 108, 192, 3.4)
  const url = c.toDataURL('image/jpeg', 0.82)
  thumbs.set(p, url)
  return url
}
