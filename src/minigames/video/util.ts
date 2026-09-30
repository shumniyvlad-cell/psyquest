import {
  MAX_TOTAL_SEC,
  STILL_MAX_SEC,
  STILL_MIN_SEC,
  type Clip,
  type Timeline,
  type TimelineEntry,
} from './types'

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
export const round1 = (v: number) => Math.round(v * 10) / 10
export const easeOut = (k: number) => 1 - Math.pow(1 - k, 3)
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

let seq = 0
export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function clipDuration(c: Clip): number {
  if (c.kind === 'video') return Math.max(0.1, c.out - c.in)
  return clamp(c.duration, STILL_MIN_SEC, STILL_MAX_SEC)
}

export function buildTimeline(clips: Clip[]): Timeline {
  const entries: TimelineEntry[] = []
  let at = 0
  clips.forEach((clip, index) => {
    const d = clipDuration(clip)
    entries.push({ clip, index, start: at, end: at + d })
    at += d
  })
  return { entries, total: at, duration: Math.min(at, MAX_TOTAL_SEC) }
}

export function entryAt(entries: TimelineEntry[], t: number): TimelineEntry | null {
  if (!entries.length) return null
  for (const e of entries) if (t < e.end) return e
  return entries[entries.length - 1]
}

/** 4.5 → «4,5», 4 → «4» */
export function fmtSec(v: number): string {
  const r = round1(v)
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ',')
}

/** Всегда с десятыми: 4 → «4,0» (для полей ввода) */
export function fmtSecFixed(v: number): string {
  return round1(v).toFixed(1).replace('.', ',')
}

/** 64.25 → «1:04,2» */
export function fmtTime(t: number): string {
  const tt = Math.max(0, t) + 1e-6
  const m = Math.floor(tt / 60)
  const s = tt - m * 60
  const whole = Math.floor(s)
  const tenth = Math.min(9, Math.floor((s - whole) * 10))
  return `${m}:${String(whole).padStart(2, '0')},${tenth}`
}

/** Короткая запись без десятых: «0:24» */
export function fmtClock(t: number): string {
  const tt = Math.max(0, Math.round(t))
  return `${Math.floor(tt / 60)}:${String(tt % 60).padStart(2, '0')}`
}

/** «4,5» / «4.5» / «1:04,2» → секунды; мусор → null */
export function parseSec(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, '').replace(',', '.')
  if (!s) return null
  const mm = s.match(/^(\d+):(\d{1,2}(?:\.\d*)?)$/)
  if (mm) return Number(mm[1]) * 60 + Number(mm[2])
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} КБ`
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
}

export function shortName(name: string, max = 28): string {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '')
  return base.length > max ? `${base.slice(0, max - 1)}…` : base
}

/** Русское склонение: plural(3, ['клип', 'клипа', 'клипов']) */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

export function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return !!t.closest('input, textarea, select, button, [contenteditable="true"], [role="slider"], [role="tab"]')
}
