// Перенос строк для canvas: measureText, без висячих предлогов, с балансировкой строк.

export interface FitOptions {
  family: string
  weight: number
  maxSize: number
  minSize: number
  maxWidth: number
  maxLines: number
  /** Межстрочный интервал как множитель кегля */
  lineHeight: number
  balance?: boolean
}

export interface TextLayout {
  lines: string[]
  widths: number[]
  size: number
  font: string
  /** Шаг строки, px */
  lineGap: number
  width: number
  height: number
  /** Высота прописной — для точного вертикального центрирования */
  capHeight: number
}

/** Абсолютный предел строк, чтобы очень длинный текст не вылез за кадр */
const HARD_MAX_LINES = 9

export const fontString = (weight: number, size: number, family: string) => `${weight} ${Math.round(size)}px ${family}`

// Короткие слова (предлоги, союзы) приклеиваются к следующему слову,
// частицы «же/ли/бы» и тире — к предыдущему.
const SHORT_WORD = /^[«"„(“]*[a-zа-яё]{1,2}[,.:;!?»")”]*$/i
const TRAILING = /^(?:[—–-]|(?:же|ли|ль|бы|б|ж)[,.:;!?…»")”]*)$/i

export function tokenize(paragraph: string): string[] {
  const words = paragraph.split(/\s+/).filter(Boolean)
  const units: string[] = []
  let carry = ''
  for (const w of words) {
    if (TRAILING.test(w)) {
      if (carry) {
        carry = `${carry} ${w}`
        continue
      }
      if (units.length) {
        units[units.length - 1] += ` ${w}`
        continue
      }
    }
    const word = carry ? `${carry} ${w}` : w
    carry = ''
    if (SHORT_WORD.test(w) && !/[,.:;!?…]$/.test(w)) {
      carry = word
      continue
    }
    units.push(word)
  }
  if (carry) {
    if (units.length) units[units.length - 1] += ` ${carry}`
    else units.push(carry)
  }
  return units
}

function measure(ctx: CanvasRenderingContext2D, s: string): number {
  return ctx.measureText(s).width
}

/** Слишком длинный кусок: сначала по пробелам внутри, потом по буквам. */
function breakLong(ctx: CanvasRenderingContext2D, unit: string, maxWidth: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of unit.split(' ')) {
    const cand = line ? `${line} ${word}` : word
    if (measure(ctx, cand) <= maxWidth) {
      line = cand
      continue
    }
    if (line) {
      out.push(line)
      line = ''
    }
    if (measure(ctx, word) <= maxWidth) {
      line = word
      continue
    }
    let chunk = ''
    for (const ch of Array.from(word)) {
      if (chunk && measure(ctx, chunk + ch) > maxWidth) {
        out.push(chunk)
        chunk = ch
      } else chunk += ch
    }
    line = chunk
  }
  if (line) out.push(line)
  return out
}

/** Жадный перенос по ширине. ctx.font должен быть уже выставлен. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  const paragraphs = text.replace(/\r/g, '').split('\n')
  for (const para of paragraphs) {
    const units = tokenize(para)
    if (!units.length) {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('')
      continue
    }
    let line = ''
    for (const u of units) {
      const cand = line ? `${line} ${u}` : u
      if (measure(ctx, cand) <= maxWidth) {
        line = cand
        continue
      }
      if (line) lines.push(line)
      if (measure(ctx, u) <= maxWidth) {
        line = u
      } else {
        const parts = breakLong(ctx, u, maxWidth)
        lines.push(...parts.slice(0, -1))
        line = parts[parts.length - 1] ?? ''
      }
    }
    if (line) lines.push(line)
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  while (lines.length && lines[0] === '') lines.shift()
  return lines
}

/** Самая узкая ширина с тем же числом строк — строки выходят ровнее. */
function balance(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, count: number): string[] {
  let lo = maxWidth * 0.4
  let hi = maxWidth
  let best = wrap(ctx, text, maxWidth)
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2
    const l = wrap(ctx, text, mid)
    if (l.length <= count) {
      best = l
      hi = mid
    } else lo = mid
  }
  return best
}

export function fitText(ctx: CanvasRenderingContext2D, text: string, o: FitOptions): TextLayout {
  let size = o.maxSize
  let lines: string[] = []
  let font = fontString(o.weight, size, o.family)
  for (; size >= o.minSize; size -= 2) {
    font = fontString(o.weight, size, o.family)
    ctx.font = font
    lines = wrap(ctx, text, o.maxWidth)
    if (lines.length <= o.maxLines) break
  }
  if (size < o.minSize) {
    size = o.minSize
    font = fontString(o.weight, size, o.family)
    ctx.font = font
    lines = wrap(ctx, text, o.maxWidth)
  }
  if (lines.length > HARD_MAX_LINES) {
    lines = lines.slice(0, HARD_MAX_LINES)
    let last = lines[HARD_MAX_LINES - 1].replace(/[\s,.;:—–-]+$/, '')
    while (last && measure(ctx, `${last}…`) > o.maxWidth) last = last.slice(0, -1)
    lines[HARD_MAX_LINES - 1] = `${last}…`
  } else if (o.balance && lines.length > 1 && !text.includes('\n')) {
    lines = balance(ctx, text, o.maxWidth, lines.length)
  }
  const widths = lines.map((l) => measure(ctx, l))
  const cap = ctx.measureText('НЖ').actualBoundingBoxAscent
  const capHeight = Number.isFinite(cap) && cap > 0 ? cap : size * 0.7
  const lineGap = size * o.lineHeight
  return {
    lines,
    widths,
    size,
    font,
    lineGap,
    width: Math.max(0, ...widths),
    height: lines.length * lineGap,
    capHeight,
  }
}
