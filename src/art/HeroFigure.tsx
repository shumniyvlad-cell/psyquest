// Герой-Фонарщик: фигура в плаще с капюшоном, посох с висящим фонарём.
// Фонарь светится цветом light; ореол и яркость растут с уровнем (1–20).
import { useMemo, type CSSProperties, type JSX } from 'react'
import './art.css'
import { clamp, cx, f, mix, smooth, useUid, type Pt } from './geom'

export type HeroPose = 'idle' | 'walk' | 'raise'

interface Rig {
  body: string
  hood: string
  arm: string
  hand: [number, number]
  staff: string
  /** точка подвеса фонаря */
  hook: [number, number]
  hoodTilt: number
  face: [number, number, number]
}

const BODY: Pt[] = [
  [74, 98],
  [112, 97],
  [118, 136],
  [121, 190],
  [126, 244],
  [132, 288, 0],
  [118, 292],
  [104, 289],
  [84, 293],
  [62, 289],
  [36, 290, 0],
  [42, 246],
  [50, 190],
  [58, 134],
]

const HOOD: Pt[] = [
  [64, 104],
  [60, 78],
  [70, 52],
  [90, 38],
  [110, 42],
  [121, 58],
  [125, 80],
  [118, 104],
]

function rig(pose: HeroPose): Rig {
  if (pose === 'raise') {
    return {
      body: smooth(BODY),
      hood: smooth(HOOD),
      arm: smooth([
        [100, 112],
        [114, 100],
        [122, 64],
        [130, 30, 0.4],
        [118, 28, 0.4],
        [110, 62],
        [98, 98],
      ]),
      hand: [125, 30],
      staff: `M119 132L127 -4Q129 -16 140 -18Q150 -19 152 -10`,
      hook: [152, -8],
      hoodTilt: -9,
      face: [106, 73, -20],
    }
  }
  if (pose === 'walk') {
    return {
      body: smooth(BODY),
      hood: smooth(HOOD),
      arm: smooth([
        [102, 108],
        [118, 104],
        [134, 128],
        [152, 146, 0.4],
        [146, 162, 0.4],
        [130, 156],
        [112, 136],
        [100, 120],
      ]),
      hand: [151, 156],
      staff: `M136 296L156 44Q158 30 170 26Q182 24 184 36`,
      hook: [184, 38],
      hoodTilt: 3,
      face: [108, 77, 12],
    }
  }
  return {
    body: smooth(BODY),
    hood: smooth(HOOD),
    arm: smooth([
      [102, 108],
      [118, 104],
      [132, 130],
      [146, 150, 0.4],
      [140, 166, 0.4],
      [126, 159],
      [112, 138],
      [100, 120],
    ]),
    hand: [144, 160],
    staff: `M146 296L148 42Q149 28 161 24Q173 22 175 34`,
    hook: [175, 36],
    hoodTilt: 0,
    face: [107, 76, 10],
  }
}

const MANTLE = smooth([
  [58, 104],
  [52, 142, 0.6],
  [70, 154],
  [92, 146],
  [110, 154],
  [124, 144, 0.6],
  [120, 110],
  [110, 98],
  [76, 98],
])

