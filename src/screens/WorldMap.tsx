import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { HeroFigure } from '../art/HeroFigure'
import { PlaceIcon, type PlaceId } from '../art/icons'
import { mulberry32 } from '../art/rng'
import { playTheme, sfx } from '../audio/engine'
import { CHAPTER_META, ROUTE_ORDER } from '../game/chapterMeta'
import { pickEvent } from '../game/events'
import { hasFull, lanternOf, useGame, useSeasonClients } from '../game/store'
import type { ChapterId } from '../game/types'
import { Button } from '../ui/Button'
import { isInstantNow } from '../ui/useInstant'
import { EventCard } from '../systems/EventCard'
import { Dock, Hud } from '../systems/Hud'
import './map.css'

const W = 900
const H = 2600

// Точки маршрута: хижина, 8 глав и Врата между Лесом и Кузницей
type Stop = { id: PlaceId; x: number; y: number; chapter?: ChapterId }
const STOPS: Stop[] = [
  { id: 'camp', x: 450, y: 2440 },
  { id: 'doubt', x: 250, y: 2170, chapter: 'doubt' },
  { id: 'forest', x: 630, y: 1920, chapter: 'forest' },
  { id: 'gate', x: 470, y: 1755 },
  { id: 'forge', x: 270, y: 1590, chapter: 'forge' },
  { id: 'tower', x: 650, y: 1330, chapter: 'tower' },
  { id: 'studio', x: 270, y: 1070, chapter: 'studio' },
  { id: 'launch', x: 620, y: 810, chapter: 'launch' },
  { id: 'arena', x: 320, y: 565, chapter: 'arena' },
  { id: 'lighthouse', x: 560, y: 250, chapter: 'lighthouse' },
]
const nodeToStop = (node: number) => (node <= 2 ? node : node + 1)

const BIOME: Record<string, string> = {
  camp: '#3f6b4f',
  doubt: '#6d5f9a',
  forest: '#1f6b5a',
  gate: '#b98a3a',
  forge: '#c4521f',
  tower: '#2a8fb0',
  studio: '#9a3fa6',
  launch: '#c9902c',
  arena: '#c0502e',
  lighthouse: '#2d5f9e',
}

function segments(points: Stop[]): string[] {
  const segs: string[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    segs.push(`M${p1.x} ${p1.y} C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`)
  }
  return segs
}

function useDecor() {
  return useMemo(() => {
    const r = mulberry32(7)
    const stars = Array.from({ length: 90 }, () => ({ x: r() * W, y: r() * 900, s: 0.6 + r() * 1.6, d: r() * 4 }))
    const pines: { x: number; y: number; h: number }[] = []
    for (let i = 0; i < 70; i++) {
      const y = 1500 + r() * 900
      const x = r() * W
      const nearPath = STOPS.some((p) => Math.hypot(p.x - x, p.y - y) < 120)
      if (!nearPath) pines.push({ x, y, h: 26 + r() * 34 })
    }
    const rocks = Array.from({ length: 26 }, () => ({ x: r() * W, y: 380 + r() * 1300, w: 20 + r() * 50 }))
      .filter((k) => !STOPS.some((p) => Math.hypot(p.x - k.x, p.y - k.y) < 110))
    const fireflies = Array.from({ length: 22 }, () => ({ x: r() * W, y: 1200 + r() * 1350, d: r() * 6, fx: (r() - 0.5) * 60, fy: -20 - r() * 40 }))
    return { stars, pines, rocks, fireflies }
  }, [])
}

