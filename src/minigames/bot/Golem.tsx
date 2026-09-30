import { useId, type CSSProperties } from 'react'

export type GolemMood = 'idle' | 'watch' | 'hurt' | 'gloat' | 'grave' | 'defeated'

interface GolemProps {
  mood: GolemMood
  /** Сколько клиентов дошло — столько трещин со светом внутри */
  cracks: number
  className?: string
}

interface Stone {
  id: string
  /** Точки многоугольника: тёсаный камень, а не прямоугольник */
  pts: string
  /** Светлая кромка сверху — объём камня */
  edge?: string
  dark?: boolean
  /** Куда отлетает при разрушении */
  dx: number
  dy: number
  r: number
  delay: number
}

// Порядок = порядок отрисовки: сзади вперёд.
const STONES: Stone[] = [
  { id: 'll', pts: '52,164 76,163 79,185 50,187', edge: '53,165 75,164', dark: true, dx: -34, dy: 54, r: -22, delay: 0.22 },
  { id: 'rl', pts: '84,163 108,164 110,187 81,185', edge: '85,164 107,165', dark: true, dx: 36, dy: 56, r: 26, delay: 0.24 },
  { id: 'hips', pts: '50,144 110,144 115,156 106,163 54,163 45,156', edge: '51,145 109,145', dark: true, dx: -6, dy: 66, r: 14, delay: 0.2 },
  { id: 'belly', pts: '56,113 104,113 109,129 100,143 60,143 51,129', edge: '57,114 103,114', dx: 10, dy: 58, r: -16, delay: 0.14 },
  { id: 'la1', pts: '9,92 28,94 31,119 24,128 8,126 3,108', edge: '10,93 27,95', dark: true, dx: -64, dy: -6, r: -42, delay: 0.1 },
  { id: 'ra1', pts: '151,92 132,94 129,119 136,128 152,126 157,108', edge: '150,93 133,95', dark: true, dx: 62, dy: -12, r: 38, delay: 0.12 },
  { id: 'la2', pts: '2,128 26,127 35,142 28,159 8,161 -3,146', edge: '3,129 25,128', dx: -74, dy: 42, r: -64, delay: 0.16 },
  { id: 'ra2', pts: '158,128 134,127 125,142 132,159 152,161 163,146', edge: '157,129 135,128', dx: 76, dy: 46, r: 58, delay: 0.18 },
]

const SPECKS: [number, number, number][] = [
  [66, 122, 1.4],
  [94, 134, 1.1],
  [60, 152, 1.2],
  [100, 150, 1],
  [12, 140, 1.5],
  [150, 112, 1.2],
  [14, 104, 1],
  [66, 176, 1.1],
]

const stoneStyle = (s: Pick<Stone, 'dx' | 'dy' | 'r' | 'delay'>) =>
  ({ '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, '--r': `${s.r}deg`, '--d': `${s.delay}s` }) as CSSProperties

/** Голем Молчания: каменный силуэт из тёсаных блоков, на груди — перечёркнутое облачко реплики. */
export function Golem({ mood, cracks, className }: GolemProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const lit = `bb-stone-${uid}`
  const dim = `bb-stone-d-${uid}`
  const c = Math.max(0, Math.min(3, cracks))
  const fill = (s: { dark?: boolean }) => `url(#${s.dark ? dim : lit})`
  return (
    <div className={['bb-golem', className].filter(Boolean).join(' ')} data-mood={mood} data-cracks={c}>
      <svg viewBox="-12 -8 184 200" role="img" aria-label="Голем Молчания">
        <defs>
          <linearGradient id={lit} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" style={{ stopColor: '#433a86' }} />
            <stop offset="0.55" style={{ stopColor: '#2c2463' }} />
            <stop offset="1" style={{ stopColor: 'var(--ink)' }} />
          </linearGradient>
          <linearGradient id={dim} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" style={{ stopColor: '#342c6c' }} />
            <stop offset="1" style={{ stopColor: '#150b27' }} />
          </linearGradient>
        </defs>

        <ellipse className="bb-golem-shadow" cx="80" cy="188" rx="64" ry="6" />
        <circle className="bb-golem-burst" cx="80" cy="96" r="14" />

        {STONES.map((s) => (
          <g key={s.id} className="bb-gb" style={stoneStyle(s)}>
            <polygon points={s.pts} fill={fill(s)} className="bb-g-edge" />
            {s.edge ? <polyline points={s.edge} className="bb-g-bevel" /> : null}
          </g>
        ))}

        {/* грудь с эмблемой молчания */}
        <g className="bb-gb" style={stoneStyle({ dx: 18, dy: 46, r: -12, delay: 0.08 })}>
          <polygon points="52,68 108,68 115,88 110,112 50,112 45,88" fill={`url(#${lit})`} className="bb-g-edge" />
          <polyline points="53,69 107,69" className="bb-g-bevel" />
          <g className="bb-g-sigil">
            <path d="M66 79h28a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H81l-7 6v-6h-8a5 5 0 0 1-5-5V84a5 5 0 0 1 5-5z" />
            <circle cx="72" cy="89" r="1.8" />
            <circle cx="80" cy="89" r="1.8" />
            <circle cx="88" cy="89" r="1.8" />
            <line x1="61" y1="106" x2="99" y2="75" className="bb-g-slash" />
          </g>
          <path className="bb-g-crack" data-n="2" d="M104 70l-6 10 5 5-7 11 4 6" />
        </g>

        {/* плечи — два валуна */}
        <g className="bb-gb" style={stoneStyle({ dx: -40, dy: -30, r: -18, delay: 0.04 })}>
          <polygon points="18,71 34,62 56,64 63,78 56,94 30,97 15,86" fill={`url(#${lit})`} className="bb-g-edge" />
          <polyline points="20,70 34,63 55,65" className="bb-g-bevel" />
          <path className="bb-g-crack" data-n="1" d="M40 64l4 9-5 6 6 9" />
        </g>
        <g className="bb-gb" style={stoneStyle({ dx: 40, dy: -28, r: 16, delay: 0.06 })}>
          <polygon points="142,71 126,62 104,64 97,78 104,94 130,97 145,86" fill={`url(#${lit})`} className="bb-g-edge" />
          <polyline points="140,70 126,63 105,65" className="bb-g-bevel" />
        </g>

        {/* голова: валун с тяжёлым лбом, тусклые щели глаз */}
        <g className="bb-gb bb-g-head" style={stoneStyle({ dx: -12, dy: -78, r: -30, delay: 0 })}>
          <polygon points="58,24 70,17 92,16 104,23 109,40 104,58 90,65 70,65 56,57 52,40" fill={`url(#${lit})`} className="bb-g-edge" />
          <polygon points="53,31 66,23 94,22 108,30 105,38 55,38" fill={`url(#${dim})`} className="bb-g-brow" />
          <polygon className="bb-g-eye" points="62,41 76,43.5 75,47.5 62,45" />
          <polygon className="bb-g-eye" points="98,41 84,43.5 85,47.5 98,45" />
          <path className="bb-g-mouth" d="M69 56l8-2 6 2 8-1" />
          <path className="bb-g-crack" data-n="3" d="M95 18l-5 9 6 5-4 8" />
        </g>

        <g className="bb-g-specks" aria-hidden="true">
          {SPECKS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>
      </svg>
    </div>
  )
}
