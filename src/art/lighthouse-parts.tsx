// Маяк как деталь: башня (статичный слой) и вращающийся луч (fx-слой).
import { clamp, f, lerp, mix, smooth, useUid } from './geom'

export interface TowerGeo {
  x: number
  yb: number
  h: number
  /** центр лампы */
  lx: number
  ly: number
}

export function towerGeo(x: number, yb: number, h: number): TowerGeo {
  const gy = yb - h * 0.74
  return { x, yb, h, lx: x, ly: gy - h * 0.085 }
}

/** Башня маяка. lit 0..1 — насколько горит лампа (окна, стекло, тёплый кант). */
export function LighthouseTower({
  geo,
  lit = 1,
  body = '#131a3f',
  stripe = '#1d2554',
  rim = '#8f8fd0',
  light = '#ffd68a',
}: {
  geo: TowerGeo
  lit?: number
  body?: string
  stripe?: string
  rim?: string
  light?: string
}) {
  const u = useUid()
  const { x, yb, h } = geo
  const bw = h * 0.1
  const tw = h * 0.064
  const gy = yb - h * 0.74
  const shaft = smooth(
    [
      [x - bw, yb + 2, 0],
      [x - bw * 0.93, yb - h * 0.25],
      [x - tw * 1.02, gy - 1, 0],
      [x + tw * 1.02, gy - 1, 0],
      [x + bw * 0.93, yb - h * 0.25],
      [x + bw, yb + 2, 0],
    ],
    true,
  )
  // полосы: клипуем по стволу
  const bands: string[] = []
  for (let i = 0; i < 3; i++) {
    const y0 = lerp(yb, gy, 0.14 + i * 0.29)
    const y1 = y0 - h * 0.12
    bands.push(`M${f(x - bw * 1.2)} ${f(y0)}L${f(x + bw * 1.2)} ${f(y0 - h * 0.012)}L${f(x + bw * 1.2)} ${f(y1 - h * 0.012)}L${f(x - bw * 1.2)} ${f(y1)}Z`)
  }
  const galW = tw * 1.55
  const galH = h * 0.022
  const roomB = gy - h * 0.034
  const roomT = gy - h * 0.14
  const roomW = tw * 0.78
  const domeH = h * 0.075
  const glass = lit > 0.02 ? mix('#2a2f5a', light, clamp(lit * 1.6)) : '#20264e'
  const hot = mix(light, '#fffbea', clamp((lit - 0.5) * 2))
  const win = clamp((lit - 0.15) * 2.5)
  const posts: string[] = []
  for (let i = 0; i <= 6; i++) {
    const px = x - galW + (i / 6) * galW * 2
    posts.push(`M${f(px)} ${f(gy - galH)}V${f(gy - galH - h * 0.034)}`)
  }
  return (
    <g>
      <defs>
        <clipPath id={`${u}c`}>
          <path d={shaft} />
        </clipPath>
        <linearGradient id={`${u}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={mix(body, rim, 0.18)} />
          <stop offset="0.45" stopColor={body} />
          <stop offset="1" stopColor={mix(body, '#05071a', 0.5)} />
        </linearGradient>
        <radialGradient id={`${u}g`}>
          <stop offset="0" stopColor={mix(glass, '#fffdf2', clamp(lit * 2))} />
          <stop offset="0.5" stopColor={hot} />
          <stop offset="1" stopColor={glass} />
        </radialGradient>
      </defs>
      {/* контровой кант слева (луна) */}
      <path d={shaft} fill={rim} opacity={0.35} transform="translate(-1.6 -0.6)" />
      <path d={shaft} fill={`url(#${u}s)`} />
      <g clipPath={`url(#${u}c)`}>
        {bands.map((d, i) => (
          <path key={i} d={d} fill={stripe} opacity={0.9} />
        ))}
        {/* тёплый отсвет лампы сверху по стволу */}
        <rect
          x={f(x - bw * 1.3)}
          y={f(gy - 2)}
          width={f(bw * 2.6)}
          height={f(h * 0.3)}
          fill={light}
          opacity={0.14 * lit}
          className="art-lh-fade"
        />
      </g>
      {/* дверь и окна */}
      <path
        d={`M${f(x - bw * 0.26)} ${f(yb + 1)}V${f(yb - h * 0.065)}Q${f(x)} ${f(yb - h * 0.1)} ${f(x + bw * 0.26)} ${f(yb - h * 0.065)}V${f(yb + 1)}Z`}
        fill="#070a1e"
      />
      {[0.34, 0.58].map((t, i) => (
        <rect
          key={i}
          x={f(x - tw * 0.18 + (i ? tw * 0.1 : -tw * 0.05))}
          y={f(lerp(yb, gy, t))}
          width={f(tw * 0.3)}
          height={f(h * 0.036)}
          rx={f(tw * 0.14)}
          fill={win > 0 ? mix('#0a0d24', light, win) : '#0a0d24'}
        />
      ))}
      {/* галерея */}
      <rect x={f(x - galW)} y={f(gy - galH)} width={f(galW * 2)} height={f(galH)} fill={mix(body, '#05071a', 0.3)} />
      <path d={posts.join('') + `M${f(x - galW)} ${f(gy - galH - h * 0.034)}H${f(x + galW)}`} stroke={mix(body, rim, 0.3)} strokeWidth={Math.max(0.8, h * 0.005)} />
      {/* фонарная комната */}
      <rect x={f(x - roomW)} y={f(roomT)} width={f(roomW * 2)} height={f(roomB - roomT)} fill={`url(#${u}g)`} />
      <path
        d={`M${f(x - roomW * 0.34)} ${f(roomT)}V${f(roomB)}M${f(x + roomW * 0.34)} ${f(roomT)}V${f(roomB)}`}
        stroke={mix(body, '#000', 0.2)}
        strokeWidth={Math.max(0.6, h * 0.006)}
        opacity={0.8}
      />
      <rect x={f(x - roomW * 1.08)} y={f(roomB - 0.5)} width={f(roomW * 2.16)} height={f(h * 0.012)} fill={body} />
      {/* купол */}
      <path
        d={`M${f(x - roomW * 1.18)} ${f(roomT + 0.5)}Q${f(x - roomW * 1.05)} ${f(roomT - domeH)} ${f(x)} ${f(roomT - domeH * 1.05)}Q${f(x + roomW * 1.05)} ${f(roomT - domeH)} ${f(x + roomW * 1.18)} ${f(roomT + 0.5)}Z`}
        fill={body}
      />
      <path
        d={`M${f(x)} ${f(roomT - domeH)}V${f(roomT - domeH - h * 0.045)}`}
        stroke={body}
        strokeWidth={Math.max(1, h * 0.008)}
      />
      <circle cx={f(x)} cy={f(roomT - domeH - h * 0.048)} r={f(Math.max(1, h * 0.009))} fill={body} />
      {/* тёплый кант на куполе и галерее от лампы */}
      <path
        d={`M${f(x - roomW * 1.1)} ${f(roomT - 1)}Q${f(x - roomW)} ${f(roomT - domeH * 0.9)} ${f(x)} ${f(roomT - domeH * 0.98)}`}
        fill="none"
        stroke={light}
        strokeWidth={Math.max(0.6, h * 0.004)}
        opacity={0.55 * lit}
        className="art-lh-fade"
      />
    </g>
  )
}

/** Вращающийся луч + вспышка «на зрителя». Кладётся в fx-слой. */
export function LighthouseBeam({
  x,
  y,
  len = 900,
  spread = 110,
  color = '#ffe3a0',
  opacity = 1,
  period = 9,
  flare = 1,
}: {
  x: number
  y: number
  len?: number
  spread?: number
  color?: string
  opacity?: number
  period?: number
  flare?: number
}) {
  const u = useUid()
  const dur = { animationDuration: `${period}s` }
  return (
    <g transform={`translate(${f(x)} ${f(y)})`} opacity={opacity} className="art-lh-fade">
      <defs>
        <linearGradient id={`${u}w`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0.16" />
          <stop offset="0.4" stopColor={color} stopOpacity="0.06" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${u}b`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="0.3" stopColor={color} stopOpacity="0.12" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${u}c`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fffbea" stopOpacity="0.5" />
          <stop offset="0.2" stopColor={color} stopOpacity="0.2" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${u}f`}>
          <stop offset="0" stopColor="#fffdf4" stopOpacity="1" />
          <stop offset="0.12" stopColor={color} stopOpacity="0.6" />
          <stop offset="0.4" stopColor={color} stopOpacity="0.14" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="art-a art-beam" style={dur}>
        <path d={`M0 ${f(-len * 0.01)}L${f(len)} ${f(-spread * 1.45)}L${f(len)} ${f(spread * 1.45)}L0 ${f(len * 0.01)}Z`} fill={`url(#${u}w)`} />
        <path d={`M0 ${f(-len * 0.006)}L${f(len)} ${f(-spread)}L${f(len)} ${f(spread)}L0 ${f(len * 0.006)}Z`} fill={`url(#${u}b)`} />
        <path
          d={`M0 ${f(-len * 0.003)}L${f(len)} ${f(-spread * 0.4)}L${f(len)} ${f(spread * 0.4)}L0 ${f(len * 0.003)}Z`}
          fill={`url(#${u}c)`}
        />
      </g>
      {flare > 0 && (
        <g className="art-a art-flare" style={dur} opacity={0.3}>
          <ellipse rx={f(len * 0.24 * flare)} ry={f(len * 0.03 * flare)} fill={`url(#${u}f)`} />
          <circle r={f(len * 0.09 * flare)} fill={`url(#${u}f)`} />
        </g>
      )}
    </g>
  )
}

/** Парусник с фонарём. (x, y) — середина ватерлинии, s — масштаб (дальние меньше). */
export function Ship({
  x,
  y,
  s,
  flip,
  delay = 0,
  hull = '#0a0f2a',
  light = '#ffd68a',
  lit = 1,
}: {
  x: number
  y: number
  s: number
  flip?: boolean
  delay?: number
  hull?: string
  light?: string
  lit?: number
}) {
  const u = useUid()
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${f(flip ? -s : s)} ${f(s)})`}>
      <defs>
        <radialGradient id={`${u}g`}>
          <stop offset="0" stopColor={light} stopOpacity="0.95" />
          <stop offset="0.25" stopColor={light} stopOpacity="0.35" />
          <stop offset="1" stopColor={light} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* отражение фонаря */}
      <path d="M-14 16h8M-18 24h14M-13 33h6" stroke={light} strokeWidth={2} strokeLinecap="round" opacity={0.45 * lit} />
      <g className="art-a art-bob" style={{ animationDelay: `${f(delay)}s` }}>
        <path d="M-36 -3Q0 3 38 -5L29 9Q0 13 -27 9Z" fill={hull} />
        <path d="M0 -3V-62" stroke={hull} strokeWidth={2.2} />
        <path d="M3 -60Q20 -34 30 -9L3 -7Z" fill={hull} />
        <path d="M-3 -54Q-18 -30 -28 -8L-3 -7Z" fill={hull} />
        <path d="M3 -60Q20 -34 30 -9" fill="none" stroke="#8f8fd0" strokeWidth={1} opacity={0.5} />
        <path d="M-36 -3Q0 3 38 -5" fill="none" stroke="#8f8fd0" strokeWidth={1} opacity={0.45} />
        <path d="M0 -62l10 3l-10 3Z" fill={hull} />
        <g opacity={lit}>
          <circle cx={-26} cy={-10} r={16} fill={`url(#${u}g)`} />
          <circle cx={-26} cy={-10} r={2.4} fill="#fff4d6" />
        </g>
      </g>
    </g>
  )
}
