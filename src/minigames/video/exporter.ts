// Экспорт ролика в реальном времени: canvas.captureStream + звук из аудиографа → MediaRecorder.
import type { ReelEngine } from './engine'
import { FPS } from './types'

export const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

const VIDEO_BPS = 6_000_000
const AUDIO_BPS = 128_000

export type ExportExt = 'mp4' | 'webm'
export type SupportProblem = 'recorder' | 'capture' | 'format'

export interface ExportSupport {
  ok: boolean
  /** Поддерживаемые форматы в порядке предпочтения ('' — формат по умолчанию браузера) */
  mimes: string[]
  ext: ExportExt | null
  problem: SupportProblem | null
}

export const extOf = (mime: string): ExportExt => (/mp4/i.test(mime) ? 'mp4' : 'webm')

export function detectSupport(): ExportSupport {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { ok: false, mimes: [], ext: null, problem: 'recorder' }
  }
  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    return { ok: false, mimes: [], ext: null, problem: 'capture' }
  }
  if (typeof MediaRecorder.isTypeSupported !== 'function') {
    return { ok: true, mimes: [''], ext: null, problem: null }
  }
  const mimes = MIME_CANDIDATES.filter((m) => {
    try {
      return MediaRecorder.isTypeSupported(m)
    } catch {
      return false
    }
  })
  if (!mimes.length) return { ok: false, mimes: [], ext: null, problem: 'format' }
  return { ok: true, mimes, ext: extOf(mimes[0]), problem: null }
}

export class ExportAbort extends Error {
  constructor() {
    super('Запись остановлена')
    this.name = 'ExportAbort'
  }
}

export class ExportFailure extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportFailure'
  }
}

export type RecordPhase = 'recording' | 'paused' | 'finishing'

export interface RecordOptions {
  /** Слышать звук в колонках во время записи */
  monitor: boolean
  signal: AbortSignal
  onPhase: (p: RecordPhase) => void
}

export interface RecordResult {
  blob: Blob
  mime: string
  ext: ExportExt
  durationSec: number
}

/** Пишет ролик; если кодек отказал, пробует следующий формат из списка. */
export async function recordReel(engine: ReelEngine, o: RecordOptions): Promise<RecordResult> {
  const sup = detectSupport()
  if (!sup.ok) throw new ExportFailure(supportMessage(sup.problem))
  let last: unknown = null
  for (const mime of sup.mimes) {
    if (o.signal.aborted) throw new ExportAbort()
    try {
      return await recordWith(engine, mime, o)
    } catch (e) {
      if (e instanceof ExportAbort) throw e
      last = e
    }
  }
  throw last instanceof Error ? last : new ExportFailure('Не получилось записать ролик')
}

