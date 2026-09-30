import { useId } from 'react'
import { cx } from './useCalm'

interface StormCloudProps {
  /** 0 — Буря рассеялась, 1 — в полную силу */
  level: number
  /** Доля собранных заявок 0..1 — зажигает окна на площади */
  progress: number
  /** Меняется — бьёт молния */
  flash: number
  calm?: boolean
}

// Сцена шире, чем выше: на широком экране видна вся площадь, на узком — центр с тучей.
const W = 800
const H = 240
const CX = W / 2

// детерминированный «шум» для звёзд и домов
const noise = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const STARS = Array.from({ length: 34 }, (_, i) => ({
  x: Math.round(noise(i) * W),
  y: Math.round(8 + noise(i + 50) * 110),
  r: 0.7 + noise(i + 100) * 0.8,
}))

interface House {
  x: number
  w: number
  roof: number
}
const HOUSES: House[] = (() => {
  const out: House[] = []
  let x = -6
  for (let i = 0; x < W; i++) {
    const w = 30 + Math.round(noise(i + 200) * 18)
    const roof = 208 - Math.round(8 + noise(i + 300) * 26)
    out.push({ x, w, roof })
    x += w - 2
  }
  return out
})()

// окна зажигаются от центра к краям — на телефоне прогресс виден сразу
const WINDOWS = HOUSES.map((h, i) => ({
  x: h.x + h.w / 2 - 3.5,
  y: h.roof + 14 + (i % 2) * 8,
  d: Math.abs(h.x + h.w / 2 - CX),
})).sort((a, b) => a.d - b.d)

const PUFFS: [number, number, number][] = [
  [-104, 14, 24], [-70, 2, 36], [-28, -20, 46], [26, -18, 44], [74, 2, 34], [108, 14, 23],
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function StormCloud({ level, progress, flash, calm }: StormCloudProps) {
  const raw = useId()
  const id = `ls${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const lv = clamp01(level)
  const spread = (1 - lv) * 34
  const scale = 0.84 + lv * 0.44
  const eyes = clamp01((lv - 0.48) * 2.4)
  const rain = clamp01((lv - 0.32) * 2)
  const lit = Math.round(clamp01(progress) * WINDOWS.length)
  const angry = lv > 0.74 && !calm

  return (
    <svg className="ls-storm" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(lv)} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#ffd68a" stopOpacity="0.8" />
          <stop offset="40%" stopColor="#ffb547" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-dark`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a3a86" />
          <stop offset="55%" stopColor="#2a1d57" />
          <stop offset="100%" stopColor="#170f33" />
        </linearGradient>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2dcf5" />
          <stop offset="100%" stopColor="#8e8bb8" />
        </linearGradient>
        <filter id={`${id}-soft`} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <filter id={`${id}-bolt`} x="-100%" y="-20%" width="300%" height="140%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="ls-storm-stars" style={{ opacity: 0.12 + (1 - lv) * 0.88 }}>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#f2e8d5" style={{ animationDelay: `${(i % 7) * 0.5}s` }} />
        ))}
      </g>

      <ellipse
        cx={CX}
        cy={H + 20}
        rx={W * 0.55}
        ry={150}
        fill={`url(#${id}-glow)`}
        className="ls-storm-glow"
        style={{ opacity: 0.2 + (1 - lv) * 0.8 }}
      />

      <g className="ls-storm-rain" style={{ opacity: rain }} aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => {
          const x = CX - 110 + i * 13 + (i % 3) * 3
          return (
            <line
              key={i}
              x1={x}
              y1={146 + (i % 4) * 6}
              x2={x - 7}
              y2={172 + (i % 4) * 6}
              style={{ animationDelay: `${(i % 6) * 0.13}s` }}
            />
          )
        })}
      </g>

      <g transform={`translate(${CX} 100)`}>
        <g className="ls-storm-cloud" style={{ transform: `scale(${scale})` }}>
          <g filter={`url(#${id}-soft)`}>
            <ellipse cx="0" cy="18" rx="118" ry="30" fill={`url(#${id}-dark)`} style={{ opacity: 0.4 + lv * 0.6 }} />
            {PUFFS.map(([x, y, r], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={r}
                fill={`url(#${id}-dark)`}
                className="ls-storm-puff"
                style={{ transform: `translate(${Math.sign(x) * spread}px, ${-spread * 0.25}px)`, opacity: 0.3 + lv * 0.7 }}
              />
            ))}
          </g>
          {/* светлый слой проступает, когда туча слабеет */}
          <g style={{ opacity: (1 - lv) * 0.6 }} className="ls-storm-fade">
            {PUFFS.map(([x, y, r], i) => (
              <circle
                key={i}
                cx={x}
                cy={y - 4}
                r={r * 0.8}
                fill={`url(#${id}-light)`}
                className="ls-storm-puff"
                style={{ transform: `translate(${Math.sign(x) * spread * 1.2}px, ${-spread * 0.3}px)` }}
              />
            ))}
          </g>
          <g className={cx('ls-storm-eyes', angry && 'is-angry')} style={{ opacity: eyes }}>
            <path d="M-40 8 Q-28 0 -16 8 Q-28 12 -40 8 Z" fill="#ff6b5a" />
            <path d="M16 8 Q28 0 40 8 Q28 12 16 8 Z" fill="#ff6b5a" />
            <path d="M-44 -4 L-14 2" stroke="#120b26" strokeWidth="4" strokeLinecap="round" />
            <path d="M44 -4 L14 2" stroke="#120b26" strokeWidth="4" strokeLinecap="round" />
          </g>
        </g>
      </g>

      <g
        key={flash}
        className={cx('ls-storm-bolt', flash > 0 && !calm && 'is-strike', angry && 'is-idle')}
        filter={`url(#${id}-bolt)`}
      >
        <path d={`M${CX + 24} 132 L${CX + 6} 164 L${CX + 22} 166 L${CX - 2} 208`} />
        <path d={`M${CX - 34} 134 L${CX - 44} 154 L${CX - 34} 155 L${CX - 46} 178`} className="ls-storm-bolt-small" />
      </g>

      <g className="ls-storm-town">
        {HOUSES.map((h, i) => (
          <path
            key={i}
            d={`M${h.x} ${h.roof + 10} L${h.x + h.w / 2} ${h.roof - 6} L${h.x + h.w} ${h.roof + 10} L${h.x + h.w} ${H} L${h.x} ${H} Z`}
          />
        ))}
        {WINDOWS.map((w, i) => (
          <rect key={i} x={w.x} y={w.y} width="7" height="9" rx="1.5" className={i < lit ? 'is-lit' : ''} />
        ))}
      </g>
    </svg>
  )
}

function describe(lv: number) {
  if (lv > 0.75) return 'Буря Хаоса в полную силу: туча чёрная, сверкают молнии'
  if (lv > 0.5) return 'Буря сгущается: туча тяжелеет, идёт дождь'
  if (lv > 0.25) return 'Буря слабеет: в туче появились просветы'
  return 'Буря рассеялась: над площадью видны звёзды'
}
