// Текстовый слой ролика: четыре стиля, хук, субтитры и водяной знак.
// Каждый блок рисуется один раз в отдельный canvas и кэшируется — кадр только копирует картинки.
import { fitText, fontString, type TextLayout } from './textLayout'
import { mix, palette, rgba } from './palette'
import {
  OUT_H,
  OUT_W,
  SAFE_BOTTOM,
  SAFE_TOP,
  type TextPos,
  type TextRole,
  type TextSettings,
  type TextStyleId,
  type TextTone,
} from './types'
import { clamp, easeOut } from './util'

export const UI_FAMILY = '"Golos Text Variable", "Golos Text", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
export const DISPLAY_FAMILY = 'Alice, Georgia, "Times New Roman", serif'

/** Ширина текстового блока в кадре 720: по центру, левее колонки кнопок соцсети */
export const TEXT_BOX_W = 548

/** Тёмный текст на тёплой плашке — как у кнопки .btn-lit */
const LANTERN_INK = '#2b1705'

export interface Block {
  canvas: HTMLCanvasElement
  /** Поля под тень вокруг содержимого */
  pad: number
  w: number
  h: number
}

interface Spec {
  family: string
  weight: number
  max: number
  min: number
  lh: number
  lines: number
}

function specFor(role: TextRole, style: TextStyleId): Spec {
  const hook = role === 'hook'
  switch (style) {
    case 'clean':
      return hook
        ? { family: UI_FAMILY, weight: 800, max: 66, min: 40, lh: 1.12, lines: 5 }
        : { family: UI_FAMILY, weight: 700, max: 44, min: 30, lh: 1.2, lines: 4 }
    case 'lantern':
      return hook
        ? { family: UI_FAMILY, weight: 800, max: 56, min: 36, lh: 1.3, lines: 5 }
        : { family: UI_FAMILY, weight: 700, max: 40, min: 28, lh: 1.34, lines: 4 }
    case 'ink':
      return hook
        ? { family: UI_FAMILY, weight: 800, max: 56, min: 36, lh: 1.16, lines: 5 }
        : { family: UI_FAMILY, weight: 600, max: 40, min: 28, lh: 1.24, lines: 4 }
    case 'notebook':
      return hook
        ? { family: DISPLAY_FAMILY, weight: 400, max: 62, min: 38, lh: 1.24, lines: 5 }
        : { family: DISPLAY_FAMILY, weight: 400, max: 44, min: 30, lh: 1.32, lines: 4 }
  }
}

let measureCtx: CanvasRenderingContext2D | null = null

function mctx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const c = document.createElement('canvas')
    c.width = c.height = 2
    const x = c.getContext('2d')
    if (!x) throw new Error('Canvas 2D недоступен')
    measureCtx = x
  }
  return measureCtx
}

function surface(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  const x = c.getContext('2d')
  if (!x) throw new Error('Canvas 2D недоступен')
  return [c, x]
}

function rr(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, R: number) {
  const r = Math.max(0, Math.min(R, W / 2, H / 2))
  x.moveTo(X + r, Y)
  x.arcTo(X + W, Y, X + W, Y + H, r)
  x.arcTo(X + W, Y + H, X, Y + H, r)
  x.arcTo(X, Y + H, X, Y, r)
  x.arcTo(X, Y, X + W, Y, r)
  x.closePath()
}

function noShadow(x: CanvasRenderingContext2D) {
  x.shadowColor = 'transparent'
  x.shadowBlur = 0
  x.shadowOffsetX = 0
  x.shadowOffsetY = 0
}

function drawLines(x: CanvasRenderingContext2D, L: TextLayout, cx: number, top: number, mode: 'fill' | 'stroke') {
  x.font = L.font
  x.textAlign = 'center'
  x.textBaseline = 'alphabetic'
  L.lines.forEach((line, i) => {
    if (!line) return
    const base = top + L.lineGap * (i + 0.5) + L.capHeight / 2
    if (mode === 'fill') x.fillText(line, cx, base)
    else x.strokeText(line, cx, base)
  })
}

function layout(text: string, s: Spec, maxWidth: number): TextLayout {
  return fitText(mctx(), text, {
    family: s.family,
    weight: s.weight,
    maxSize: s.max,
    minSize: s.min,
    maxWidth,
    maxLines: s.lines,
    lineHeight: s.lh,
    balance: true,
  })
}

