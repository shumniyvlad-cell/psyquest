// Превью 9:16, транспорт и полоса таймлайна (она же перемотка).
import { useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { Pause, Play, Plus, ScanLine, SkipBack } from 'lucide-react'
import { Button } from '../../ui/Button'
import { bgThumb } from './backgrounds'
import type { ReelEngine } from './engine'
import { useEngineState, useEngineTick } from './hooks'
import {
  MAX_TOTAL_SEC,
  SAFE_BOTTOM,
  SAFE_RIGHT,
  SAFE_RIGHT_FROM,
  SAFE_TOP,
  type MediaItem,
  type TextSettings,
  type Timeline,
  type TimelineEntry,
} from './types'
import { clamp, entryAt, fmtTime } from './util'

const FILM_AT = [0.08, 0.3, 0.52, 0.74, 0.94]

function framesFor(e: TimelineEntry, media: Record<string, MediaItem>): string[] {
  const c = e.clip
  if (c.kind === 'bg') return [bgThumb(c.preset)]
  const m = media[c.mediaId]
  if (!m) return []
  if (c.kind === 'image' || !m.filmstrip.length) return m.thumb ? [m.thumb] : []
  const inside = m.filmstrip.filter((_, i) => {
    const at = (FILM_AT[i] ?? 0) * m.duration
    return at >= c.in - 0.3 && at <= c.out + 0.3
  })
  return inside.length ? inside : [m.thumb]
}

function SafeZones() {
  return (
    <div className="ve-safe" aria-hidden="true">
      <div className="ve-safe-band ve-safe-top" style={{ height: `${SAFE_TOP * 100}%` }}>
        <span>Шапка соцсети</span>
      </div>
      <div
        className="ve-safe-band ve-safe-right"
        style={{ top: `${SAFE_RIGHT_FROM * 100}%`, bottom: `${SAFE_BOTTOM * 100}%`, width: `${SAFE_RIGHT * 100}%` }}
      >
        <span>Кнопки</span>
      </div>
      <div className="ve-safe-band ve-safe-bottom" style={{ height: `${SAFE_BOTTOM * 100}%` }}>
        <span>Подпись и музыка</span>
      </div>
    </div>
  )
}

export interface StageProps {
  engine: ReelEngine | null
  canvasRef: RefObject<HTMLCanvasElement | null>
  stageRef: RefObject<HTMLDivElement | null>
  timeline: Timeline
  media: Record<string, MediaItem>
  text: TextSettings
  selected: string | null
  busy: boolean
  recording: 'recording' | 'paused' | 'finishing' | null
  onSelect: (id: string) => void
  onToggle: () => void
  onToggleSafe: () => void
  onAddClip: () => void
}

export function Stage(p: StageProps) {
  const empty = p.timeline.entries.length === 0
  return (
    <section className="ve-left" aria-label="Превью ролика">
      <div className="ve-stage" ref={p.stageRef}>
        <div className="ve-frame">
          <canvas
            ref={p.canvasRef}
            className="ve-canvas"
            width={720}
            height={1280}
            role="img"
            aria-label="Кадр ролика 9:16"
            onClick={() => {
              if (!empty && !p.busy) p.onToggle()
            }}
          />
          {p.text.safeZones && !p.recording ? <SafeZones /> : null}
          {empty ? (
            <div className="ve-empty">
              <p className="display t-20">Здесь появится ваш рилс</p>
              <p className="small muted">Добавьте видео, фото или живой фон</p>
              <Button size="sm" variant="ghost" icon={<Plus size={16} />} onClick={p.onAddClip}>
                Добавить клип
              </Button>
            </div>
          ) : null}
          {p.recording ? (
            <div className={`ve-rec${p.recording === 'paused' ? ' is-paused' : ''}`} role="status">
              <i aria-hidden="true" />
              {p.recording === 'paused' ? 'Запись на паузе' : p.recording === 'finishing' ? 'Сохраняю файл' : 'Идёт запись'}
            </div>
          ) : null}
        </div>
      </div>
      <Transport {...p} />
      <Strip {...p} />
    </section>
  )
}

function Transport({ engine, timeline, busy, text, onToggle, onToggleSafe }: StageProps) {
  const { playing } = useEngineState(engine)
  const timeRef = useRef<HTMLSpanElement>(null)
  useEngineTick(engine, (t) => {
    if (timeRef.current) timeRef.current.textContent = fmtTime(t)
  })
  const disabled = !engine || timeline.duration <= 0.05 || busy
  return (
    <div className="ve-transport">
      <Button
        variant="quiet"
        size="sm"
        icon={<SkipBack size={18} />}
        aria-label="В начало"
        title="В начало"
        disabled={disabled}
        onClick={() => engine?.seek(0)}
      />
      <Button
        variant="lit"
        className="ve-play"
        sound={false}
        icon={playing ? <Pause size={20} /> : <Play size={20} />}
        aria-label={playing ? 'Пауза' : 'Смотреть'}
        title={playing ? 'Пауза (пробел)' : 'Смотреть (пробел)'}
        disabled={disabled}
        onClick={onToggle}
      />
      <div className="ve-time num">
        <span ref={timeRef}>0:00,0</span>
        <span className="faint"> / {fmtTime(timeline.duration)}</span>
      </div>
      <span className="grow" />
      <button
        type="button"
        className="chip ve-safe-chip"
        aria-pressed={text.safeZones}
        aria-label="Безопасные зоны"
        onClick={onToggleSafe}
        title="Показать зоны, которые закроет интерфейс соцсети"
      >
        <ScanLine size={16} aria-hidden="true" />
        <span className="ve-safe-label">Безопасные зоны</span>
      </button>
    </div>
  )
}

function Strip({ engine, timeline, media, text, selected, busy, onSelect, onToggle }: StageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const scale = Math.max(timeline.total, 1)
  const dur = timeline.duration
  const pct = (v: number) => `${clamp(v / scale, 0, 1) * 100}%`

  useEngineTick(engine, (t) => {
    if (headRef.current) headRef.current.style.transform = `translateX(${clamp(t / scale, 0, 1) * 100}%)`
    const el = ref.current
    if (el) {
      el.setAttribute('aria-valuenow', String(Math.round(t * 10) / 10))
      el.setAttribute('aria-valuetext', `${fmtTime(t)} из ${fmtTime(dur)}`)
    }
  })

  const seekAt = (clientX: number): number => {
    const el = ref.current
    if (!el || !engine) return 0
    const r = el.getBoundingClientRect()
    const t = Math.min(clamp((clientX - r.left) / Math.max(1, r.width), 0, 1) * scale, dur)
    engine.seek(t)
    return t
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!engine || busy || dur <= 0 || e.button > 0) return
    const el = e.currentTarget
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const wasPlaying = engine.isPlaying
    if (wasPlaying) engine.pause()
    const t0 = seekAt(e.clientX)
    const hit = entryAt(timeline.entries, t0)
    if (hit) onSelect(hit.clip.id)
    const move = (ev: globalThis.PointerEvent) => {
      seekAt(ev.clientX)
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      if (wasPlaying) engine.play()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!engine || busy || dur <= 0) return
    const step = e.shiftKey ? 5 : 1
    let t: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') t = engine.time + step
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') t = engine.time - step
    else if (e.key === 'Home') t = 0
    else if (e.key === 'End') t = dur
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onToggle()
      return
    }
    if (t === null) return
    e.preventDefault()
    engine.seek(clamp(t, 0, dur))
  }

  const over = timeline.total > MAX_TOTAL_SEC
  return (
    <div
      ref={ref}
      className={`ve-strip${busy ? ' is-busy' : ''}`}
      role="slider"
      tabIndex={dur > 0 ? 0 : -1}
      aria-label="Таймлайн ролика"
      aria-valuemin={0}
      aria-valuemax={Math.round(dur * 10) / 10}
      aria-disabled={dur <= 0 || busy}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <div className="ve-strip-clips">
        {timeline.entries.length === 0 ? <div className="ve-strip-empty">Таймлайн пуст</div> : null}
        {timeline.entries.map((e) => (
          <div
            key={e.clip.id}
            className={`ve-seg is-${e.clip.kind}${selected === e.clip.id ? ' is-sel' : ''}`}
            style={{ width: pct(e.end - e.start) }}
          >
            {framesFor(e, media).map((src, i) => (
              <img key={i} src={src} alt="" draggable={false} />
            ))}
          </div>
        ))}
        {over ? <div className="ve-over" style={{ left: pct(MAX_TOTAL_SEC) }} title="Дальше 90 секунд в ролик не попадёт" /> : null}
      </div>
      <div className="ve-strip-text" aria-hidden="true">
        {text.hook.trim() && dur > 0 ? (
          <i className="ve-tb is-hook" style={{ left: 0, width: pct(Math.min(text.hookSec, dur)) }} />
        ) : null}
        {text.captions.map((c) =>
          c.text.trim() && c.start < scale ? (
            <i key={c.id} className="ve-tb" style={{ left: pct(c.start), width: pct(Math.min(c.end, scale) - c.start) }} />
          ) : null,
        )}
      </div>
      <div className="ve-playhead" ref={headRef} aria-hidden="true">
        <i />
      </div>
    </div>
  )
}
