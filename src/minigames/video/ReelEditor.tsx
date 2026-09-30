// «Монтажная» — редактор вертикальных роликов 9:16 прямо в браузере.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type JSX,
  type KeyboardEvent,
} from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { Clapperboard, Download, Film, Music, Type, Upload, X } from 'lucide-react'
import { Button } from '../../ui/Button'
import { currentTheme, isAudioReady, playTheme, sfx, stopMusic } from '../../audio/engine'
import { REEL_TRACKS, type ThemeId } from '../../audio/themes'
import type { ReelExport, ReelScript } from '../../game/types'
import { ClipsPanel, type ClipPatch } from './ClipsPanel'
import { ConfirmDialog } from './controls'
import { ExportPanel, type ExportPhase, type ExportResultInfo } from './ExportPanel'
import { MusicPanel, type TrackStatus } from './MusicPanel'
import { Stage } from './Stage'
import { TextPanel } from './TextPanel'
import { ReelEngine } from './engine'
import {
  ExportAbort,
  ExportFailure,
  detectSupport,
  fixWebmDuration,
  recordReel,
  reelFileName,
  triggerDownload,
} from './exporter'
import { prefersReducedMotion } from './hooks'
import { MediaError, decodeAudioFile, importMedia, kindOf } from './media'
import { clearTextCache, loadCanvasFonts } from './overlay'
import { backgroundsFor, buildFromScript } from './script'
import { loadPersisted, savePersisted } from './storage'
import { cachedTrack, getTrack, trackLength } from './tracks'
import {
  DEFAULT_HOOK_SEC,
  MAX_TOTAL_SEC,
  MIN_CLIP_SEC,
  STILL_MAX_SEC,
  STILL_MIN_SEC,
  type BgClip,
  type BgPreset,
  type Clip,
  type MediaItem,
  type MusicChoice,
  type MusicSettings,
  type TabId,
  type TextSettings,
} from './types'
import { buildTimeline, clamp, fmtSec, fmtTime, isEditableTarget, round1, shortName, uid } from './util'
import './video.css'

export interface ReelEditorProps {
  /** Сценарии из главы «Студия Эха» (может быть пусто) */
  scripts: ReelScript[]
  /** Набор Мастера: без водяного знака и PRO-треки */
  pro: boolean
  /** После успешного экспорта и скачивания */
  onExported: (info: ReelExport) => void
  onClose: () => void
  /** Клик по PRO-фиче без pro */
  onNeedPro?: () => void
}

interface Notice {
  id: string
  kind: 'info' | 'error'
  text: string
  action?: { label: string; run: () => void }
}

const TABS: { id: TabId; label: string; Icon: typeof Film }[] = [
  { id: 'clips', label: 'Клипы', Icon: Film },
  { id: 'text', label: 'Текст', Icon: Type },
  { id: 'music', label: 'Музыка', Icon: Music },
  { id: 'export', label: 'Экспорт', Icon: Download },
]

const TRACK_IDS = new Set<string>(REEL_TRACKS.map((t) => t.id))
const isTrack = (c: MusicChoice): c is ThemeId => TRACK_IDS.has(c)

function clipFor(m: MediaItem, id: string, total: number): { clip: Clip; trimmed: boolean } {
  const budget = MAX_TOTAL_SEC - total
  if (m.kind === 'video') {
    const D = m.duration >= 0.2 ? Math.floor(m.duration * 10) / 10 : m.duration
    const want = budget >= MIN_CLIP_SEC ? Math.min(D, round1(budget)) : Math.min(D, 5)
    const out = Math.min(D, Math.max(Math.min(D, MIN_CLIP_SEC), want))
    return { clip: { id, kind: 'video', mediaId: m.id, in: 0, out, volume: 1 }, trimmed: out < D - 0.05 }
  }
  const d = clamp(budget >= STILL_MIN_SEC ? Math.min(4, round1(budget)) : 4, STILL_MIN_SEC, STILL_MAX_SEC)
  return { clip: { id, kind: 'image', mediaId: m.id, duration: d, kenBurns: true }, trimmed: false }
}

