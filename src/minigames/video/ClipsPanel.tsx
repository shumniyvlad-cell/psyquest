// Вкладка «Клипы»: медиатека, живые фоны и таймлайн списком с настройками клипа.
import { useEffect, useRef, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Film,
  Image as ImageIcon,
  ImagePlus,
  LoaderCircle,
  Sparkles,
  Trash,
  Volume2,
  VolumeX,
  WandSparkles,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { BG_PRESETS, bgName, bgThumb } from './backgrounds'
import { Chips, SecInput, Switch } from './controls'
import {
  MAX_TOTAL_SEC,
  MIN_CLIP_SEC,
  STILL_MAX_SEC,
  STILL_MIN_SEC,
  type BgClip,
  type BgPreset,
  type Clip,
  type ImageClip,
  type MediaItem,
  type Timeline,
  type VideoClip,
} from './types'
import { prefersReducedMotion } from './hooks'
import { clamp, clipDuration, fmtClock, fmtSec, round1, shortName } from './util'

export type ClipPatch = Partial<{
  in: number
  out: number
  volume: number
  duration: number
  kenBurns: boolean
  preset: BgPreset
}>

interface ClipsPanelProps {
  clips: Clip[]
  media: Record<string, MediaItem>
  timeline: Timeline
  selected: string | null
  importing: { id: string; name: string }[]
  onSelect: (id: string | null) => void
  onPickFiles: () => void
  onAddBg: (preset: BgPreset) => void
  onMove: (id: string, dir: -1 | 1) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  /** edge — какой кадр показать в превью после правки */
  onPatch: (id: string, patch: ClipPatch, edge?: 'start' | 'end') => void
  onGoText: () => void
}

function clipTitle(c: Clip, media: Record<string, MediaItem>): string {
  if (c.kind === 'bg') return `Живой фон «${bgName(c.preset)}»`
  const m = media[c.mediaId]
  return m ? shortName(m.name, 34) : c.kind === 'video' ? 'Видео' : 'Фото'
}

function thumbOf(c: Clip, media: Record<string, MediaItem>): string {
  if (c.kind === 'bg') return bgThumb(c.preset)
  return media[c.mediaId]?.thumb ?? ''
}

export function ClipsPanel(p: ClipsPanelProps) {
  const { timeline } = p
  const over = timeline.total > MAX_TOTAL_SEC
  const usage = clamp(timeline.total / MAX_TOTAL_SEC, 0, 1)
  return (
    <div className="stack ve-stack">
      <section className="ve-card">
        <div className="ve-card-head">
          <h3 className="ve-h">Материалы</h3>
        </div>
        <Button variant="lit" block icon={<ImagePlus size={18} />} onClick={p.onPickFiles} sound="open">
          Добавить видео или фото
        </Button>
        <p className="field-hint">
          Файлы остаются на вашем устройстве — монтаж идёт прямо в браузере. Можно перетащить файлы в окно.
        </p>
        <div className="ve-sub">
          <Sparkles size={16} aria-hidden="true" />
          <span>Живой фон — для текстового рилса без съёмки</span>
        </div>
        <div className="ve-bgtiles">
          {BG_PRESETS.map((b) => (
            <button
              key={b.id}
              type="button"
              className="ve-bgtile"
              onClick={() => p.onAddBg(b.id)}
              title={b.hint}
              aria-label={`Добавить живой фон «${b.name}»`}
            >
              <img src={bgThumb(b.id)} alt="" draggable={false} />
              <span>{b.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ve-card">
        <div className="ve-card-head spread">
          <h3 className="ve-h">Таймлайн</h3>
          <span className={`num small ${over ? 'ember' : 'muted'}`}>
            {fmtClock(timeline.total)} из {fmtClock(MAX_TOTAL_SEC)}
          </span>
        </div>
        <div className={`bar ${over ? 'bar-ember' : usage > 0.85 ? '' : 'bar-mint'}`} role="presentation">
          <i style={{ width: `${usage * 100}%` }} />
        </div>
        {over ? (
          <p className="field-hint ember">
            Ролик длиннее 90 секунд: в файл попадут первые 90. Укоротите клипы или уберите лишние.
          </p>
        ) : null}

        {p.clips.length === 0 && p.importing.length === 0 ? (
          <div className="ve-emptycard">
            <p className="small muted">
              Пока пусто. Добавьте видео с телефона или начните с живого фона — текст можно собрать из готового сценария.
            </p>
            <Button variant="aurora" size="sm" icon={<WandSparkles size={16} />} onClick={p.onGoText}>
              Собрать из сценария
            </Button>
          </div>
        ) : null}

        <ul className="ve-clips">
          <AnimatePresence initial={false}>
            {p.clips.map((c, i) => (
              <ClipRow key={c.id} clip={c} index={i} count={p.clips.length} {...p} />
            ))}
          </AnimatePresence>
          {p.importing.map((it) => (
            <li key={it.id} className="ve-clip is-loading" aria-live="polite">
              <div className="ve-clip-head">
                <span className="ve-thumb">
                  <LoaderCircle size={18} className="ve-spin" aria-hidden="true" />
                </span>
                <span className="ve-clip-text">
                  <span className="ve-clip-title">{shortName(it.name, 34)}</span>
                  <span className="ve-clip-meta">Открываю файл…</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

interface RowProps extends ClipsPanelProps {
  clip: Clip
  index: number
  count: number
}

function ClipRow({ clip, index, count, media, selected, timeline, onSelect, onMove, onDuplicate, onRemove, onPatch }: RowProps) {
  const open = selected === clip.id
  const rowRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (open) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [open])
  const entry = timeline.entries[index]
  const start = entry?.start ?? 0
  const beyond = start >= MAX_TOTAL_SEC
  const m = clip.kind !== 'bg' ? media[clip.mediaId] : undefined
  const d = clipDuration(clip)
  const meta =
    clip.kind === 'video' && m
      ? `${fmtSec(d)} с из ${fmtSec(m.duration)}`
      : `${fmtSec(d)} с${clip.kind !== 'video' && clip.kenBurns ? ', зум' : ''}`
  const KindIcon = clip.kind === 'video' ? Film : clip.kind === 'image' ? ImageIcon : Sparkles
  const bodyId = `ve-clip-body-${clip.id}`
  return (
    <motion.li
      ref={rowRef}
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.22 }}
      className={`ve-clip${open ? ' is-open' : ''}${beyond ? ' is-beyond' : ''}`}
    >
      <div className="ve-clip-head">
        <button
          type="button"
          className="ve-clip-main"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onSelect(open ? null : clip.id)}
        >
          <span className="ve-thumb">
            {thumbOf(clip, media) ? <img src={thumbOf(clip, media)} alt="" draggable={false} /> : null}
            <span className="ve-kind" aria-hidden="true">
              <KindIcon size={12} />
            </span>
          </span>
          <span className="ve-clip-text">
            <span className="ve-clip-title">
              <span className="ve-clip-n num">{index + 1}</span>
              {clipTitle(clip, media)}
            </span>
            <span className="ve-clip-meta num">
              {meta}
              {beyond ? <span className="ember"> — за пределами 90 с</span> : null}
            </span>
          </span>
        </button>
        <div className="ve-clip-actions">
          <Button
            size="sm"
            variant="quiet"
            icon={<ArrowUp size={16} />}
            aria-label="Поднять выше"
            title="Поднять выше"
            disabled={index === 0}
            onClick={() => onMove(clip.id, -1)}
          />
          <Button
            size="sm"
            variant="quiet"
            icon={<ArrowDown size={16} />}
            aria-label="Опустить ниже"
            title="Опустить ниже"
            disabled={index === count - 1}
            onClick={() => onMove(clip.id, 1)}
          />
          <Button
            size="sm"
            variant="quiet"
            icon={<Copy size={16} />}
            aria-label="Дублировать"
            title="Дублировать"
            onClick={() => onDuplicate(clip.id)}
          />
          <Button
            size="sm"
            variant="quiet"
            className="ve-del"
            sound="whoosh"
            icon={<Trash size={16} />}
            aria-label="Удалить клип"
            title="Удалить клип"
            onClick={() => onRemove(clip.id)}
          />
        </div>
      </div>
      {open ? (
        <div className="ve-clip-body" id={bodyId}>
          {clip.kind === 'video' && m ? (
            <VideoSettings clip={clip} item={m} onPatch={onPatch} />
          ) : clip.kind === 'video' ? (
            <p className="field-hint">Файл этого клипа недоступен — удалите клип и добавьте видео заново.</p>
          ) : (
            <StillSettings clip={clip} onPatch={onPatch} />
          )}
        </div>
      ) : null}
    </motion.li>
  )
}

function VideoSettings({ clip, item, onPatch }: { clip: VideoClip; item: MediaItem; onPatch: ClipsPanelProps['onPatch'] }) {
  // ползунок с шагом 0,1 не дотянется до «кривой» длительности — работаем в десятых
  const D = item.duration >= 0.2 ? Math.floor(item.duration * 10) / 10 : item.duration
  const gap = Math.min(MIN_CLIP_SEC, D)
  const setIn = (v: number) => onPatch(clip.id, { in: clamp(round1(v), 0, Math.max(0, round1(clip.out - gap))) }, 'start')
  const setOut = (v: number) => onPatch(clip.id, { out: clamp(round1(v), Math.min(D, round1(clip.in + gap)), D) }, 'end')
  const lk = D > 0 ? clamp(clip.in / D, 0, 1) : 0
  const rk = D > 0 ? clamp(clip.out / D, 0, 1) : 1
  return (
    <div className="stack ve-stack-sm">
      <div className="ve-field-row">
        <span className="field-label">Фрагмент</span>
        <span className="small muted num">
          {fmtSec(clip.out - clip.in)} с
        </span>
      </div>
      <div className="ve-trim" style={{ '--lk': lk, '--rk': rk } as CSSProperties}>
        <div className="ve-trim-film" aria-hidden="true">
          {(item.filmstrip.length ? item.filmstrip : [item.thumb]).map((s, i) => (s ? <img key={i} src={s} alt="" draggable={false} /> : null))}
        </div>
        <div className="ve-trim-shade is-l" aria-hidden="true" />
        <div className="ve-trim-shade is-r" aria-hidden="true" />
        <div className="ve-trim-win" aria-hidden="true" />
        <input
          type="range"
          className="ve-trim-input"
          min={0}
          max={D}
          step={0.1}
          value={clip.in}
          style={{ zIndex: clip.in > D * 0.85 ? 4 : 3 }}
          aria-label="Начало фрагмента"
          aria-valuetext={`${fmtSec(clip.in)} с`}
          onChange={(e) => setIn(Number(e.target.value))}
        />
        <input
          type="range"
          className="ve-trim-input"
          min={0}
          max={D}
          step={0.1}
          value={clip.out}
          style={{ zIndex: clip.in > D * 0.85 ? 3 : 4 }}
          aria-label="Конец фрагмента"
          aria-valuetext={`${fmtSec(clip.out)} с`}
          onChange={(e) => setOut(Number(e.target.value))}
        />
      </div>
      <div className="ve-nums">
        <SecInput label="Начало" value={clip.in} onCommit={setIn} />
        <SecInput label="Конец" value={clip.out} onCommit={setOut} />
      </div>
      <div className="ve-field-row">
        <span className="field-label">Звук клипа</span>
        <span className="small muted num">{Math.round(clip.volume * 100)}%</span>
      </div>
      <div className="ve-range-row">
        <Button
          size="sm"
          variant="quiet"
          icon={clip.volume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
          aria-label={clip.volume > 0 ? 'Выключить звук клипа' : 'Включить звук клипа'}
          aria-pressed={clip.volume === 0}
          onClick={() => onPatch(clip.id, { volume: clip.volume > 0 ? 0 : 1 })}
        />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={clip.volume}
          aria-label="Громкость звука клипа"
          aria-valuetext={`${Math.round(clip.volume * 100)}%`}
          onChange={(e) => onPatch(clip.id, { volume: Number(e.target.value) })}
        />
      </div>
    </div>
  )
}

function StillSettings({ clip, onPatch }: { clip: ImageClip | BgClip; onPatch: ClipsPanelProps['onPatch'] }) {
  const setDur = (v: number) => onPatch(clip.id, { duration: clamp(round1(v), STILL_MIN_SEC, STILL_MAX_SEC) })
  return (
    <div className="stack ve-stack-sm">
      {clip.kind === 'bg' ? (
        <div className="stack ve-stack-xs">
          <span className="field-label">Фон</span>
          <Chips
            label="Живой фон"
            value={clip.preset}
            options={BG_PRESETS.map((b) => ({ id: b.id, name: b.name }))}
            onChange={(preset) => onPatch(clip.id, { preset })}
          />
        </div>
      ) : null}
      <div className="ve-field-row">
        <span className="field-label">Длительность</span>
        <span className="small faint">от 1 до 15 секунд</span>
      </div>
      <div className="ve-range-row">
        <input
          type="range"
          min={STILL_MIN_SEC}
          max={STILL_MAX_SEC}
          step={0.5}
          value={clip.duration}
          aria-label="Длительность, секунды"
          aria-valuetext={`${fmtSec(clip.duration)} с`}
          onChange={(e) => setDur(Number(e.target.value))}
        />
        <SecInput label="Длительность" hideLabel value={clip.duration} onCommit={setDur} step={0.5} />
      </div>
      <Switch
        checked={clip.kenBurns}
        onChange={(v) => onPatch(clip.id, { kenBurns: v })}
        hint="Медленное приближение с дрейфом — кадр оживает"
      >
        Лёгкий зум
      </Switch>
    </div>
  )
}
