// Настройки без файлов — в sessionStorage. Видео и фото сюда не попадают никогда.
import { REEL_TRACKS } from '../../audio/themes'
import {
  DEFAULT_MUSIC,
  DEFAULT_TEXT,
  HOOK_MAX_SEC,
  HOOK_MIN_SEC,
  MAX_TOTAL_SEC,
  STILL_MAX_SEC,
  STILL_MIN_SEC,
  type BgClip,
  type BgPreset,
  type Caption,
  type MusicSettings,
  type TabId,
  type TextPos,
  type TextSettings,
  type TextStyleId,
} from './types'
import { clamp, uid } from './util'

const KEY = 'psyquest.reelEditor.v1'

export interface Persisted {
  text: TextSettings
  /** Только «живые фоны» — у остальных клипов нет файла после перезагрузки */
  clips: BgClip[]
  music: MusicSettings
  tab: TabId
  monitor: boolean
}

const PRESETS: BgPreset[] = ['aurora', 'night', 'paper', 'pulse']
const STYLES: TextStyleId[] = ['clean', 'lantern', 'ink', 'notebook']
const POSITIONS: TextPos[] = ['top', 'center', 'bottom']
const TABS: TabId[] = ['clips', 'text', 'music', 'export']

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const num = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : dflt
const pick = <T extends string>(v: unknown, list: T[], dflt: T): T => (list.includes(v as T) ? (v as T) : dflt)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

function text(raw: unknown): TextSettings {
  if (!isObj(raw)) return DEFAULT_TEXT
  const caps: Caption[] = Array.isArray(raw.captions)
    ? raw.captions.filter(isObj).slice(0, 60).map((c) => {
        const start = num(c.start, 0, MAX_TOTAL_SEC, 0)
        return {
          id: typeof c.id === 'string' ? c.id : uid('cap'),
          text: str(c.text, 400),
          start,
          end: num(c.end, start + 0.3, MAX_TOTAL_SEC + 1, start + 2),
        }
      })
    : []
  return {
    hook: str(raw.hook, 300),
    hookSec: num(raw.hookSec, HOOK_MIN_SEC, HOOK_MAX_SEC, DEFAULT_TEXT.hookSec),
    hookPos: pick(raw.hookPos, POSITIONS, DEFAULT_TEXT.hookPos),
    captions: caps,
    capPos: pick(raw.capPos, POSITIONS, DEFAULT_TEXT.capPos),
    style: pick(raw.style, STYLES, DEFAULT_TEXT.style),
    safeZones: raw.safeZones === true,
  }
}

function clips(raw: unknown): BgClip[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(isObj)
    .filter((c) => c.kind === 'bg')
    .slice(0, 40)
    .map((c) => ({
      id: typeof c.id === 'string' ? c.id : uid('clip'),
      kind: 'bg' as const,
      preset: pick(c.preset, PRESETS, 'aurora'),
      duration: num(c.duration, STILL_MIN_SEC, STILL_MAX_SEC, 5),
      kenBurns: c.kenBurns === true,
    }))
}

function music(raw: unknown): MusicSettings {
  if (!isObj(raw)) return DEFAULT_MUSIC
  const ids = REEL_TRACKS.map((t) => t.id as string)
  const choice = typeof raw.choice === 'string' && ids.includes(raw.choice) ? (raw.choice as MusicSettings['choice']) : 'none'
  return { choice, volume: num(raw.volume, 0, 1, DEFAULT_MUSIC.volume) }
}

export function loadPersisted(): Persisted {
  let raw: unknown = null
  try {
    const s = sessionStorage.getItem(KEY)
    raw = s ? JSON.parse(s) : null
  } catch {
    raw = null
  }
  const o = isObj(raw) ? raw : {}
  return {
    text: text(o.text),
    clips: clips(o.clips),
    music: music(o.music),
    tab: pick(o.tab, TABS, 'clips'),
    monitor: o.monitor !== false,
  }
}

export function savePersisted(p: Persisted) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* приватный режим или переполнение — не критично */
  }
}