function describeError(e: unknown): string {
  if (e instanceof ExportFailure || e instanceof MediaError) return e.message
  if (e instanceof DOMException && e.name === 'NotSupportedError') {
    return 'Браузер не поддерживает запись в этом формате. Откройте игру в свежем Chrome или Edge.'
  }
  return 'Не получилось записать ролик. Попробуйте ещё раз — или откройте игру в свежем Chrome или Edge.'
}

export function ReelEditor({ scripts, pro, onExported, onClose, onNeedPro }: ReelEditorProps): JSX.Element {
  const [initial] = useState(loadPersisted)
  const [clips, setClipsState] = useState<Clip[]>(initial.clips)
  // зеркало для последовательных операций (импорт нескольких файлов подряд) — всегда свежее
  const clipsRef = useRef<Clip[]>(initial.clips)
  const setClips = useCallback((next: Clip[] | ((cs: Clip[]) => Clip[])) => {
    const value = typeof next === 'function' ? next(clipsRef.current) : next
    clipsRef.current = value
    setClipsState(value)
  }, [])
  const [media, setMedia] = useState<Record<string, MediaItem>>({})
  const [text, setText] = useState<TextSettings>(initial.text)
  const [music, setMusic] = useState<MusicSettings>(initial.music)
  const [musicFile, setMusicFile] = useState<{ name: string; buffer: AudioBuffer } | null>(null)
  const [musicBusy, setMusicBusy] = useState(false)
  const [trackStatus, setTrackStatus] = useState<TrackStatus | null>(null)
  const [tab, setTab] = useState<TabId>(initial.tab)
  const [selected, setSelected] = useState<string | null>(null)
  const [monitor, setMonitor] = useState(initial.monitor)
  const [engine, setEngine] = useState<ReelEngine | null>(null)
  const [engineError, setEngineError] = useState(false)
  const [importing, setImporting] = useState<{ id: string; name: string }[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)
  const [undo, setUndo] = useState<{ clip: Clip; index: number } | null>(null)
  const [phase, setPhase] = useState<ExportPhase>('idle')
  const [prepLabel, setPrepLabel] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)
  const [result, setResult] = useState<ExportResultInfo | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [reduced] = useState(prefersReducedMotion)

  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const sideRef = useRef<HTMLElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})
  const aliveRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  const mediaRef = useRef(media)
  const pendingSeek = useRef<{ clipId: string; edge: 'start' | 'end' } | null>(null)
  const pausedTheme = useRef<ThemeId | null>(null)
  const bufferIdRef = useRef<string | null>(null)
  const onExportedRef = useRef(onExported)
  const onNeedProRef = useRef(onNeedPro)

  const timeline = useMemo(() => buildTimeline(clips), [clips])
  const support = useMemo(detectSupport, [])
  const busy = phase !== 'idle'
  const hasFiles = clips.some((c) => c.kind !== 'bg')
  const tLen = trackLength(timeline.duration)

  useEffect(() => {
    onExportedRef.current = onExported
    onNeedProRef.current = onNeedPro
  })

  useEffect(() => {
    mediaRef.current = media
  }, [media])

  // ---------- Жизненный цикл ----------

  useEffect(() => {
    aliveRef.current = true
    rootRef.current?.focus({ preventScroll: true })
    return () => {
      aliveRef.current = false
      abortRef.current?.abort()
      for (const m of Object.values(mediaRef.current)) URL.revokeObjectURL(m.url)
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
      // вернуть музыку игры, если её никто не сменил
      const th = pausedTheme.current
      if (th && isAudioReady() && currentTheme() === null) playTheme(th)
    }
  }, [])

  useEffect(() => {
    const c = canvasRef.current
    const h = hostRef.current
    if (!c || !h) return
    let e: ReelEngine
    try {
      e = new ReelEngine(c, h)
    } catch {
      setEngineError(true)
      return
    }
    setEngine(e)
    // для отладки в dev: window.__reelEngine
    const dbg = window as unknown as { __reelEngine?: ReelEngine }
    if (import.meta.env.DEV) dbg.__reelEngine = e
    return () => {
      e.destroy()
      if (import.meta.env.DEV && dbg.__reelEngine === e) delete dbg.__reelEngine
      setEngine(null)
    }
  }, [])

  useEffect(() => {
    if (!engine) return
    let alive = true
    const refresh = () => {
      if (!alive) return
      clearTextCache()
      engine.requestDraw()
    }
    loadCanvasFonts().then(refresh)
    const fonts = document.fonts
    fonts?.addEventListener?.('loadingdone', refresh)
    return () => {
      alive = false
      fonts?.removeEventListener?.('loadingdone', refresh)
    }
  }, [engine])

  // ---------- Проект → движок ----------

  useEffect(() => {
    if (!engine) return
    engine.setProject({ clips, media, text, watermark: !pro })
    const ps = pendingSeek.current
    pendingSeek.current = null
    if (ps && !engine.isPlaying && !engine.isExporting) {
      const e = timeline.entries.find((x) => x.clip.id === ps.clipId)
      if (e) {
        const end = Math.min(e.end, timeline.duration)
        engine.seek(ps.edge === 'start' ? e.start : Math.max(e.start, end - 0.05))
      }
    }
  }, [engine, clips, media, text, pro, timeline])

  useEffect(() => {
    engine?.setMusicVolume(music.volume)
  }, [engine, music.volume])

  useEffect(() => {
    if (!engine) return
    const choice = music.choice
    if (choice === 'none' || !isTrack(choice)) {
      bufferIdRef.current = choice
      engine.setMusic(choice === 'file' ? (musicFile?.buffer ?? null) : null)
      setTrackStatus(null)
      return
    }
    // другой трек — старый сразу замолкает; тот же трек другой длины играет, пока готовится новый
    if (bufferIdRef.current !== choice) engine.setMusic(null)
    const ready = cachedTrack(choice, tLen)
    if (ready) {
      bufferIdRef.current = choice
      engine.setMusic(ready)
      setTrackStatus({ id: choice, state: 'ready' })
      return
    }
    let alive = true
    setTrackStatus({ id: choice, state: 'loading' })
    const timer = setTimeout(() => {
      getTrack(choice, tLen).then(
        (buf) => {
          if (!alive) return
          bufferIdRef.current = choice
          engine.setMusic(buf)
          setTrackStatus({ id: choice, state: 'ready' })
        },
        () => {
          if (alive) setTrackStatus({ id: choice, state: 'error' })
        },
      )
    }, 180)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [engine, music.choice, musicFile, tLen])

  // PRO-трек без Набора Мастера не остаётся выбранным
  useEffect(() => {
    if (pro) return
    if (REEL_TRACKS.find((t) => t.id === music.choice)?.pro) setMusic((m) => ({ ...m, choice: 'none' }))
  }, [pro, music.choice])

  // ---------- Сохранение настроек ----------

  useEffect(() => {
    const id = setTimeout(() => {
      savePersisted({
        text,
        clips: clips.filter((c): c is BgClip => c.kind === 'bg'),
        music: { ...music, choice: music.choice === 'file' ? 'none' : music.choice },
        tab,
        monitor,
      })
    }, 300)
    return () => clearTimeout(id)
  }, [text, clips, music, tab, monitor])

  // ---------- Уведомления и «Вернуть» ----------

  const notify = useCallback((n: Omit<Notice, 'id'>) => setNotice({ ...n, id: uid('n') }), [])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), notice.kind === 'error' ? 7000 : notice.action ? 6500 : 4500)
    return () => clearTimeout(id)
  }, [notice])

  useEffect(() => {
    if (!undo) return
    const id = setTimeout(() => setUndo(null), 6500)
    return () => clearTimeout(id)
  }, [undo])

  // файлы без клипов освобождаем сразу (кроме того, что можно вернуть)
  useEffect(() => {
    const used = new Set<string>()
    for (const c of clips) if (c.kind !== 'bg') used.add(c.mediaId)
    if (undo && undo.clip.kind !== 'bg') used.add(undo.clip.mediaId)
    const orphans = Object.values(media).filter((m) => !used.has(m.id))
    if (!orphans.length) return
    for (const m of orphans) URL.revokeObjectURL(m.url)
    setMedia((prev) => {
      const next = { ...prev }
      for (const m of orphans) delete next[m.id]
      return next
    })
  }, [clips, media, undo])

  // ---------- Музыка игры ----------

  const quietGame = useCallback(() => {
    if (pausedTheme.current || !isAudioReady()) return
    const cur = currentTheme()
    if (cur) {
      pausedTheme.current = cur
      stopMusic(0.6)
    }
  }, [])

  // ---------- Воспроизведение ----------

  const togglePlay = useCallback(() => {
    if (!engine || engine.isExporting) return
    if (!engine.isPlaying) quietGame()
    engine.toggle()
  }, [engine, quietGame])

  const previewAt = useCallback(
    (t: number) => {
      if (!engine || engine.isPlaying || engine.isExporting) return
      engine.seek(clamp(t, 0, Math.max(0, timeline.duration - 0.05)))
    },
    [engine, timeline.duration],
  )

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (confirmClose || isEditableTarget(e.target)) return
      e.preventDefault()
      togglePlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, confirmClose])

  // ---------- Импорт ----------

  const loadAudioFile = useCallback(
    async (f: File) => {
      setMusicBusy(true)
      try {
        const buffer = await decodeAudioFile(f)
        if (!aliveRef.current) return
        setMusicFile({ name: f.name, buffer })
        setMusic((m) => ({ ...m, choice: 'file' }))
        sfx('drop')
      } catch (e) {
        if (!aliveRef.current) return
        notify({ kind: 'error', text: e instanceof MediaError ? e.message : 'Не удалось прочитать аудиофайл.' })
        sfx('error')
      } finally {
        if (aliveRef.current) setMusicBusy(false)
      }
    },
    [notify],
  )

  const importFiles = useCallback(
    async (files: File[]) => {
      for (const f of files) {
        if (!aliveRef.current) return
        const kind = kindOf(f)
        if (kind === 'audio') {
          await loadAudioFile(f)
          continue
        }
        if (!kind) {
          notify({ kind: 'error', text: `«${shortName(f.name)}» — не видео и не фото.` })
          sfx('error')
          continue
        }
        const tmp = uid('imp')
        setImporting((l) => [...l, { id: tmp, name: f.name }])
        try {
          const m = await importMedia(f)
          if (!aliveRef.current) {
            URL.revokeObjectURL(m.url)
            return
          }
          const total = buildTimeline(clipsRef.current).total
          const made = clipFor(m, uid('clip'), total)
          setMedia((prev) => ({ ...prev, [m.id]: m }))
          setClips((prev) => [...prev, made.clip])
          setSelected(made.clip.id)
          setTab('clips')
          sfx('drop')
          if (total >= MAX_TOTAL_SEC - 0.05) {
            notify({ kind: 'info', text: 'Ролик уже 90 секунд — новый клип в файл не попадёт. Укоротите другие клипы.' })
          } else if (made.trimmed) {
            notify({ kind: 'info', text: 'Видео длиннее оставшегося времени — взяли начало. Выберите фрагмент ползунками.' })
          }
        } catch (e) {
          if (!aliveRef.current) return
          notify({ kind: 'error', text: e instanceof MediaError ? e.message : `Не удалось открыть «${shortName(f.name)}».` })
          sfx('error')
        } finally {
          if (aliveRef.current) setImporting((l) => l.filter((x) => x.id !== tmp))
        }
      }
    },
    [loadAudioFile, notify, setClips],
  )

  const pickFiles = () => fileRef.current?.click()
  const pickAudio = () => audioRef.current?.click()

  // ---------- Клипы ----------

  const addBg = (preset: BgPreset) => {
    const id = uid('clip')
    const budget = MAX_TOTAL_SEC - buildTimeline(clipsRef.current).total
    const duration = clamp(budget >= STILL_MIN_SEC ? Math.min(5, round1(budget)) : 5, STILL_MIN_SEC, STILL_MAX_SEC)
    setClips((cs) => [...cs, { id, kind: 'bg', preset, duration, kenBurns: false }])
    setSelected(id)
    pendingSeek.current = { clipId: id, edge: 'start' }
    sfx('drop')
  }

  const moveClip = (id: string, dir: -1 | 1) =>
    setClips((cs) => {
      const i = cs.findIndex((c) => c.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= cs.length) return cs
      const next = cs.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const duplicateClip = (id: string) => {
    const cs = clipsRef.current
    const i = cs.findIndex((c) => c.id === id)
    if (i < 0) return
    const copy: Clip = { ...cs[i], id: uid('clip') }
    setClips([...cs.slice(0, i + 1), copy, ...cs.slice(i + 1)])
    setSelected(copy.id)
    sfx('drop')
  }

  const removeClip = (id: string) => {
    const cs = clipsRef.current
    const index = cs.findIndex((c) => c.id === id)
    if (index < 0) return
    const clip = cs[index]
    setUndo({ clip, index })
    setClips((cs) => cs.filter((c) => c.id !== id))
    if (selected === id) setSelected(null)
    notify({
      kind: 'info',
      text: 'Клип удалён',
      action: {
        label: 'Вернуть',
        run: () => {
          setClips((cs) => {
            if (cs.some((c) => c.id === clip.id)) return cs
            const next = cs.slice()
            next.splice(Math.min(index, next.length), 0, clip)
            return next
          })
          setUndo(null)
          setSelected(clip.id)
        },
      },
    })
  }

  const patchClip = (id: string, patch: ClipPatch, edge?: 'start' | 'end') => {
    setClips((cs) => cs.map((c) => (c.id === id ? ({ ...c, ...patch } as Clip) : c)))
    if (edge) pendingSeek.current = { clipId: id, edge }
  }

  const selectClip = (id: string | null) => {
    setSelected(id)
    if (id && engine && !engine.isPlaying) {
      const e = timeline.entries.find((x) => x.clip.id === id)
      if (e && e.start < timeline.duration) engine.seek(e.start)
    }
  }

  // ---------- Сценарий ----------

  const appendBg = (seconds: number, preset: BgPreset) => {
    if (seconds <= 0.2) return
    setClips((cs) => [...cs, ...backgroundsFor([[0, seconds]], preset)])
    sfx('drop')
  }

  const buildScript = (s: ReelScript, preset: BgPreset) => {
    const b = buildFromScript(s, DEFAULT_HOOK_SEC)
    setText((t) => ({
      ...t,
      hook: b.hook,
      hookSec: b.hookSec,
      captions: b.captions,
      ...(hasFiles ? {} : { hookPos: 'center' as const, capPos: 'center' as const }),
    }))
    if (!hasFiles) {
      setClips(backgroundsFor(b.segments, preset))
      setSelected(null)
    } else if (b.total > timeline.total + 0.3) {
      const gap = round1(Math.min(b.total, MAX_TOTAL_SEC) - timeline.total)
      notify({
        kind: 'info',
        text: `Текст идёт ${fmtSec(b.total)} с, а клипы — ${fmtSec(timeline.total)} с.`,
        action: { label: `Добавить фон на ${fmtSec(gap)} с`, run: () => appendBg(gap, preset) },
      })
    }
    engine?.pause()
    engine?.seek(0)
    sfx('magic')
  }

  // ---------- Экспорт ----------

  const startExport = async () => {
    if (!engine || busy || !support.ok || timeline.duration <= 0.05) return
    // звук и контекст — синхронно в жесте клика
    engine.ensureAudio()
    quietGame()
    const ac = new AbortController()
    abortRef.current = ac
    setExportError(null)
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
    setResult(null)
    setTab('export')
    setPhase('preparing')
    setPrepLabel('Готовлю шрифты')
    sfx('magic')
    stageRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
    try {
      await loadCanvasFonts()
      clearTextCache()
      if (isTrack(music.choice)) {
        setPrepLabel('Готовлю трек')
        const buf = await getTrack(music.choice, trackLength(timeline.duration))
        bufferIdRef.current = music.choice
        engine.setMusic(buf)
      }
      if (ac.signal.aborted) throw new ExportAbort()
      setPrepLabel('Запускаю запись')
      const res = await recordReel(engine, {
        monitor,
        signal: ac.signal,
        onPhase: (ph) => {
          if (aliveRef.current) setPhase(ph)
        },
      })
      const blob = res.ext === 'webm' ? await fixWebmDuration(res.blob, res.durationSec * 1000) : res.blob
      if (!aliveRef.current) return
      const url = URL.createObjectURL(blob)
      resultUrlRef.current = url
      const fileName = reelFileName(res.ext)
      triggerDownload(url, fileName)
      setResult({ url, fileName, ext: res.ext, size: blob.size, durationSec: res.durationSec, blob })
      setPhase('idle')
      sfx('success')
      onExportedRef.current({ exportedAt: Date.now(), durationSec: round1(res.durationSec), format: res.ext })
    } catch (e) {
      if (!aliveRef.current) return
      setPhase('idle')
      if (e instanceof ExportAbort) notify({ kind: 'info', text: 'Запись остановлена — файл не сохранён.' })
      else {
        setExportError(describeError(e))
        sfx('error')
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null
      if (aliveRef.current) engine.seek(0)
    }
  }

  const cancelExport = () => abortRef.current?.abort()

  const downloadAgain = () => {
    if (result) triggerDownload(result.url, result.fileName)
  }

  const canShare = useMemo(() => {
    if (!result || typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
    try {
      return navigator.canShare({ files: [new File([result.blob], result.fileName, { type: result.blob.type })] })
    } catch {
      return false
    }
  }, [result])

  const share = async () => {
    if (!result) return
    try {
      await navigator.share({
        files: [new File([result.blob], result.fileName, { type: result.blob.type })],
        title: 'Мой рилс',
      })
    } catch {
      /* пользователь закрыл окно «Поделиться» */
    }
  }

  const needPro = () => {
    if (onNeedProRef.current) onNeedProRef.current()
    else notify({ kind: 'info', text: 'Это открывается в Наборе Мастера.' })
  }

  // ---------- Закрытие ----------

  const doClose = () => {
    abortRef.current?.abort()
    engine?.pause()
    setConfirmClose(false)
    onClose()
  }

  const requestClose = () => {
    if (busy || hasFiles) setConfirmClose(true)
    else doClose()
  }

  // ---------- Вкладки ----------

  const selectTab = (id: TabId) => {
    if (id === tab) return
    sfx('page')
    setTab(id)
  }

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = -1
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    if (next < 0) return
    e.preventDefault()
    const id = TABS[next].id
    selectTab(id)
    tabRefs.current[id]?.focus()
  }

  // при смене вкладки — к началу панели, если успели уйти ниже
  useLayoutEffect(() => {
    const side = sideRef.current
    const body = bodyRef.current
    if (!side || !body) return
    if (side.scrollHeight > side.clientHeight + 1 && getComputedStyle(side).overflowY !== 'visible') {
      side.scrollTop = 0
    } else if (body.scrollTop > side.offsetTop) {
      body.scrollTop = side.offsetTop
    }
  }, [tab])

  // ---------- Перетаскивание файлов ----------

  const dragHasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

  const tabCount = (id: TabId): string | null => {
    if (id === 'clips') return clips.length ? String(clips.length) : null
    if (id === 'text') return text.captions.length ? String(text.captions.length) : null
    return null
  }

  const musicLabel =
    music.choice === 'none'
      ? 'без музыки'
      : music.choice === 'file'
        ? musicFile
          ? shortName(musicFile.name, 30)
          : 'свой трек'
        : (REEL_TRACKS.find((t) => t.id === music.choice)?.name ?? 'трек')

  const recording = phase === 'recording' || phase === 'paused' || phase === 'finishing' ? phase : null

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <div
        ref={rootRef}
        className="ve-root"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ve-title"
        tabIndex={-1}
        onDragEnter={(e) => {
          if (!dragHasFiles(e) || busy) return
          e.preventDefault()
          setDragOver(true)
        }}
        onDragOver={(e) => {
          if (!dragHasFiles(e) || busy) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDragLeave={(e) => {
          const to = e.relatedTarget
          if (to instanceof Node && e.currentTarget.contains(to)) return
          setDragOver(false)
        }}
        onDrop={(e) => {
          if (!dragHasFiles(e)) return
          e.preventDefault()
          setDragOver(false)
          if (!busy) void importFiles(Array.from(e.dataTransfer.files))
        }}
      >
        <header className="ve-head">
          <div className="ve-brand">
            <span className="ve-brand-icon" aria-hidden="true">
              <Clapperboard size={20} />
            </span>
            <div className="ve-brand-text">
              <h1 id="ve-title" className="display t-20">
                Монтажная
              </h1>
              <p className="tiny faint">Рилс 9:16 до 90 секунд</p>
            </div>
          </div>
          <span
            className={`badge num ve-head-dur ${timeline.total > MAX_TOTAL_SEC ? 'badge-ember' : 'badge-mint'}`}
            title="Длительность ролика"
          >
            {fmtTime(timeline.duration)}
          </span>
          <Button variant="ghost" size="sm" icon={<X size={18} />} onClick={requestClose} sound={false}>
            Закрыть
          </Button>
        </header>

        <div className="ve-body" ref={bodyRef}>
          <Stage
            engine={engine}
            canvasRef={canvasRef}
            stageRef={stageRef}
            timeline={timeline}
            media={media}
            text={text}
            selected={selected}
            busy={busy}
            recording={recording}
            onSelect={(id) => setSelected(id)}
            onToggle={togglePlay}
            onToggleSafe={() => setText((t) => ({ ...t, safeZones: !t.safeZones }))}
            onAddClip={() => {
              setTab('clips')
              pickFiles()
            }}
          />

          <section className="ve-side" ref={sideRef} aria-label="Настройки ролика">
            <div className="ve-tabs" role="tablist" aria-label="Разделы монтажной">
              {TABS.map((t, i) => {
                const count = tabCount(t.id)
                const on = tab === t.id
                return (
                  <button
                    key={t.id}
                    ref={(el) => {
                      tabRefs.current[t.id] = el
                    }}
                    type="button"
                    role="tab"
                    id={`ve-tab-${t.id}`}
                    className="ve-tab"
                    aria-selected={on}
                    aria-controls={on ? `ve-panel-${t.id}` : undefined}
                    tabIndex={on ? 0 : -1}
                    disabled={busy && t.id !== 'export'}
                    onClick={() => selectTab(t.id)}
                    onKeyDown={(e) => onTabKey(e, i)}
                  >
                    <t.Icon size={16} aria-hidden="true" />
                    <span>{t.label}</span>
                    {count ? <span className="ve-tab-count num">{count}</span> : null}
                  </button>
                )
              })}
            </div>

            <div
              className="ve-panel"
              role="tabpanel"
              id={`ve-panel-${tab}`}
              aria-labelledby={`ve-tab-${tab}`}
              inert={busy && tab !== 'export'}
            >
              {engineError ? (
                <p className="ve-card ve-card-alert small" role="alert">
                  Браузер не дал нарисовать превью. Обновите страницу или откройте игру в свежем Chrome.
                </p>
              ) : null}
              <div key={tab} className="ve-tabpane">
                {tab === 'clips' ? (
                  <ClipsPanel
                    clips={clips}
                    media={media}
                    timeline={timeline}
                    selected={selected}
                    importing={importing}
                    onSelect={selectClip}
                    onPickFiles={pickFiles}
                    onAddBg={addBg}
                    onMove={moveClip}
                    onDuplicate={duplicateClip}
                    onRemove={removeClip}
                    onPatch={patchClip}
                    onGoText={() => selectTab('text')}
                  />
                ) : tab === 'text' ? (
                  <TextPanel
                    text={text}
                    onText={setText}
                    scripts={scripts}
                    duration={timeline.duration}
                    hasFiles={hasFiles}
                    onPreviewAt={previewAt}
                    getTime={() => engine?.time ?? 0}
                    onBuild={buildScript}
                  />
                ) : tab === 'music' ? (
                  <MusicPanel
                    music={music}
                    pro={pro}
                    status={trackStatus}
                    fileName={musicFile?.name ?? null}
                    fileBusy={musicBusy}
                    canListen={!!engine && timeline.duration > 0.05}
                    onChoose={(choice) => setMusic((m) => ({ ...m, choice }))}
                    onVolume={(volume) => setMusic((m) => ({ ...m, volume }))}
                    onPickFile={pickAudio}
                    onNeedPro={needPro}
                    onListen={() => {
                      if (!engine) return
                      quietGame()
                      engine.seek(0)
                      if (!engine.isPlaying) engine.play()
                    }}
                  />
                ) : (
                  <ExportPanel
                    engine={engine}
                    support={support}
                    duration={timeline.duration}
                    total={timeline.total}
                    clipsCount={clips.length}
                    hasHook={!!text.hook.trim()}
                    captions={text.captions.filter((c) => c.text.trim()).length}
                    pro={pro}
                    musicLabel={musicLabel}
                    monitor={monitor}
                    phase={phase}
                    prepLabel={prepLabel}
                    error={exportError}
                    result={result}
                    canShare={canShare}
                    onMonitor={setMonitor}
                    onStart={() => void startExport()}
                    onCancel={cancelExport}
                    onDownload={downloadAgain}
                    onShare={() => void share()}
                    onNeedPro={needPro}
                  />
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="ve-media-host" ref={hostRef} aria-hidden="true" />
        <input
          ref={fileRef}
          type="file"
          accept="video/*,image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) void importFiles(files)
          }}
        />
        <input
          ref={audioRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void loadAudioFile(f)
          }}
        />

        <div className="ve-toast-zone" aria-live="polite">
          <AnimatePresence>
            {notice ? (
              <motion.div
                key={notice.id}
                className={`ve-toast panel${notice.kind === 'error' ? ' is-error' : ''}`}
                role={notice.kind === 'error' ? 'alert' : 'status'}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
              >
                <span className="ve-toast-text">{notice.text}</span>
                {notice.action ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      notice.action?.run()
                      setNotice(null)
                    }}
                  >
                    {notice.action.label}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="quiet"
                  icon={<X size={16} />}
                  aria-label="Скрыть уведомление"
                  onClick={() => setNotice(null)}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {dragOver ? (
          <div className="ve-drop" aria-hidden="true">
            <div className="ve-drop-box">
              <Upload size={28} />
              <p className="display t-20">Отпустите, чтобы добавить</p>
              <p className="small muted">Видео и фото — в таймлайн, аудио — в музыку</p>
            </div>
          </div>
        ) : null}

        <ConfirmDialog
          open={confirmClose}
          title="Закрыть монтажную?"
          confirmLabel="Закрыть монтажную"
          cancelLabel="Остаться"
          onConfirm={doClose}
          onCancel={() => setConfirmClose(false)}
        >
          {busy
            ? 'Запись ролика ещё идёт — она остановится, файл не сохранится.'
            : 'Видео и фото хранятся только в этой вкладке — после закрытия их придётся добавить заново. Текст и живые фоны сохранятся.'}
        </ConfirmDialog>
      </div>
    </MotionConfig>
  )
}
