// Движок превью и экспорта без React: мастер-часы, скрытые <video>, canvas 720×1280, аудиограф.
// Звук видео идёт через тот же граф, что и экспорт: элемент → MediaElementSource → gain клипа → шина.
import { bgTone, drawBackground } from './backgrounds'
import { drawOverlay } from './overlay'
import { mix, palette } from './palette'
import {
  DEFAULT_TEXT,
  OUT_H,
  OUT_W,
  type Clip,
  type MediaItem,
  type TextSettings,
  type TextTone,
  type TimelineEntry,
  type VideoClip,
} from './types'
import { buildTimeline, clamp, easeInOut, entryAt } from './util'

export interface EngineProject {
  clips: Clip[]
  media: Record<string, MediaItem>
  text: TextSettings
  watermark: boolean
}

export interface EngineState {
  playing: boolean
}

interface Slot {
  clipId: string
  el: HTMLVideoElement
  inPoint: number
  volume: number
  node: MediaElementAudioSourceNode | null
  gain: GainNode | null
  primed: boolean
  lastTry: number
}

interface Graph {
  ctx: AudioContext
  bus: GainNode
  comp: DynamicsCompressorNode
  monitor: GainNode
  music: GainNode
  dest: MediaStreamAudioDestinationNode | null
}

type TickFn = (t: number, dur: number) => void

const FRAME_MS = 1000 / 30
/** Насколько видео может отстать от мастер-часов, прежде чем мы его подтянем */
const DRIFT_SEC = 0.35
const MUSIC_FADE_SEC = 1.2
const EPS = 1e-3