function paintClean(text: string, s: Spec, tone: TextTone): Block {
  const L = layout(text, s, TEXT_BOX_W)
  const P = palette()
  const pad = 34
  const w = L.width + 10
  const h = L.height
  const [c, x] = surface(w + pad * 2, h + pad * 2)
  const cx = pad + w / 2
  x.lineJoin = 'round'
  if (tone === 'light') {
    const shade = mix(P.night, '#000000', 0.6)
    x.shadowColor = rgba(shade, 0.62)
    x.shadowBlur = 22
    x.shadowOffsetY = 4
    x.strokeStyle = rgba(shade, 0.5)
    x.lineWidth = Math.max(3, L.size * 0.09)
    drawLines(x, L, cx, pad, 'stroke')
    noShadow(x)
    x.fillStyle = '#ffffff'
    drawLines(x, L, cx, pad, 'fill')
  } else {
    x.shadowColor = rgba(mix(P.paper, '#ffffff', 0.6), 0.85)
    x.shadowBlur = 12
    x.fillStyle = P.ink
    drawLines(x, L, cx, pad, 'fill')
  }
  return { canvas: c, pad, w, h }
}

function paintLantern(text: string, s: Spec): Block {
  const kx = 0.42
  const ky = 0.16
  const L = layout(text, s, TEXT_BOX_W - 2 * s.max * kx)
  const P = palette()
  const padX = L.size * kx
  const padY = L.size * ky
  const r = L.size * 0.3
  const w = L.width + padX * 2
  const h = L.height + padY * 2
  const pad = 38
  const [c, x] = surface(w + pad * 2, h + pad * 2)
  const cx = pad + w / 2
  // плашка на каждую строку; перекрытия сливаются в одну фигуру
  x.beginPath()
  L.lines.forEach((line, i) => {
    if (!line) return
    const lw = L.widths[i] + padX * 2
    rr(x, cx - lw / 2, pad + i * L.lineGap, lw, L.lineGap + padY * 2, r)
  })
  const g = x.createLinearGradient(0, pad, 0, pad + h)
  g.addColorStop(0, P.lanternHi)
  g.addColorStop(1, P.lantern)
  x.fillStyle = g
  x.shadowColor = rgba(P.lanternDeep, 0.45)
  x.shadowBlur = 28
  x.shadowOffsetY = 6
  x.fill()
  noShadow(x)
  x.fillStyle = LANTERN_INK
  drawLines(x, L, cx, pad + padY, 'fill')
  return { canvas: c, pad, w, h }
}

function paintInk(text: string, s: Spec): Block {
  const kx = 0.62
  const ky = 0.46
  const L = layout(text, s, TEXT_BOX_W - 2 * s.max * kx)
  const P = palette()
  const padX = L.size * kx
  const padY = L.size * ky
  const w = Math.max(L.width + padX * 2, L.size * 3)
  const h = L.height + padY * 2
  const pad = 42
  const [c, x] = surface(w + pad * 2, h + pad * 2)
  x.beginPath()
  rr(x, pad, pad, w, h, 26)
  x.fillStyle = rgba(mix(P.night, '#000000', 0.2), 0.82)
  x.shadowColor = rgba('#000000', 0.45)
  x.shadowBlur = 30
  x.shadowOffsetY = 10
  x.fill()
  noShadow(x)
  x.lineWidth = 1.5
  x.strokeStyle = rgba(P.lanternHi, 0.26)
  x.stroke()
  // тёплая метка сверху
  x.beginPath()
  rr(x, pad + w / 2 - 20, pad + Math.max(6, padY * 0.36) - 2, 40, 4, 2)
  x.fillStyle = P.lantern
  x.fill()
  x.fillStyle = P.paper
  drawLines(x, L, pad + w / 2, pad + padY, 'fill')
  return { canvas: c, pad, w, h }
}

