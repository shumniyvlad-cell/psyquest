import { useId } from 'react'

interface EmberDemonProps {
  /** 1 — в полной силе, 0 — рассеялся */
  power: number
  /** Меняется — демон вспыхивает (красная зона) */
  flare: number
  won?: boolean
  calm?: boolean
}

const SMOKE: [number, number, number, number][] = [
  [120, 70, 46, 30],
  [240, 64, 50, 32],
  [180, 40, 60, 34],
  [96, 150, 40, 26],
  [268, 150, 42, 26],
]

const SPARKS: [number, number][] = [
  [132, 196], [150, 176], [172, 206], [190, 186], [210, 200], [228, 180], [118, 170], [246, 196], [160, 150], [204, 146],
]

const FIREFLIES: [number, number][] = [
  [120, 150], [150, 110], [184, 90], [214, 120], [244, 146], [170, 170], [200, 160],
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function EmberDemon({ power, flare, won, calm }: EmberDemonProps) {
  const raw = useId()
  const id = `bl${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const p = won ? 0 : clamp01(power)
  const body = won ? 0.06 : 0.3 + p * 0.7
  const cracks = 0.2 + p * 0.8
  const sparks = Math.round(p * SPARKS.length)
  const scale = 0.84 + p * 0.16

  return (
    <svg className="bl-demon" viewBox="0 0 360 240" role="img" aria-label={label(p, !!won)}>
      <defs>
        <radialGradient id={`${id}-aura`} cx="50%" cy="58%" r="55%">
          <stop offset="0%" stopColor="#ff6b5a" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#d9822b" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#d9822b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2240" />
          <stop offset="60%" stopColor="#1d1128" />
          <stop offset="100%" stopColor="#0e0818" />
        </linearGradient>
        <linearGradient id={`${id}-crack`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd68a" />
          <stop offset="55%" stopColor="#ffb547" />
          <stop offset="100%" stopColor="#ff6b5a" />
        </linearGradient>
        <radialGradient id={`${id}-eye`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#fff3d6" />
          <stop offset="45%" stopColor="#ffb547" />
          <stop offset="100%" stopColor="#ff6b5a" />
        </radialGradient>
        <radialGradient id={`${id}-core`} cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor="#ff8a3d" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#d9362a" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#d9362a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-heat`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb547" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ff6b5a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-maw`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3d6" />
          <stop offset="40%" stopColor="#ffb547" />
          <stop offset="100%" stopColor="#d9362a" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-smoke`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      <ellipse cx="180" cy="150" rx="170" ry="110" fill={`url(#${id}-aura)`} className="bl-aura" style={{ opacity: 0.15 + p * 0.85 }} />

      <g filter={`url(#${id}-smoke)`} className="bl-smoke" style={{ opacity: 0.1 + p * 0.55 }}>
        {SMOKE.map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill="#6b5a7e" style={{ animationDelay: `${i * 1.3}s` }} />
        ))}
      </g>

      <g key={flare} className={flare > 0 && !calm ? 'bl-figure is-flare' : 'bl-figure'}>
        <g style={{ transform: `scale(${scale})`, opacity: body }} className="bl-figure-inner">
          <ellipse cx="180" cy="236" rx="112" ry="16" fill={`url(#${id}-heat)`} className="bl-heat" />
          {/* силуэт: корона из языков пламени, плечи-всполохи, рваный низ из дыма */}
          <path
            d="M180 26 C186 42 196 50 204 54 C206 42 212 34 222 28 C220 48 226 64 232 78 C246 102 250 126 252 146 C266 158 284 168 300 166 C290 182 272 190 262 196 C270 212 280 224 292 236 C264 232 246 240 228 234 C212 242 196 238 180 244 C164 238 148 242 132 234 C114 240 96 232 68 236 C80 224 90 212 98 196 C88 190 70 182 60 166 C76 168 94 158 108 146 C110 126 114 102 128 78 C134 64 140 48 138 28 C148 34 154 42 156 54 C164 50 174 42 180 26 Z"
            fill={`url(#${id}-body)`}
            stroke="rgba(255, 107, 90, 0.4)"
            strokeWidth="1.5"
          />
          <ellipse cx="180" cy="170" rx="54" ry="44" fill={`url(#${id}-core)`} className="bl-core" style={{ opacity: 0.2 + p * 0.8 }} />
          <g filter={`url(#${id}-glow)`} fill="none" stroke={`url(#${id}-crack)`} strokeLinecap="round" strokeLinejoin="round" className="bl-cracks" style={{ opacity: cracks }}>
            <path d="M146 182 L156 200 L146 218 L154 232" strokeWidth="2.4" />
            <path d="M214 180 L204 198 L216 216 L208 232" strokeWidth="2.4" />
            <path d="M180 188 L186 206 L178 226" strokeWidth="2" />
            <path d="M112 172 L96 180 L82 172" strokeWidth="1.8" />
            <path d="M248 172 L264 180 L278 172" strokeWidth="1.8" />
            <path d="M160 70 L166 88" strokeWidth="1.6" />
            <path d="M200 70 L194 88" strokeWidth="1.6" />
          </g>
          <g filter={`url(#${id}-glow)`} className="bl-eyes" style={{ opacity: 0.3 + p * 0.7 }}>
            <path d="M144 108 Q162 110 177 122 Q157 130 144 108 Z" fill={`url(#${id}-eye)`} />
            <path d="M216 108 Q198 110 183 122 Q203 130 216 108 Z" fill={`url(#${id}-eye)`} />
          </g>
          <path
            d="M154 150 L164 160 L171 151 L180 162 L189 151 L196 160 L206 150 Q200 176 180 178 Q160 176 154 150 Z"
            fill={`url(#${id}-maw)`}
            filter={`url(#${id}-glow)`}
            className="bl-maw"
            style={{ opacity: 0.25 + p * 0.75 }}
          />
        </g>
      </g>

      <g className="bl-sparks" aria-hidden="true">
        {SPARKS.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i % 3 === 0 ? 2.2 : 1.5}
            fill={i % 2 ? '#ffb547' : '#ff6b5a'}
            className={i < sparks ? 'is-on' : ''}
            style={{ animationDelay: `${(i % 5) * 0.55}s` }}
          />
        ))}
      </g>

      {won ? (
        <g className="bl-fireflies" aria-hidden="true">
          {FIREFLIES.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.4" fill="#6fe3c8" style={{ animationDelay: `${i * 0.4}s` }} />
          ))}
        </g>
      ) : null}
    </svg>
  )
}

function label(p: number, won: boolean) {
  if (won) return 'Демон Выгорания рассеялся: от него остались только мятные светлячки'
  if (p > 0.7) return 'Демон Выгорания в полной силе: угли ярко тлеют, дым густой'
  if (p > 0.35) return 'Демон Выгорания тускнеет: угли гаснут, дым редеет'
  return 'Демон Выгорания почти рассеялся'
}