const UA = typeof navigator !== 'undefined' ? navigator.userAgent : ''
/** WebKit разрешает звук элементу только после play() из жеста — «будим» все видео на первом клике */
const NEEDS_PRIMING =
  /iP(hone|ad|od)/.test(UA) || (/Safari\//.test(UA) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|Android/.test(UA))

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function cover(b: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number) {
  if (!sw || !sh) return
  const s = Math.max(OUT_W / sw, OUT_H / sh)
  const dw = sw * s
  const dh = sh * s
  b.drawImage(src, (OUT_W - dw) / 2, (OUT_H - dh) / 2, dw, dh)
}

/** Лёгкий зум с дрейфом; направление зависит от id клипа, края кадра не открываются. */
function kenBurns(b: CanvasRenderingContext2D, lt: number, len: number, seed: string) {
  const k = easeInOut(clamp(lt / Math.max(0.1, len), 0, 1))
  const h = hash(seed)
  const s = (h & 1) === 0 ? 1.04 + 0.08 * k : 1.12 - 0.08 * k
  const ang = (((h >>> 1) % 360) * Math.PI) / 180
  const d = (k - 0.5) * 24
  b.translate(OUT_W / 2 + Math.cos(ang) * d, OUT_H / 2 + Math.sin(ang) * d)
  b.scale(s, s)
  b.translate(-OUT_W / 2, -OUT_H / 2)
}

export class ReelEngine {
  readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly base: HTMLCanvasElement
  private readonly bctx: CanvasRenderingContext2D
  private readonly host: HTMLElement
  private project: EngineProject = { clips: [], media: {}, text: DEFAULT_TEXT, watermark: true }
  private pending: EngineProject | null = null
  private entries: TimelineEntry[] = []
  private dur = 0
  private t = 0
  private playing = false
  private exporting = false
  private origin = 0
  private raf = 0
  private drawRaf = 0
  private lastFrame = -1e9
  private activeId: string | null = null
  private slots = new Map<string, Slot>()
  private graph: Graph | null = null
  private musicBuf: AudioBuffer | null = null
  private musicVol = 0.8
  private musicSrc: { node: AudioBufferSourceNode; gain: GainNode } | null = null
  private ticks = new Set<TickFn>()
  private subs = new Set<() => void>()
  private state: EngineState = { playing: false }
  private dead = false
  private baseReady = false
  /** Вызывается, когда воспроизведение дошло до конца ролика */
  onEnded: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    this.canvas = canvas
    this.host = host
    canvas.width = OUT_W
    canvas.height = OUT_H
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas 2D недоступен')
    this.ctx = ctx
    this.base = document.createElement('canvas')
    this.base.width = OUT_W
    this.base.height = OUT_H
    const b = this.base.getContext('2d', { alpha: false })
    if (!b) throw new Error('Canvas 2D недоступен')
    this.bctx = b
    for (const c of [ctx, b]) {
      c.imageSmoothingEnabled = true
      c.imageSmoothingQuality = 'high'
    }
    document.addEventListener('visibilitychange', this.onVisibility)
    this.requestDraw()
  }

  // ---------- Состояние ----------

  get time() {
    return this.t
  }
  get duration() {
    return this.dur
  }
  get isPlaying() {
    return this.playing
  }
  get isExporting() {
    return this.exporting
  }

  subscribe = (fn: () => void) => {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }

  getState = () => this.state

  /** Время на каждом кадре воспроизведения и после перемотки */
  onTick(fn: TickFn): () => void {
    this.ticks.add(fn)
    fn(this.t, this.dur)
    return () => {
      this.ticks.delete(fn)
    }
  }

  private emitTick() {
    for (const f of this.ticks) f(this.t, this.dur)
  }

  private setState() {
    if (this.state.playing === this.playing) return
    this.state = { playing: this.playing }
    for (const f of this.subs) f()
  }

  private clock(): number {
    return this.playing ? clamp((performance.now() - this.origin) / 1000, 0, this.dur) : this.t
  }

  // ---------- Проект ----------

  setProject(p: EngineProject) {
    if (this.dead) return
    // во время записи ролик не меняется — применим после
    if (this.exporting) {
      this.pending = p
      return
    }
    this.apply(p)
  }

  private apply(p: EngineProject) {
    const oldDur = this.dur
    this.project = p
    const tl = buildTimeline(p.clips)
    this.entries = tl.entries
    this.dur = tl.duration
    this.syncSlots()
    if (this.t > this.dur) this.t = this.dur
    if (this.playing) {
      if (this.dur <= 0.05) this.pause()
      else {
        this.t = this.clock()
        this.updateActive(true)
        if (Math.abs(oldDur - this.dur) > EPS) this.scheduleMusicFade(false)
      }
    } else {
      this.syncPaused()
      this.requestDraw()
    }
    this.emitTick()
  }

  private syncSlots() {
    const want = new Map<string, VideoClip>()
    for (const e of this.entries) {
      if (e.clip.kind === 'video' && this.project.media[e.clip.mediaId]) want.set(e.clip.id, e.clip)
    }
    for (const id of [...this.slots.keys()]) if (!want.has(id)) this.dropSlot(id)
    for (const [id, clip] of want) {
      const s = this.slots.get(id)
      if (!s) {
        this.slots.set(id, this.makeSlot(clip, this.project.media[clip.mediaId]))
        continue
      }
      const moved = Math.abs(s.inPoint - clip.in) > EPS
      s.inPoint = clip.in
      s.volume = clip.volume
      if (moved && id !== this.activeId) this.park(s)
    }
  }

  private makeSlot(clip: VideoClip, m: MediaItem): Slot {
    const el = document.createElement('video')
    el.muted = true
    el.defaultMuted = true
    el.playsInline = true
    el.setAttribute('playsinline', '')
    el.setAttribute('webkit-playsinline', '')
    el.preload = 'auto'
    el.disablePictureInPicture = true
    const s: Slot = {
      clipId: clip.id,
      el,
      inPoint: clip.in,
      volume: clip.volume,
      node: null,
      gain: null,
      primed: false,
      lastTry: 0,
    }
    const redraw = () => {
      if (!this.playing) this.requestDraw()
    }
    el.addEventListener('loadeddata', redraw)
    el.addEventListener('seeked', redraw)
    el.addEventListener(
      'loadedmetadata',
      () => {
        if (this.dead) return
        if (s.clipId !== this.activeId) this.park(s)
        else if (!this.playing) this.syncPaused()
      },
      { once: true },
    )
    el.src = m.url
    this.host.appendChild(el)
    if (this.graph) this.connectSlot(s)
    return s
  }

  /** Неактивное видео всегда стоит на паузе в точке входа — готово к старту без чёрного кадра */
  private park(s: Slot) {
    try {
      if (!s.el.paused) s.el.pause()
      if (s.el.readyState >= 1 && Math.abs(s.el.currentTime - s.inPoint) > 0.04) s.el.currentTime = s.inPoint
    } catch {
      /* элемент ещё не готов */
    }
  }

  private connectSlot(s: Slot) {
    const g = this.graph
    if (!g || s.node) return
    try {
      const node = g.ctx.createMediaElementSource(s.el)
      const gain = g.ctx.createGain()
      gain.gain.value = 0
      node.connect(gain)
      gain.connect(g.bus)
      s.node = node
      s.gain = gain
      s.el.muted = false
    } catch {
      /* без графа элемент остаётся немым */
    }
  }

  private dropSlot(id: string) {
    const s = this.slots.get(id)
    if (!s) return
    this.slots.delete(id)
    if (this.activeId === id) this.activeId = null
    try {
      s.el.pause()
    } catch {
      /* ignore */
    }
    try {
      s.gain?.disconnect()
      s.node?.disconnect()
    } catch {
      /* ignore */
    }
    s.el.removeAttribute('src')
    try {
      s.el.load()
    } catch {
      /* ignore */
    }
    s.el.remove()
  }

  // ---------- Звук ----------

  /** Создаёт и будит AudioContext. Вызывать из обработчика клика. */
  ensureAudio(): AudioContext | null {
    if (this.dead) return null
    if (!this.graph) {
      const AC =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      try {
        const ctx = new AC({ latencyHint: 'interactive' })
        const bus = ctx.createGain()
        bus.gain.value = 0.9
        // мягкий лимитер: музыка и голос вместе не перегрузят файл
        const comp = ctx.createDynamicsCompressor()
        comp.threshold.value = -3
        comp.knee.value = 0
        comp.ratio.value = 20
        comp.attack.value = 0.002
        comp.release.value = 0.12
        const monitor = ctx.createGain()
        const music = ctx.createGain()
        music.gain.value = this.musicVol
        music.connect(bus)
        bus.connect(comp)
        comp.connect(monitor)
        monitor.connect(ctx.destination)
        this.graph = { ctx, bus, comp, monitor, music, dest: null }
        for (const s of this.slots.values()) this.connectSlot(s)
      } catch {
        return null
      }
    }
    const ctx = this.graph.ctx
    if (ctx.state !== 'running') {
      ctx
        .resume()
        .then(() => {
          // пока контекст просыпался, часы ушли вперёд — перезапустим музыку в нужной точке
          if (this.playing && !this.dead) this.startMusic()
        })
        .catch(() => {})
    }
    return ctx
  }

  /** Поток звука для MediaRecorder (тот же микс, что слышен в превью) */
  audioStream(): MediaStream | null {
    const g = this.graph
    if (!g) return null
    if (!g.dest) {
      try {
        g.dest = g.ctx.createMediaStreamDestination()
        g.comp.connect(g.dest)
      } catch {
        return null
      }
    }
    return g.dest.stream
  }

  setMonitor(on: boolean) {
    const g = this.graph
    if (g) g.monitor.gain.setValueAtTime(on ? 1 : 0, g.ctx.currentTime)
  }

  setMusic(buf: AudioBuffer | null) {
    if (this.dead || this.musicBuf === buf) return
    this.musicBuf = buf
    if (this.playing) this.startMusic()
    else this.stopMusic(true)
  }

  setMusicVolume(v: number) {
    this.musicVol = clamp(v, 0, 1)
    const g = this.graph
    if (g) g.music.gain.setTargetAtTime(this.musicVol, g.ctx.currentTime, 0.04)
  }

  private startMusic() {
    this.stopMusic(true)
    const g = this.graph
    const buf = this.musicBuf
    if (!g || !buf || !this.playing) return
    const offset = this.clock()
    if (offset >= buf.duration - 0.05 || offset >= this.dur) return
    try {
      const node = g.ctx.createBufferSource()
      node.buffer = buf
      const gain = g.ctx.createGain()
      gain.gain.value = 0
      node.connect(gain)
      gain.connect(g.music)
      node.start(g.ctx.currentTime, offset)
      this.musicSrc = { node, gain }
      this.scheduleMusicFade(true)
    } catch {
      this.musicSrc = null
    }
  }

  /** Плавный вход и затухание к концу ролика (буфер может быть длиннее ролика) */
  private scheduleMusicFade(fadeIn: boolean) {
    const g = this.graph
    const m = this.musicSrc
    if (!g || !m) return
    const now = g.ctx.currentTime
    const remaining = Math.max(0, this.dur - this.clock())
    const p = m.gain.gain
    const level = remaining > MUSIC_FADE_SEC ? 1 : remaining / MUSIC_FADE_SEC
    p.cancelScheduledValues(now)
    if (fadeIn) {
      p.setValueAtTime(0, now)
      p.linearRampToValueAtTime(level, now + 0.05)
    } else {
      p.setValueAtTime(level, now)
    }
    if (remaining > MUSIC_FADE_SEC) p.setValueAtTime(1, now + remaining - MUSIC_FADE_SEC)
    p.linearRampToValueAtTime(0, now + Math.max(0.06, remaining))
  }

  private stopMusic(fade: boolean) {
    const m = this.musicSrc
    const g = this.graph
    this.musicSrc = null
    if (!m || !g) return
    const now = g.ctx.currentTime
    try {
      if (fade) {
        const p = m.gain.gain
        p.cancelScheduledValues(now)
        p.setValueAtTime(p.value, now)
        p.linearRampToValueAtTime(0, now + 0.04)
        m.node.stop(now + 0.05)
      } else {
        m.node.stop()
      }
    } catch {
      /* уже остановлен */
    }
    setTimeout(() => {
      try {
        m.node.disconnect()
        m.gain.disconnect()
      } catch {
        /* ignore */
      }
    }, 150)
  }

  /** Громкость клипа с плавным входом и отсечкой ровно на точке выхода */
  private gate(s: Slot, vol: number, remaining?: number) {
    const g = this.graph
    if (!g || !s.gain) return
    const now = g.ctx.currentTime
    const p = s.gain.gain
    p.cancelScheduledValues(now)
    p.setValueAtTime(p.value, now)
    p.linearRampToValueAtTime(vol, now + 0.025)
    if (remaining !== undefined && vol > 0) {
      const end = now + Math.max(0.05, remaining)
      p.setValueAtTime(vol, Math.max(now + 0.026, end - 0.025))
      p.linearRampToValueAtTime(0, end)
    }
  }

  // ---------- Воспроизведение ----------

  play() {
    if (this.dead || this.playing || this.dur <= 0.05) return
    if (this.t >= this.dur - 0.03) this.t = 0
    this.ensureAudio()
    this.playing = true
    this.origin = performance.now() - this.t * 1000
    this.lastFrame = -1e9
    this.activeId = null
    this.updateActive(false)
    this.prime()
    this.startMusic()
    this.setState()
    this.raf = requestAnimationFrame(this.frame)
  }

  pause() {
    if (!this.playing) return
    this.t = this.clock()
    this.playing = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.haltAll()
    this.stopMusic(true)
    this.syncPaused()
    this.requestDraw()
    this.emitTick()
    this.setState()
  }

  toggle() {
    if (this.playing) this.pause()
    else this.play()
  }

  seek(t: number) {
    if (this.dead) return
    this.t = clamp(t, 0, this.dur)
    if (this.playing) {
      this.origin = performance.now() - this.t * 1000
      const e = this.entryNow()
      if (e && e.clip.kind === 'video' && e.clip.id === this.activeId) {
        const s = this.slots.get(e.clip.id)
        if (s) this.startSlot(s, e, e.clip)
      } else this.updateActive(false)
      this.startMusic()
    } else {
      this.syncPaused()
      this.requestDraw()
    }
    this.emitTick()
  }

  private entryNow(): TimelineEntry | null {
    if (this.dur <= 0) return null
    return entryAt(this.entries, Math.min(this.t, this.dur - EPS))
  }

  private frame = (now: number) => {
    this.raf = 0
    if (!this.playing || this.dead) return
    const t = (performance.now() - this.origin) / 1000
    if (t >= this.dur) {
      this.t = this.dur
      this.finish()
      return
    }
    this.t = t
    this.updateActive(false)
    if (now - this.lastFrame >= FRAME_MS - 3) {
      this.lastFrame = now
      this.draw()
      this.emitTick()
    }
    this.raf = requestAnimationFrame(this.frame)
  }

  private finish() {
    this.playing = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.haltAll()
    this.stopMusic(false)
    this.draw()
    this.emitTick()
    this.setState()
    this.onEnded?.()
  }

  private updateActive(reeval: boolean) {
    const e = this.entryNow()
    const id = e?.clip.id ?? null
    if (id !== this.activeId) {
      if (this.activeId) {
        const old = this.slots.get(this.activeId)
        if (old) {
          this.gate(old, 0)
          this.park(old)
        }
      }
      this.activeId = id
      if (e && e.clip.kind === 'video') {
        const s = this.slots.get(e.clip.id)
        if (s) this.startSlot(s, e, e.clip)
      }
      return
    }
    if (!e || e.clip.kind !== 'video') return
    const s = this.slots.get(e.clip.id)
    if (!s) return
    if (reeval) this.gate(s, s.volume, e.end - this.t)
    const target = e.clip.in + (this.t - e.start)
    const el = s.el
    if (!el.seeking && el.readyState >= 1 && Math.abs(el.currentTime - target) > DRIFT_SEC && target < e.clip.out - 0.15) {
      try {
        el.currentTime = target
      } catch {
        /* ignore */
      }
    }
    if (el.paused && !el.ended && performance.now() - s.lastTry > 1000) this.playEl(s)
  }

  private startSlot(s: Slot, e: TimelineEntry, clip: VideoClip) {
    const target = clip.in + (this.t - e.start)
    try {
      if (Math.abs(s.el.currentTime - target) > 0.05) s.el.currentTime = target
    } catch {
      /* ignore */
    }
    this.gate(s, s.volume, e.end - this.t)
    this.playEl(s)
  }

  private playEl(s: Slot) {
    s.lastTry = performance.now()
    const p = s.el.play()
    if (!p) return
    p.catch((err: unknown) => {
      if (!this.playing || s.clipId !== this.activeId) return
      // звук заблокирован браузером — пусть хотя бы картинка идёт
      if (err instanceof DOMException && err.name === 'NotAllowedError' && !s.el.muted) {
        s.el.muted = true
        s.el.play().catch(() => {})
      }
    })
  }

  private prime() {
    if (!NEEDS_PRIMING) return
    for (const s of this.slots.values()) {
      if (s.primed) continue
      s.primed = true
      if (s.clipId === this.activeId) continue
      const p = s.el.play()
      if (p)
        p.then(
          () => {
            if (!(this.playing && s.clipId === this.activeId)) this.park(s)
          },
          () => {},
        )
    }
  }

  private haltAll() {
    for (const s of this.slots.values()) {
      this.gate(s, 0)
      try {
        if (!s.el.paused) s.el.pause()
      } catch {
        /* ignore */
      }
      if (s.clipId !== this.activeId) this.park(s)
    }
  }

  private syncPaused() {
    const e = this.entryNow()
    const id = e?.clip.id ?? null
    if (this.activeId && this.activeId !== id) {
      const old = this.slots.get(this.activeId)
      if (old) this.park(old)
    }
    this.activeId = id
    if (e && e.clip.kind === 'video') {
      const s = this.slots.get(e.clip.id)
      if (s && s.el.readyState >= 1) {
        const target = e.clip.in + (this.t - e.start)
        try {
          if (Math.abs(s.el.currentTime - target) > 0.03) s.el.currentTime = target
        } catch {
          /* ignore */
        }
      }
    }
  }

  private onVisibility = () => {
    if (document.hidden && this.playing && !this.exporting) this.pause()
  }

  // ---------- Экспорт ----------

  /** Пауза, перемотка в начало и ожидание первого кадра */
  async prepareExport(): Promise<void> {
    if (this.dead) return
    this.pause()
    this.exporting = true
    this.seek(0)
    await this.waitReady(4000)
    if (!this.dead) this.draw()
  }

  endExport() {
    if (this.dead) return
    this.exporting = false
    this.setMonitor(true)
    const p = this.pending
    this.pending = null
    if (p) this.apply(p)
  }

  private waitReady(timeout: number): Promise<void> {
    const start = performance.now()
    return new Promise((resolve) => {
      const check = () => {
        if (this.dead) return resolve()
        const e = this.entryNow()
        const s = e && e.clip.kind === 'video' ? this.slots.get(e.clip.id) : undefined
        const ok = !s || (s.el.readyState >= 2 && !s.el.seeking)
        if (ok || performance.now() - start > timeout) resolve()
        else setTimeout(check, 40)
      }
      check()
    })
  }

  // ---------- Рисование ----------

  requestDraw() {
    if (this.dead || this.playing || this.drawRaf) return
    this.drawRaf = requestAnimationFrame(() => {
      this.drawRaf = 0
      if (!this.playing && !this.dead) this.draw()
    })
  }

  private draw() {
    const t = Math.min(this.t, Math.max(0, this.dur - EPS))
    const e = this.entryNow()
    const b = this.bctx
    if (!e) {
      this.drawEmpty(b)
      this.baseReady = true
    } else if (this.drawClip(b, e, t)) {
      this.baseReady = true
    } else if (!this.baseReady) {
      b.fillStyle = palette().night
      b.fillRect(0, 0, OUT_W, OUT_H)
      this.baseReady = true
    }
    // если кадр видео ещё не готов, в base остаётся предыдущий — без чёрной вспышки
    const c = this.ctx
    c.drawImage(this.base, 0, 0)
    const tone: TextTone = e && e.clip.kind === 'bg' ? bgTone(e.clip.preset) : 'light'
    drawOverlay(c, this.project.text, t, this.dur, tone, this.project.watermark && this.dur > 0, this.playing)
  }

  private drawEmpty(b: CanvasRenderingContext2D) {
    const P = palette()
    const g = b.createRadialGradient(OUT_W / 2, OUT_H * 0.42, 40, OUT_W / 2, OUT_H / 2, OUT_H * 0.75)
    g.addColorStop(0, P.dusk)
    g.addColorStop(1, mix(P.night, '#000000', 0.4))
    b.fillStyle = g
    b.fillRect(0, 0, OUT_W, OUT_H)
  }

  private drawClip(b: CanvasRenderingContext2D, e: TimelineEntry, t: number): boolean {
    const c = e.clip
    const lt = t - e.start
    const len = e.end - e.start
    if (c.kind === 'video') {
      const v = this.slots.get(c.id)?.el
      if (!v || v.readyState < 2 || !v.videoWidth) return false
      cover(b, v, v.videoWidth, v.videoHeight)
      return true
    }
    if (c.kind === 'image') {
      const m = this.project.media[c.mediaId]
      if (!m?.bitmap) return false
      b.fillStyle = palette().night
      b.fillRect(0, 0, OUT_W, OUT_H)
      b.save()
      if (c.kenBurns) kenBurns(b, lt, len, c.id)
      cover(b, m.bitmap, m.width, m.height)
      b.restore()
      return true
    }
    b.save()
    if (c.kenBurns) kenBurns(b, lt, len, c.id)
    // глобальное время — соседние клипы одного фона идут без шва
    drawBackground(b, c.preset, OUT_W, OUT_H, t)
    b.restore()
    return true
  }

  // ---------- Освобождение ----------

  destroy() {
    if (this.dead) return
    this.playing = false
    if (this.raf) cancelAnimationFrame(this.raf)
    if (this.drawRaf) cancelAnimationFrame(this.drawRaf)
    this.raf = 0
    this.drawRaf = 0
    this.stopMusic(false)
    for (const id of [...this.slots.keys()]) this.dropSlot(id)
    document.removeEventListener('visibilitychange', this.onVisibility)
    const g = this.graph
    this.graph = null
    if (g) {
      try {
        g.dest?.stream.getTracks().forEach((tr) => tr.stop())
      } catch {
        /* ignore */
      }
      g.ctx.close().catch(() => {})
    }
    this.musicBuf = null
    this.ticks.clear()
    this.subs.clear()
    this.onEnded = null
    this.dead = true
  }
}