function paintNotebook(text: string, s: Spec): Block {
  const kx = 0.8
  const ky = 0.5
  const L = layout(text, s, TEXT_BOX_W - 2 * s.max * kx)
  const P = palette()
  const padX = L.size * kx
  const padY = L.size * ky
  const w = Math.max(L.width + padX * 2, L.size * 4)
  const h = L.height + padY * 2
  const pad = 46
  const [c, x] = surface(w + pad * 2, h + pad * 2)
  // лёгкий наклон — как листок, приклеенный от руки
  x.translate(pad + w / 2, pad + h / 2)
  x.rotate((-1.2 * Math.PI) / 180)
  x.translate(-w / 2, -h / 2)
  x.beginPath()
  rr(x, 0, 0, w, h, 10)
  const g = x.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, mix(P.paper, '#ffffff', 0.5))
  g.addColorStop(1, P.card)
  x.fillStyle = g
  x.shadowColor = rgba('#000000', 0.38)
  x.shadowBlur = 26
  x.shadowOffsetY = 10
  x.fill()
  noShadow(x)
  x.save()
  x.beginPath()
  rr(x, 0, 0, w, h, 10)
  x.clip()
  x.strokeStyle = rgba(mix(P.fog, '#3a5fb0', 0.5), 0.34)
  x.lineWidth = 2
  for (let i = 0; i < L.lines.length; i++) {
    const y = padY + L.lineGap * (i + 0.5) + L.capHeight / 2 + L.size * 0.16
    x.beginPath()
    x.moveTo(10, y)
    x.lineTo(w - 10, y)
    x.stroke()
  }
  const mx = Math.min(padX * 0.5, 30)
  x.strokeStyle = rgba(P.ember, 0.42)
  x.beginPath()
  x.moveTo(mx, 0)
  x.lineTo(mx, h)
  x.stroke()
  x.restore()
  // полоска скотча
  x.save()
  x.translate(w / 2, 2)
  x.rotate((3 * Math.PI) / 180)
  x.fillStyle = rgba(P.lanternHi, 0.55)
  x.fillRect(-46, -13, 92, 26)
  x.restore()
  x.fillStyle = P.ink
  drawLines(x, L, w / 2, padY, 'fill')
  return { canvas: c, pad, w, h }
}

const cache = new Map<string, Block>()
const wmCache = new Map<TextTone, Block>()

export function clearTextCache() {
  cache.clear()
  wmCache.clear()
}

