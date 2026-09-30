// Импорт файлов с устройства. Ничего не загружается в сеть: только object URL и декодирование в памяти.
import { MAX_TOTAL_SEC, OUT_H, OUT_W, type MediaItem } from './types'
import { clamp, shortName, uid } from './util'

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|ogv|mkv|3gp)$/i
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp)$/i
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i

export type FileKind = 'video' | 'image' | 'audio'

export function kindOf(file: File): FileKind | null {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (VIDEO_EXT.test(file.name)) return 'video'
  if (IMAGE_EXT.test(file.name)) return 'image'
  if (AUDIO_EXT.test(file.name)) return 'audio'
  return null
}

export class MediaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaError'
  }
}

function once(el: HTMLMediaElement, ok: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      cleanup()
      resolve()
    }
    const fail = () => {
      cleanup()
      reject(new MediaError('error'))
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new MediaError('timeout'))
    }, ms)
    const cleanup = () => {
      clearTimeout(timer)
      el.removeEventListener(ok, done)
      el.removeEventListener('error', fail)
    }
    el.addEventListener(ok, done, { once: true })
    el.addEventListener('error', fail, { once: true })
  })
}

async function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  if (Math.abs(v.currentTime - t) < 0.01 && v.readyState >= 2) return
  const p = once(v, 'seeked', 5000)
  v.currentTime = t
  await p
  if (v.readyState < 2) await once(v, 'loadeddata', 2000).catch(() => {})
}

/** Кадр в миниатюру 9:16 (cover). */
function grab(src: CanvasImageSource, sw: number, sh: number, w: number, h: number): string {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')
  if (!x || !sw || !sh) return ''
  x.imageSmoothingQuality = 'high'
  const s = Math.max(w / sw, h / sh)
  x.drawImage(src, (w - sw * s) / 2, (h - sh * s) / 2, sw * s, sh * s)
  try {
    return c.toDataURL('image/jpeg', 0.74)
  } catch {
    return ''
  }
}

async function probeVideo(file: File, url: string): Promise<MediaItem> {
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  v.src = url
  try {
    try {
      await once(v, 'loadedmetadata', 15000)
    } catch {
      throw new MediaError(
        `Браузер не смог открыть «${shortName(file.name)}». Подойдёт MP4 (H.264) — так снимает большинство телефонов.`,
      )
    }
    let duration = v.duration
    if (!Number.isFinite(duration) || duration <= 0) {
      // у записанных в браузере WebM длительность неизвестна, пока не «прыгнешь» в конец
      const p = once(v, 'durationchange', 6000).catch(() => {})
      v.currentTime = 1e7
      await p
      duration = v.duration
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new MediaError(`Не удалось определить длительность «${shortName(file.name)}».`)
    }
    const w = v.videoWidth
    const h = v.videoHeight
    if (!w || !h) throw new MediaError(`В «${shortName(file.name)}» нет видеодорожки.`)
    const last = Math.max(0, duration - 0.08)
    let thumb = ''
    const filmstrip: string[] = []
    try {
      await seekTo(v, clamp(Math.min(0.6, duration * 0.3), 0, last))
      thumb = grab(v, w, h, 108, 192)
      for (const k of [0.08, 0.3, 0.52, 0.74, 0.94]) {
        await seekTo(v, clamp(duration * k, 0, last))
        filmstrip.push(grab(v, w, h, 54, 96))
      }
    } catch {
      /* без миниатюр видео всё равно работает */
    }
    return {
      id: uid('media'),
      kind: 'video',
      name: file.name,
      url,
      width: w,
      height: h,
      duration,
      thumb: thumb || filmstrip[0] || '',
      filmstrip: filmstrip.filter(Boolean),
    }
  } finally {
    v.removeAttribute('src')
    try {
      v.load()
    } catch {
      /* ignore */
    }
  }
}

async function loadImage(file: File, url: string): Promise<MediaItem> {
  const img = new Image()
  img.decoding = 'async'
  const bad = () => new MediaError(`Не удалось открыть фото «${shortName(file.name)}». Подойдут JPG, PNG или WebP.`)
  // decode() не завершается, пока вкладка не рисует кадры (например, сразу после выбора файла на телефоне),
  // поэтому ждём load, а decode — только как ускорение с тайм-аутом
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(bad())
    img.src = url
  })
  try {
    await Promise.race([img.decode(), new Promise((r) => setTimeout(r, 1200))])
  } catch {
    if (!img.naturalWidth) throw bad()
  }
  let w = img.naturalWidth
  let h = img.naturalHeight
  if (!w || !h) throw new MediaError(`Фото «${shortName(file.name)}» пустое.`)
  let bitmap: CanvasImageSource = img
  // храним ровно столько пикселей, сколько нужно кадру с запасом под зум
  const need = Math.max(OUT_W / w, OUT_H / h) * 1.18
  if (need < 1) {
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(w * need))
    c.height = Math.max(1, Math.round(h * need))
    const x = c.getContext('2d')
    if (x) {
      x.imageSmoothingQuality = 'high'
      x.drawImage(img, 0, 0, c.width, c.height)
      bitmap = c
      w = c.width
      h = c.height
    }
  }
  return {
    id: uid('media'),
    kind: 'image',
    name: file.name,
    url,
    width: w,
    height: h,
    duration: 0,
    thumb: grab(bitmap, w, h, 108, 192),
    filmstrip: [],
    bitmap,
  }
}

export async function importMedia(file: File): Promise<MediaItem> {
  const kind = kindOf(file)
  if (kind !== 'video' && kind !== 'image') {
    throw new MediaError(`«${shortName(file.name)}» — не видео и не фото.`)
  }
  const url = URL.createObjectURL(file)
  try {
    return kind === 'video' ? await probeVideo(file, url) : await loadImage(file, url)
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e instanceof MediaError ? e : new MediaError(`Не удалось открыть «${shortName(file.name)}».`)
  }
}

const MAX_AUDIO_BYTES = 80 * 1024 * 1024

/** Декодирует свой трек; хвост длиннее ролика отрезаем, чтобы не держать лишнее в памяти. */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  if (file.size > MAX_AUDIO_BYTES) throw new MediaError('Аудиофайл слишком большой — выберите файл до 80 МБ.')
  const OAC =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
  if (!OAC) throw new MediaError('Браузер не умеет работать со звуком.')
  let buf: AudioBuffer
  try {
    const data = await file.arrayBuffer()
    buf = await new OAC(2, 1, 48000).decodeAudioData(data)
  } catch {
    throw new MediaError('Не удалось прочитать аудио. Подойдут MP3, M4A, WAV или OGG.')
  }
  const keep = MAX_TOTAL_SEC + 2
  if (buf.duration <= keep + 1) return buf
  try {
    const len = Math.floor(keep * buf.sampleRate)
    const out = new AudioBuffer({ length: len, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate })
    for (let ch = 0; ch < buf.numberOfChannels; ch++) out.copyToChannel(buf.getChannelData(ch).subarray(0, len), ch)
    return out
  } catch {
    return buf
  }
}