async function recordWith(engine: ReelEngine, mime: string, o: RecordOptions): Promise<RecordResult> {
  await engine.prepareExport()
  // отмену могли нажать, пока готовился первый кадр — слушатель abort ещё не висел
  if (o.signal.aborted) {
    engine.endExport()
    throw new ExportAbort()
  }
  const durationSec = engine.duration
  const canvasStream = engine.canvas.captureStream(FPS)
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()]
  const audio = engine.audioStream()
  if (audio) tracks.push(...audio.getAudioTracks())
  const stream = new MediaStream(tracks)

  let rec: MediaRecorder
  try {
    rec = new MediaRecorder(stream, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: VIDEO_BPS,
      audioBitsPerSecond: AUDIO_BPS,
    })
  } catch (e) {
    canvasStream.getTracks().forEach((t) => t.stop())
    engine.endExport()
    throw e
  }

  engine.setMonitor(o.monitor)
  const chunks: Blob[] = []
  let cancelled = false
  let failed: unknown = null
  let watchdog = 0
  let finishTimer = 0

  const onVisibility = () => {
    if (rec.state === 'inactive') return
    // скрытая вкладка не рисует кадры — ставим запись на паузу, чтобы в файле не было «замёрзших» секунд
    if (document.hidden) {
      if (rec.state === 'recording') {
        engine.pause()
        try {
          rec.pause()
        } catch {
          /* ignore */
        }
        o.onPhase('paused')
      }
    } else if (rec.state === 'paused') {
      try {
        rec.resume()
      } catch {
        /* ignore */
      }
      engine.play()
      o.onPhase('recording')
    }
  }

  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const stop = () => {
        engine.pause()
        if (rec.state !== 'inactive') {
          try {
            rec.stop()
          } catch (e) {
            reject(e)
          }
        }
      }
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data)
      }
      rec.onerror = (ev) => {
        const err = (ev as unknown as { error?: unknown }).error
        failed = err ?? new ExportFailure('Кодировщик браузера остановился')
        stop()
      }
      rec.onstop = () => {
        if (cancelled) return reject(new ExportAbort())
        if (failed) return reject(failed)
        const type = (rec.mimeType || mime || 'video/webm').split(';')[0]
        const out = new Blob(chunks, { type })
        if (out.size < 2048) return reject(new ExportFailure('Файл получился пустым'))
        resolve(out)
      }
      o.signal.addEventListener(
        'abort',
        () => {
          cancelled = true
          stop()
        },
        { once: true },
      )
      engine.onEnded = () => {
        o.onPhase('finishing')
        // даём кодировщику забрать последние кадры
        finishTimer = window.setTimeout(stop, 120)
      }
      if (o.signal.aborted) {
        cancelled = true
        reject(new ExportAbort())
        return
      }
      document.addEventListener('visibilitychange', onVisibility)
      // формат «поддерживается», но данных нет — пробуем следующий
      watchdog = window.setTimeout(() => {
        if (!chunks.length && rec.state === 'recording' && !cancelled) {
          failed = new ExportFailure('Браузер не отдал ни одного кадра')
          stop()
        }
      }, 4000)
      try {
        rec.start(1000)
      } catch (e) {
        reject(e)
        return
      }
      o.onPhase('recording')
      engine.play()
    })
    const type = blob.type || mime
    return { blob, mime: type, ext: extOf(type), durationSec }
  } finally {
    clearTimeout(watchdog)
    clearTimeout(finishTimer)
    document.removeEventListener('visibilitychange', onVisibility)
    engine.onEnded = null
    canvasStream.getTracks().forEach((t) => t.stop())
    engine.endExport()
  }
}

export function supportMessage(p: SupportProblem | null): string {
  switch (p) {
    case 'recorder':
      return 'Этот браузер не умеет записывать видео со страницы. Обновите его или откройте игру в свежем Chrome, Edge или Safari.'
    case 'capture':
      return 'Браузер не даёт записать картинку из превью. Обновите его или откройте игру в свежем Chrome или Edge.'
    case 'format':
      return 'Браузер не знает ни одного подходящего видеоформата. Откройте игру в свежем Chrome или Edge — они записывают MP4.'
    default:
      return 'Не получилось записать ролик.'
  }
}

export function reelFileName(ext: ExportExt, d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `psyquest-reel-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.${ext}`
}