export function HeroFigure({
  light,
  level = 1,
  pose = 'idle',
  facing = 'right',
  size = 300,
  className,
}: {
  /** цвет фонаря */
  light: string
  level?: number
  pose?: HeroPose
  facing?: 'left' | 'right'
  /** высота, px */
  size?: number
  className?: string
}): JSX.Element {
  const u = useUid()
  const lv = clamp(Math.round(level), 1, 20)
  const k = (lv - 1) / 19
  const r = useMemo(() => rig(pose), [pose])
  const [hx, hy] = r.hook
  const lampY = hy + 26
  const haloR = (48 + lv * 5.4) * (pose === 'raise' ? 1.25 : 1)
  const haloO = clamp(0.62 + k * 0.38 + (pose === 'raise' ? 0.1 : 0), 0, 1)
  const hot = mix(light, '#fffbea', 0.72)
  const soft = mix(light, '#0e1330', 0.35)
  const body = `url(#${u}b)`
  const tilt = `rotate(${r.hoodTilt} 92 102)`
  const flip = facing === 'left' ? 'translate(200 0) scale(-1 1)' : undefined
  const motes = lv >= 15
  const sil = (fill: string, dx: number, dy: number, op: number) => (
    <g fill={fill} opacity={op} transform={`translate(${dx} ${dy})`}>
      <g className="art-hero-hem">
        <path d={r.body} />
      </g>
      <path d={r.hood} transform={tilt} />
      <path d={r.arm} />
      {lv >= 10 && <path d={MANTLE} />}
    </g>
  )
  return (
    <svg
      className={cx('art-hero', `art-hero--${pose}`, className)}
      viewBox="0 0 200 300"
      width={f((size * 2) / 3)}
      height={f(size)}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${u}h`}>
          <stop offset="0" stopColor={hot} stopOpacity="1" />
          <stop offset="0.1" stopColor={light} stopOpacity="0.75" />
          <stop offset="0.35" stopColor={light} stopOpacity="0.28" />
          <stop offset="0.7" stopColor={light} stopOpacity="0.07" />
          <stop offset="1" stopColor={light} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${u}p`}>
          <stop offset="0" stopColor={light} stopOpacity="0.5" />
          <stop offset="0.5" stopColor={light} stopOpacity="0.16" />
          <stop offset="1" stopColor={light} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${u}b`} x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" stopColor="#060818" />
          <stop offset="0.55" stopColor="#0c1030" />
          <stop offset="1" stopColor="#151b44" />
        </linearGradient>
        <radialGradient id={`${u}g`}>
          <stop offset="0" stopColor="#fffdf4" />
          <stop offset="0.35" stopColor={hot} />
          <stop offset="1" stopColor={light} />
        </radialGradient>
        <radialGradient id={`${u}l`} cx={f(hx)} cy={f(lampY)} r={f(120 + k * 60)} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={light} stopOpacity={f(0.34 + k * 0.2)} />
          <stop offset="0.5" stopColor={light} stopOpacity="0.07" />
          <stop offset="1" stopColor={light} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${u}c`}>
          <path d={r.body} />
          <path d={r.hood} transform={tilt} />
          <path d={r.arm} />
          {lv >= 10 && <path d={MANTLE} />}
        </clipPath>
      </defs>
      <g transform={flip}>
        {/* свет на земле */}
        <ellipse cx={f((hx + 90) / 2)} cy={294} rx={f(58 + k * 40)} ry={f(8 + k * 4)} fill={`url(#${u}p)`} />
        {/* ореол фонаря */}
        <g className="art-hero-flame">
          <circle cx={f(hx)} cy={f(lampY)} r={f(haloR)} fill={`url(#${u}h)`} opacity={f(haloO)} />
        </g>
        {lv >= 15 && (
          <circle cx={f(hx)} cy={f(lampY)} r={f(haloR * 1.6)} fill={`url(#${u}h)`} opacity={0.22} />
        )}
        <g className="art-hero-body">
          {/* ботинки */}
          <g fill="#080b1f">
            <ellipse className="art-hero-foot" cx={106} cy={293} rx={12} ry={5} />
            <ellipse className="art-hero-foot art-hero-foot--b" cx={66} cy={293} rx={11} ry={5} />
          </g>
          {/* контровой свет: холодный слева (луна), тёплый справа (фонарь) */}
          {sil('#8f8fd6', -1.8, -1.2, 0.5)}
          {sil(light, 2.2, -0.4, 0.8)}
          <g className="art-hero-hem">
            <path d={r.body} fill={body} />
          </g>
          <path d={r.hood} transform={tilt} fill={body} />
          {lv >= 10 && <path d={MANTLE} fill="#10153a" />}
          <path d={r.arm} fill={body} />
          {/* свет фонаря на ткани */}
          <g clipPath={`url(#${u}c)`}>
            <rect x={0} y={0} width={200} height={300} fill={`url(#${u}l)`} />
          </g>
          {/* складки плаща */}
          <path
            d="M88 150Q86 214 80 286M104 152Q106 214 112 288M70 160Q64 220 56 286"
            fill="none"
            stroke="#050716"
            strokeWidth={1.6}
            opacity={0.45}
          />
          {lv >= 3 && <path d="M58 170Q88 180 120 170" fill="none" stroke={soft} strokeWidth={3} opacity={0.75} />}
          {lv >= 6 && (
            <path d="M38 286Q62 292 84 289Q106 294 130 285" fill="none" stroke={light} strokeWidth={1.4} opacity={0.5} strokeDasharray="3 4" />
          )}
          {lv >= 10 && <path d="M58 104Q88 116 120 110" fill="none" stroke={light} strokeWidth={1} opacity={0.35} />}
          {/* лицо в тени капюшона и глаза */}
          <g transform={tilt}>
            <ellipse cx={r.face[0]} cy={r.face[1]} rx={11} ry={15} transform={`rotate(${r.face[2]} ${r.face[0]} ${r.face[1]})`} fill="#04050f" />
            <g fill={hot} className="art-hero-flame">
              <circle cx={r.face[0] + 1} cy={r.face[1] + 1} r={1.7} />
              <circle cx={r.face[0] + 8} cy={r.face[1] + 0.2} r={1.5} opacity={0.85} />
            </g>
          </g>
          {/* посох */}
          <path d={r.staff} fill="none" stroke="#070a1d" strokeWidth={4.2} strokeLinecap="round" />
          <path d={r.staff} fill="none" stroke={light} strokeWidth={1.1} strokeLinecap="round" opacity={0.45} transform="translate(1.4 0)" />
          <circle cx={r.hand[0]} cy={r.hand[1]} r={5.2} fill="#0d1130" />
          {/* фонарь качается на крюке */}
          <g transform={`translate(${hx} ${hy})`}>
            <g className="art-a art-hero-lantern">
              <path d="M0 0V9" stroke="#070a1d" strokeWidth={1.4} />
              <path d="M-6 13L-4 9H4L6 13Z" fill="#070a1d" />
              <circle cy={8} r={2.2} fill="none" stroke="#070a1d" strokeWidth={1.2} />
              <rect x={-7} y={13} width={14} height={22} rx={3} fill={`url(#${u}g)`} />
              <g className="art-hero-flame">
                <path d="M0 16C3 20 3.4 25 0 29C-3.4 25 -3 20 0 16Z" fill="#fffdf4" />
              </g>
              <path d="M-3.5 13V35M3.5 13V35" stroke="#070a1d" strokeWidth={1} opacity={0.7} />
              <path d="M-8 35H8L6 39H-6Z" fill="#070a1d" />
            </g>
          </g>
        </g>
        {motes &&
          [0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(${f(hx + Math.cos(i * 1.3) * 34)} ${f(lampY + Math.sin(i * 1.7) * 30)})`}>
              <circle
                className="art-a art-hero-mote"
                r={1.6}
                fill={hot}
                style={
                  {
                    animationDelay: `${-i * 0.9}s`,
                    '--fx': `${f(Math.cos(i) * 6)}px`,
                    '--fy': `${f(-8 - i)}px`,
                  } as CSSProperties
                }
              />
            </g>
          ))}
      </g>
    </svg>
  )
}