export function WorldMap() {
  const chapters = useGame((s) => s.chapters)
  const mapNode = useGame((s) => s.mapNode)
  const full = useGame(hasFull)
  const light = useGame((s) => lanternOf(s).color)
  const level = useGame((s) => s.level)
  const goal = useGame((s) => s.goal)
  const clients = useSeasonClients()
  const pendingEvent = useGame((s) => s.pendingEvent)
  const decor = useDecor()
  const segs = useMemo(() => segments(STOPS), [])
  const segRefs = useRef<(SVGPathElement | null)[]>([])
  const heroRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [walking, setWalking] = useState(false)

  useEffect(() => {
    playTheme('map')
  }, [])

  // герой на текущей точке
  const placeHero = (x: number, y: number) => {
    const el = heroRef.current
    if (!el) return
    el.style.left = `${(x / W) * 100}%`
    el.style.top = `${(y / H) * 100}%`
  }
  useEffect(() => {
    const st = STOPS[nodeToStop(mapNode)]
    placeHero(st.x, st.y)
  }, [mapNode])

  // прокрутка к герою при входе
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const st = STOPS[nodeToStop(useGame.getState().mapNode)]
    const inner = el.firstElementChild as HTMLElement | null
    const h = inner?.offsetHeight ?? 0
    el.scrollTop = Math.max(0, (st.y / H) * h - el.clientHeight * 0.6)
  }, [])

  const frontier = useMemo(() => {
    let last = 0
    ROUTE_ORDER.forEach((id, i) => {
      if (chapters[id].status !== 'locked') last = i + 1
    })
    return last
  }, [chapters])
  const frontierY = STOPS[nodeToStop(Math.min(8, frontier))].y

  const walkTo = (node: number, then: () => void) => {
    const from = nodeToStop(useGame.getState().mapNode)
    const to = nodeToStop(node)
    if (from === to) return then()
    const dir = to > from ? 1 : -1
    const chain: { el: SVGPathElement; rev: boolean }[] = []
    for (let i = from; i !== to; i += dir) {
      const segIdx = dir > 0 ? i : i - 1
      const el = segRefs.current[segIdx]
      if (el) chain.push({ el, rev: dir < 0 })
    }
    const lengths = chain.map((c) => c.el.getTotalLength())
    const total = lengths.reduce((a, b) => a + b, 0)
    if (isInstantNow()) {
      const st = STOPS[to]
      placeHero(st.x, st.y)
      useGame.getState().moveTo(node)
      then()
      return
    }
    const duration = Math.min(3200, Math.max(700, total * 2.6))
    const t0 = performance.now()
    let lastStep = 0
    setWalking(true)
    const frame = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      let dist = e * total
      let i = 0
      while (i < chain.length - 1 && dist > lengths[i]) {
        dist -= lengths[i]
        i++
      }
      const c = chain[i]
      const L = lengths[i]
      const p = c.el.getPointAtLength(c.rev ? L - dist : dist)
      placeHero(p.x, p.y)
      if (e * total - lastStep > 38) {
        lastStep = e * total
        sfx('step')
      }
      if (k < 1) requestAnimationFrame(frame)
      else {
        setWalking(false)
        useGame.getState().moveTo(node)
        then()
      }
    }
    requestAnimationFrame(frame)
  }

  const statusOf = (node: number) => {
    if (node === 0) return 'done'
    const id = ROUTE_ORDER[node - 1]
    return chapters[id].status
  }

  const onNode = (node: number) => {
    if (walking) return
    const status = statusOf(node)
    if (status === 'locked') {
      sfx('lock')
      const prev = ROUTE_ORDER[node - 2]
      useGame.getState().toast(prev ? `Сначала пройди «${CHAPTER_META[prev].name}»` : 'Эта земля пока в тумане', 'warn')
      return
    }
    sfx('select')
    const wasAt = useGame.getState().mapNode
    walkTo(node, () => {
      if (node !== wasAt && node > 0 && Math.random() < 0.4) {
        const st = useGame.getState()
        const ev = pickEvent(st.seenEvents)
        if (ev) {
          st.setPendingEvent(ev.id)
          setSelected(node)
          return
        }
      }
      setSelected(node === 0 ? null : node)
    })
  }

  const sel = selected !== null && selected > 0 ? ROUTE_ORDER[selected - 1] : null

  return (
    <div className="screen wm">
      <Hud />
      <div className="wm-scroll scroll" ref={scrollRef}>
        <div className="wm-world">
          <svg className="wm-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
              <linearGradient id="wm-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0a0f2e" />
                <stop offset="0.16" stopColor="#15224e" />
                <stop offset="0.2" stopColor="#1a3560" />
                <stop offset="0.5" stopColor="#141b44" />
                <stop offset="1" stopColor="#12233a" />
              </linearGradient>
              <linearGradient id="wm-sea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1b3a6b" />
                <stop offset="1" stopColor="#0d1a3a" />
              </linearGradient>
              <linearGradient id="wm-fog" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0e1330" stopOpacity="0.92" />
                <stop offset="0.8" stopColor="#1c2150" stopOpacity="0.78" />
                <stop offset="1" stopColor="#1c2150" stopOpacity="0" />
              </linearGradient>
              {STOPS.map((s) => (
                <radialGradient key={s.id} id={`wm-b-${s.id}`}>
                  <stop offset="0" stopColor={BIOME[s.id]} stopOpacity="0.55" />
                  <stop offset="1" stopColor={BIOME[s.id]} stopOpacity="0" />
                </radialGradient>
              ))}
              <radialGradient id="wm-glow">
                <stop offset="0" stopColor="#ffd68a" stopOpacity="0.9" />
                <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill="url(#wm-sky)" />
            {decor.stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#f2e8d5" className={i % 4 === 0 ? 'wm-twinkle' : undefined} style={{ animationDelay: `${s.d}s` }} opacity={0.7} />
            ))}
            {/* море у Маяка */}
            <path d={`M0 330 Q 220 300 450 330 T 900 320 L900 520 Q 650 560 450 520 T 0 540 Z`} fill="url(#wm-sea)" opacity="0.85" />
            {[350, 390, 430, 470].map((y, i) => (
              <path key={y} d={`M${40 + i * 30} ${y} q 30 -8 60 0 t 60 0`} stroke="#9ff0ff" strokeOpacity="0.18" fill="none" strokeWidth="2" className="wm-wave" style={{ animationDelay: `${i * 0.7}s` }} />
            ))}
            {/* биомы */}
            {STOPS.map((s) => (
              <ellipse key={s.id} cx={s.x} cy={s.y} rx={260} ry={200} fill={`url(#wm-b-${s.id})`} />
            ))}
            {/* холмы-силуэты */}
            <path d="M0 2600 L0 2330 Q 160 2270 320 2330 T 640 2300 T 900 2320 L900 2600 Z" fill="#0f2a2a" opacity="0.8" />
            <path d="M0 2080 Q 200 1990 380 2060 T 900 2010 L900 2140 Q 600 2180 400 2130 T 0 2160 Z" fill="#101b3a" opacity="0.55" />
            {decor.rocks.map((k, i) => (
              <path key={i} d={`M${k.x - k.w / 2} ${k.y} L${k.x - k.w / 5} ${k.y - k.w * 0.55} L${k.x + k.w / 4} ${k.y - k.w * 0.4} L${k.x + k.w / 2} ${k.y} Z`} fill="#0b1026" opacity="0.7" />
            ))}
            {decor.pines.map((p, i) => (
              <path key={i} d={`M${p.x} ${p.y - p.h} L${p.x + p.h * 0.32} ${p.y} L${p.x - p.h * 0.32} ${p.y} Z`} fill="#0a1a24" opacity="0.85" />
            ))}
            {decor.fireflies.map((f, i) => (
              <circle
                key={i}
                cx={f.x}
                cy={f.y}
                r={2.2}
                fill="#ffe7a8"
                className="wm-firefly"
                style={{ animationDelay: `${f.d}s`, ['--fx' as string]: `${f.fx}px`, ['--fy' as string]: `${f.fy}px` }}
              />
            ))}
            {/* тропа */}
            {segs.map((d, i) => {
              const reached = i < nodeToStop(Math.min(8, frontier))
              return (
                <g key={i}>
                  <path d={d} stroke="#05081a" strokeOpacity="0.5" strokeWidth="14" fill="none" strokeLinecap="round" />
                  <path
                    ref={(el) => {
                      segRefs.current[i] = el
                    }}
                    d={d}
                    stroke={reached ? '#ffd68a' : '#8e8bb8'}
                    strokeOpacity={reached ? 0.85 : 0.35}
                    strokeWidth="4"
                    strokeDasharray="2 12"
                    strokeLinecap="round"
                    fill="none"
                    className={reached ? 'wm-path-lit' : undefined}
                  />
                </g>
              )
            })}
            {/* маяк на вершине — луч, если цель близко */}
            <circle cx={560} cy={250} r={120} fill="url(#wm-glow)" opacity={Math.min(1, clients.length / Math.max(1, goal?.clients ?? 10))} />
            {/* туман над неоткрытым */}
            <rect x="0" y="0" width={W} height={Math.max(0, frontierY - 60)} fill="url(#wm-fog)" className="wm-fogrect" />
          </svg>

          {STOPS.map((s, stopIdx) => {
            if (s.id === 'gate') {
              return (
                <button
                  key="gate"
                  className={`wm-gate ${full ? 'is-open' : ''}`}
                  style={{ left: `${(s.x / W) * 100}%`, top: `${(s.y / H) * 100}%` }}
                  onClick={() => {
                    if (full) {
                      useGame.getState().toast('Врата открыты. Путь свободен.', 'info')
                      return
                    }
                    sfx('lock')
                    useGame.getState().openPanel('paywall')
                  }}
                  aria-label={full ? 'Врата Мастерства открыты' : 'Врата Мастерства — открыть полный путь'}
                >
                  <PlaceIcon id="gate" lit={full} size={58} />
                  <span className="wm-label">{full ? 'Врата открыты' : 'Врата Мастерства'}</span>
                  {!full ? <Lock size={14} className="wm-lock" /> : null}
                </button>
              )
            }
            const node = stopIdx <= 2 ? stopIdx : stopIdx - 1
            const status = statusOf(node)
            const meta = s.chapter ? CHAPTER_META[s.chapter] : null
            const gated = meta && !meta.free && !full
            const isNext = status === 'available' || status === 'active'
            return (
              <button
                key={s.id}
                className={`wm-node is-${status} ${isNext ? 'is-next' : ''} ${mapNode === node ? 'is-here' : ''}`}
                style={{ left: `${(s.x / W) * 100}%`, top: `${(s.y / H) * 100}%` }}
                onClick={() => onNode(node)}
                aria-label={`${meta?.name ?? 'Хижина Фонарщика'}${status === 'locked' ? ', закрыто' : status === 'done' ? ', пройдено' : ''}`}
              >
                <span className="wm-medal">
                  <PlaceIcon id={s.id} lit={status !== 'locked'} size={64} />
                  {status === 'done' && node > 0 ? (
                    <span className="wm-badge is-done">
                      <Check size={12} />
                    </span>
                  ) : null}
                  {gated && status !== 'locked' ? (
                    <span className="wm-badge is-lock">
                      <Lock size={11} />
                    </span>
                  ) : null}
                </span>
                {isNext && frontier === 1 && node === 1 ? <span className="wm-hint">Начни отсюда</span> : null}
                <span className="wm-label">
                  {meta?.name ?? 'Хижина Фонарщика'}
                  {s.chapter === 'lighthouse' && goal ? <span className="wm-sub"> {clients.length} из {goal.clients}</span> : null}
                </span>
              </button>
            )
          })}

          <div
            className="wm-hero"
            ref={heroRef}
            aria-hidden="true"
            style={{ left: `${(STOPS[nodeToStop(mapNode)].x / W) * 100}%`, top: `${(STOPS[nodeToStop(mapNode)].y / H) * 100}%` }}
          >
            <HeroFigure light={light} level={level} pose={walking ? 'walk' : 'idle'} size={70} />
          </div>
        </div>
      </div>

      {sel ? <PlaceCard chapter={sel} onClose={() => setSelected(null)} /> : null}
      <Dock />
      {pendingEvent ? <EventCard id={pendingEvent} /> : null}
    </div>
  )
}