export function textBlock(text: string, role: TextRole, style: TextStyleId, tone: TextTone): Block | null {
  const clean = text.trim()
  if (!clean) return null
  // для плашечных стилей тон кадра не важен
  const t = style === 'clean' ? tone : 'light'
  const key = `${role}|${style}|${t}|${clean}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const s = specFor(role, style)
  let b: Block
  try {
    b =
      style === 'clean'
        ? paintClean(clean, s, t)
        : style === 'lantern'
          ? paintLantern(clean, s)
          : style === 'ink'
            ? paintInk(clean, s)
            : paintNotebook(clean, s)
  } catch {
    return null
  }
  cache.set(key, b)
  while (cache.size > 48) {
    const first = cache.keys().next().value
    if (first === undefined) break
    cache.delete(first)
  }
  return b
}

export const WATERMARK_TEXT = 'Сделано в PsyQuest'

export function watermarkBlock(tone: TextTone): Block | null {
  const hit = wmCache.get(tone)
  if (hit) return hit
  try {
    const P = palette()
    const m = mctx()
    const font = fontString(600, 21, UI_FAMILY)
    m.font = font
    const tw = m.measureText(WATERMARK_TEXT).width
    const icon = 18
    const gap = 9
    const padX = 16
    const h = 38
    const w = padX * 2 + icon + gap + tw
    const pad = 8
    const [c, x] = surface(w + pad * 2, h + pad * 2)
    const light = tone === 'light'
    x.beginPath()
    rr(x, pad, pad, w, h, h / 2)
    x.fillStyle = light ? rgba(mix(P.night, '#000000', 0.3), 0.46) : rgba(P.ink, 0.07)
    x.fill()
    x.lineWidth = 1
    x.strokeStyle = light ? rgba(P.lanternHi, 0.24) : rgba(P.ink, 0.16)
    x.stroke()
    // маленький фонарь
    const ix = pad + padX + icon / 2
    const iy = pad + h / 2 + 1.5
    const g = x.createRadialGradient(ix, iy, 0, ix, iy, 11)
    g.addColorStop(0, rgba(P.lanternHi, 0.95))
    g.addColorStop(0.4, rgba(P.lantern, 0.7))
    g.addColorStop(1, rgba(P.lantern, 0))
    x.fillStyle = g
    x.fillRect(ix - 11, iy - 11, 22, 22)
    x.fillStyle = P.lanternHi
    x.beginPath()
    x.arc(ix, iy, 3.6, 0, Math.PI * 2)
    x.fill()
    x.strokeStyle = light ? rgba(P.paper, 0.7) : rgba(P.ink, 0.5)
    x.lineWidth = 1.6
    x.beginPath()
    x.arc(ix, iy - 7.5, 3, Math.PI, 0)
    x.stroke()
    x.font = font
    x.textBaseline = 'middle'
    x.textAlign = 'left'
    x.fillStyle = light ? rgba(P.paper, 0.92) : rgba(P.ink, 0.74)
    x.fillText(WATERMARK_TEXT, pad + padX + icon + gap, pad + h / 2 + 1)
    const b = { canvas: c, pad, w, h }
    wmCache.set(tone, b)
    return b
  } catch {
    return null
  }
}

// ---------- Раскладка текста в кадре ----------

const SAFE_TOP_Y = OUT_H * SAFE_TOP
const SAFE_BOTTOM_Y = OUT_H * (1 - SAFE_BOTTOM)
const WM_GAP = 20
const STACK_GAP = 22
const FADE_IN = 0.22
const FADE_OUT = 0.16

interface Item {
  block: Block
  pos: TextPos
  alpha: number
  dy: number
}

const STILL = { alpha: 1, dy: 0 }

function anim(t: number, start: number, end: number, dur: number): { alpha: number; dy: number } {
  // блок, который стоит с нулевой секунды, виден сразу — первый кадр станет обложкой
  const kin = start <= 0.001 ? 1 : clamp((t - start) / FADE_IN, 0, 1)
  const kout = end >= dur - 0.01 ? 1 : clamp((end - t) / FADE_OUT, 0, 1)
  const e = easeOut(kin)
  return { alpha: e * kout, dy: (1 - e) * 18 }
}

/**
 * Рисует хук, субтитры и водяной знак на момент t.
 * dur = 0 — ролик пуст: показываем хук, чтобы было видно оформление.
 * animate = false (пауза) — текст целиком, чтобы его было видно при правке.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  text: TextSettings,
  t: number,
  dur: number,
  tone: TextTone,
  watermark: boolean,
  animate: boolean,
) {
  const items: Item[] = []
  if (text.hook.trim() && (dur <= 0 || t < text.hookSec)) {
    const block = textBlock(text.hook, 'hook', text.style, tone)
    const a = animate ? anim(t, 0, Math.min(text.hookSec, dur || text.hookSec), dur) : STILL
    if (block) items.push({ block, pos: text.hookPos, ...a })
  }
  for (const cap of text.captions) {
    if (t < cap.start || t >= cap.end || !cap.text.trim()) continue
    const block = textBlock(cap.text, 'caption', text.style, tone)
    if (block) items.push({ block, pos: text.capPos, ...(animate ? anim(t, cap.start, cap.end, dur) : STILL) })
  }

  const wm = watermark ? watermarkBlock(tone) : null
  const wmTop = SAFE_BOTTOM_Y - WM_GAP - (wm?.h ?? 0)
  const bottomY = wm ? wmTop - 18 : SAFE_BOTTOM_Y - 28

  for (const pos of ['top', 'center', 'bottom'] as const) {
    const group = items.filter((i) => i.pos === pos)
    if (!group.length) continue
    const total = group.reduce((a, i) => a + i.block.h, 0) + STACK_GAP * (group.length - 1)
    let y = pos === 'top' ? SAFE_TOP_Y + 34 : pos === 'center' ? (SAFE_TOP_Y + SAFE_BOTTOM_Y) / 2 - total / 2 : bottomY - total
    y = clamp(y, 24, Math.max(24, OUT_H - 24 - total))
    for (const i of group) {
      if (i.alpha > 0.004) {
        ctx.globalAlpha = i.alpha
        ctx.drawImage(i.block.canvas, Math.round(OUT_W / 2 - i.block.w / 2 - i.block.pad), Math.round(y + i.dy - i.block.pad))
      }
      y += i.block.h + STACK_GAP
    }
  }
  ctx.globalAlpha = 1

  if (wm) ctx.drawImage(wm.canvas, Math.round(OUT_W / 2 - wm.w / 2 - wm.pad), Math.round(wmTop - wm.pad))
}

// ---------- Шрифты для canvas ----------

let fontsPromise: Promise<void> | null = null

/** Подгружает Golos и Alice с кириллицей: canvas сам шрифты не запрашивает. */
export function loadCanvasFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined
  if (!fonts || typeof fonts.load !== 'function') return Promise.resolve()
  const sample = 'АаБбЖжЁё Aa 0123 «»'
  const all = Promise.all([
    fonts.load(`400 40px "Golos Text Variable"`, sample),
    fonts.load(`600 40px "Golos Text Variable"`, sample),
    fonts.load(`700 40px "Golos Text Variable"`, sample),
    fonts.load(`800 40px "Golos Text Variable"`, sample),
    fonts.load(`400 40px Alice`, sample),
  ]).then(() => fonts.ready)
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 4000))
  fontsPromise = Promise.race([all, timeout]).then(
    () => undefined,
    () => undefined,
  )
  return fontsPromise
}
