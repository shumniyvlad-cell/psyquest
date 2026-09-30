// Внутренние типы «Монтажной». Файлы живут только в памяти вкладки, в sessionStorage — лишь настройки.
import type { ThemeId } from '../../audio/themes'

/** Кадр 9:16. Внутреннее разрешение превью и экспорта. */
export const OUT_W = 720
export const OUT_H = 1280
export const FPS = 30

export const MAX_TOTAL_SEC = 90
export const MIN_CLIP_SEC = 0.5
export const STILL_MIN_SEC = 1
export const STILL_MAX_SEC = 15
export const HOOK_MIN_SEC = 1
export const HOOK_MAX_SEC = 10
export const DEFAULT_HOOK_SEC = 3

/** Интерфейс соцсети поверх ролика (доли кадра). */
export const SAFE_TOP = 0.12
export const SAFE_BOTTOM = 0.2
export const SAFE_RIGHT = 0.15
/** Колонка кнопок справа: от 40% до низа безопасной зоны. */
export const SAFE_RIGHT_FROM = 0.4

export type BgPreset = 'aurora' | 'night' | 'paper' | 'pulse'
export type TextStyleId = 'clean' | 'lantern' | 'ink' | 'notebook'
export type TextPos = 'top' | 'center' | 'bottom'
export type TextRole = 'hook' | 'caption'
/** Светлый текст на тёмном кадре или тёмный — на «бумаге». */
export type TextTone = 'light' | 'dark'
export type TabId = 'clips' | 'text' | 'music' | 'export'

export interface MediaItem {
  id: string
  kind: 'video' | 'image'
  name: string
  /** object URL — освобождается при удалении последнего клипа и при закрытии */
  url: string
  /** Размер исходника (для фото — после уменьшения) */
  width: number
  height: number
  /** Длительность видео, с; у фото 0 */
  duration: number
  /** Миниатюра 9:16 (data URL) */
  thumb: string
  /** Кадры по всей длине видео — для таймлайна и обрезки */
  filmstrip: string[]
  /** Декодированное фото, готовое для drawImage */
  bitmap?: CanvasImageSource
}

export interface VideoClip {
  id: string
  kind: 'video'
  mediaId: string
  in: number
  out: number
  /** 0..1 */
  volume: number
}

export interface ImageClip {
  id: string
  kind: 'image'
  mediaId: string
  duration: number
  kenBurns: boolean
}

export interface BgClip {
  id: string
  kind: 'bg'
  preset: BgPreset
  duration: number
  kenBurns: boolean
}

export type Clip = VideoClip | ImageClip | BgClip

export interface Caption {
  id: string
  text: string
  start: number
  end: number
}

export interface TextSettings {
  hook: string
  hookSec: number
  hookPos: TextPos
  captions: Caption[]
  capPos: TextPos
  style: TextStyleId
  safeZones: boolean
}

export type MusicChoice = 'none' | 'file' | ThemeId

export interface MusicSettings {
  choice: MusicChoice
  /** 0..1 */
  volume: number
}

export interface TimelineEntry {
  clip: Clip
  index: number
  start: number
  end: number
}

export interface Timeline {
  entries: TimelineEntry[]
  /** Сумма длительностей клипов (может быть больше лимита) */
  total: number
  /** То, что попадёт в ролик: min(total, лимит) */
  duration: number
}

export const DEFAULT_TEXT: TextSettings = {
  hook: '',
  hookSec: DEFAULT_HOOK_SEC,
  hookPos: 'center',
  captions: [],
  capPos: 'bottom',
  style: 'lantern',
  safeZones: false,
}

export const DEFAULT_MUSIC: MusicSettings = { choice: 'none', volume: 0.8 }