function PlaceCard({ chapter, onClose }: { chapter: ChapterId; onClose: () => void }) {
  const meta = CHAPTER_META[chapter]
  const st = useGame((s) => s.chapters[chapter])
  const route = useGame((s) => s.plan?.route.find((r) => r.chapter === chapter))
  const full = useGame(hasFull)
  const gated = !meta.free && !full
  const startChapter = useGame((s) => s.startChapter)
  return (
    <div className="wm-card panel anim-rise" role="dialog" aria-label={meta.name}>
      <div className="spread">
        <div className="stack" style={{ gap: 4 }}>
          <h2 className="display t-25">{meta.name}</h2>
          <p className="small muted">{meta.short}</p>
        </div>
        <PlaceIcon id={meta.place} lit size={56} />
      </div>
      <p className="small">
        <span className="faint">Что заберёшь в жизнь: </span>
        {meta.outcome}
      </p>
      <div className="row-wrap tiny faint">
        {route ? <span className="badge">Неделя {route.week}</span> : null}
        {route?.mode === 'express' ? <span className="badge badge-mint">Быстрый проход — у тебя это уже есть</span> : null}
        {st.status === 'done' ? <span className="badge badge-mint">Пройдено</span> : null}
        {gated ? <span className="badge badge-ink">Нужен полный путь</span> : null}
      </div>
      <div className="row-wrap">
        {gated ? (
          <Button variant="lit" onClick={() => useGame.getState().openPanel('paywall')}>
            Открыть полный путь
          </Button>
        ) : (
          <Button variant="lit" onClick={() => startChapter(chapter)}>
            {st.status === 'done' ? (chapter === 'lighthouse' ? 'Подняться к Маяку' : 'Пройти ещё раз') : st.step > 0 ? 'Продолжить' : 'Войти'}
          </Button>
        )}
        <Button variant="quiet" onClick={onClose}>
          Остаться на тропе
        </Button>
      </div>
    </div>
  )
}