export function triggerDownload(url: string, fileName: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// ---------- WebM без длительности ----------
// MediaRecorder пишет WebM «потоком» — без Duration в заголовке, и плееры не видят длину.
// Дописываем Duration в Segment/Info. Любое отклонение от ожидаемой структуры — файл как есть.

const ID_EBML = 0x1a45dfa3
const ID_SEGMENT = 0x18538067
const ID_INFO = 0x1549a966
const ID_SEEKHEAD = 0x114d9b74
const ID_CLUSTER = 0x1f43b675
const ID_TIMESCALE = 0x2ad7b1
const ID_DURATION = 0x4489

interface Vint {
  len: number
  value: number
  unknown: boolean
}

function vintLen(first: number): number {
  let len = 1
  let mask = 0x80
  while (len <= 8 && !(first & mask)) {
    len++
    mask >>= 1
  }
  return len
}

function readId(b: Uint8Array, pos: number): { id: number; len: number } | null {
  if (pos >= b.length) return null
  const len = vintLen(b[pos])
  if (len > 4 || pos + len > b.length) return null
  let id = 0
  for (let i = 0; i < len; i++) id = id * 256 + b[pos + i]
  return { id, len }
}

function readSize(b: Uint8Array, pos: number): Vint | null {
  if (pos >= b.length) return null
  const len = vintLen(b[pos])
  if (len > 8 || pos + len > b.length) return null
  const mask = 0xff >> len
  let value = b[pos] & mask
  let allOnes = value === mask
  for (let i = 1; i < len; i++) {
    value = value * 256 + b[pos + i]
    if (b[pos + i] !== 0xff) allOnes = false
  }
  return { len, value, unknown: allOnes }
}

function encodeSize(value: number, len: number): Uint8Array | null {
  if (value >= Math.pow(2, 7 * len) - 1) return null
  const out = new Uint8Array(len)
  let v = value
  for (let i = len - 1; i >= 0; i--) {
    out[i] = v % 256
    v = Math.floor(v / 256)
  }
  out[0] |= 1 << (8 - len)
  return out
}

function readUint(b: Uint8Array, pos: number, len: number): number {
  let v = 0
  for (let i = 0; i < len; i++) v = v * 256 + b[pos + i]
  return v
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

export async function fixWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  try {
    const headLen = Math.min(blob.size, 256 * 1024)
    const head = new Uint8Array(await blob.slice(0, headLen).arrayBuffer())
    const ebml = readId(head, 0)
    if (!ebml || ebml.id !== ID_EBML) return blob
    const ebmlSize = readSize(head, ebml.len)
    if (!ebmlSize || ebmlSize.unknown) return blob
    const segPos = ebml.len + ebmlSize.len + ebmlSize.value
    const seg = readId(head, segPos)
    if (!seg || seg.id !== ID_SEGMENT) return blob
    const segSize = readSize(head, segPos + seg.len)
    // у сегмента известной длины обычно есть SeekHead/Cues со смещениями — не трогаем
    if (!segSize || !segSize.unknown) return blob
    let p = segPos + seg.len + segSize.len
    while (p < head.length) {
      const id = readId(head, p)
      const sz = id ? readSize(head, p + id.len) : null
      if (!id || !sz) return blob
      if (id.id === ID_SEEKHEAD || id.id === ID_CLUSTER) return blob
      if (id.id !== ID_INFO) {
        if (sz.unknown) return blob
        p += id.len + sz.len + sz.value
        continue
      }
      if (sz.unknown) return blob
      const dataStart = p + id.len + sz.len
      const dataEnd = dataStart + sz.value
      if (dataEnd > head.length) return blob
      let q = dataStart
      let scale = 1_000_000
      let durPos = -1
      let durLen = 0
      while (q < dataEnd) {
        const cid = readId(head, q)
        const cs = cid ? readSize(head, q + cid.len) : null
        if (!cid || !cs || cs.unknown) return blob
        const at = q + cid.len + cs.len
        if (cid.id === ID_TIMESCALE && cs.len > 0 && cs.value <= 8) scale = readUint(head, at, cs.value) || scale
        if (cid.id === ID_DURATION) {
          durPos = at
          durLen = cs.value
        }
        q = at + cs.value
      }
      const value = (durationMs * 1_000_000) / scale
      if (durPos >= 0) {
        const out = head.slice()
        const dv = new DataView(out.buffer)
        if (durLen === 8) dv.setFloat64(durPos, value)
        else if (durLen === 4) dv.setFloat32(durPos, value)
        else return blob
        return new Blob([out, blob.slice(headLen)], { type: blob.type })
      }
      const durEl = new Uint8Array(11)
      durEl[0] = 0x44
      durEl[1] = 0x89
      durEl[2] = 0x88
      new DataView(durEl.buffer).setFloat64(3, value)
      const newLen = sz.value + durEl.length
      const sizeBytes = encodeSize(newLen, sz.len) ?? encodeSize(newLen, 8)
      if (!sizeBytes) return blob
      const out = concat([
        head.subarray(0, p + id.len),
        sizeBytes,
        head.subarray(dataStart, dataEnd),
        durEl,
        head.subarray(dataEnd),
      ])
      return new Blob([out, blob.slice(headLen)], { type: blob.type })
    }
    return blob
  } catch {
    return blob
  }
}
