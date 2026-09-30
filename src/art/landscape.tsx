// Примитивы ночного мира «Психея»: небо, звёзды, луна, аврора, хребты, леса, туман, вода, светлячки.
// Всё процедурное — через сид; геометрия считается в useMemo.
import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { mulberry32, rangeRand } from './rng'
import { cx, dotsPath, f, fbm, lerp, noise1, poly, smooth, taper, useUid, type Pt } from './geom'

export const VW = 1600
export const VH = 900
const VIEWBOX = '0 0 1600 900'

type Rng = () => number

// ---------- Слои ----------

/** Полноэкранный SVG-слой 1600×900 (slice). fx — отдельный композитный слой для анимаций. */
export function Plane({ children, fx, className }: { children?: ReactNode; fx?: boolean; className?: string }) {
  return (
    <svg
      className={cx('art-plane', fx && 'art-plane--fx', className)}
      viewBox={VIEWBOX}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export interface FogProps {
  seed: number
  y: number
  h: number
  color?: string
  opacity?: number
  puffs?: number
  duration?: number
  delay?: number
  reverse?: boolean
}

/** Полоса тумана — отдельный HTML-слой, дрейф анимируется целиком (дёшево для телефона). */
export function FogPlane({
  seed,
  y,
  h,
  color = '#8e8bb8',
  opacity = 0.35,
  puffs = 7,
  duration = 44,
  delay = 0,
  reverse,
}: FogProps) {
  const uid = useUid()
  const shapes = useMemo(() => {
    const r = mulberry32(seed)
    const out: { x: number; y: number; rx: number; ry: number; o: number }[] = []
    for (let i = 0; i < puffs; i++) {
      out.push({
        x: lerp(-250, 1850, (i + r() * 0.8) / puffs),
        y: y + rangeRand(r, -0.3, 0.3) * h,
        rx: rangeRand(r, 240, 460),
        ry: h * rangeRand(r, 0.32, 0.62),
        o: rangeRand(r, 0.45, 1),
      })
    }
    return out
  }, [seed, y, h, puffs])
  return (
    <div
      className={cx('art-fog', reverse && 'art-fog--rev')}
      style={{ animationDuration: `${duration}s`, animationDelay: `${-delay}s` }}
    >
      <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0" />
            <stop offset="0.5" stopColor={color} stopOpacity="0.75" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${uid}p`}>
            <stop offset="0" stopColor={color} stopOpacity="0.85" />
            <stop offset="0.5" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <g opacity={opacity}>
          <rect x={-600} y={f(y - h / 2)} width={2800} height={f(h)} fill={`url(#${uid}b)`} />
          {shapes.map((s, i) => (
            <ellipse
              key={i}
              cx={f(s.x)}
              cy={f(s.y)}
              rx={f(s.rx)}
              ry={f(s.ry)}
              fill={`url(#${uid}p)`}
              opacity={s.o}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}

// ---------- Небо ----------

export function Sky({ stops, y0 = 0, y1 = VH }: { stops: readonly (readonly [number, string])[]; y0?: number; y1?: number }) {
  const uid = useUid()
  return (
    <>
      <defs>
        <linearGradient id={uid} x1="0" y1={y0} x2="0" y2={y1} gradientUnits="userSpaceOnUse">
          {stops.map(([o, c]) => (
            <stop key={o} offset={o} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <rect x={-400} y={-60} width={2400} height={1020} fill={`url(#${uid})`} />
    </>
  )
}

/**
 * Мягкое свечение: радиальный градиент на эллипсе (без blur-фильтров).
 * opacity — на обёртке, поэтому анимации прозрачности (className) её не перетирают.
 * fade — плавный переход opacity при изменении пропа.
 */
export function Glow({
  x,
  y,
  r,
  ry,
  color,
  opacity = 1,
  className,
  style,
  hot,
  fade,
  gid,
}: {
  x: number
  y: number
  r: number
  ry?: number
  /** цвет (игнорируется, если передан gid общего градиента) */
  color: string
  opacity?: number
  className?: string
  style?: CSSProperties
  /** Яркое белёсое ядро в центре */
  hot?: string
  fade?: boolean
  /** id общего градиента (GlowGrad) — экономит узлы, когда свечений много */
  gid?: string
}) {
  const uid = useUid()
  return (
    <g
      opacity={fade ? undefined : opacity}
      style={fade ? { opacity } : undefined}
      className={fade ? 'art-lh-fade' : undefined}
    >
      {!gid && <GlowGrad id={uid} color={color} hot={hot} />}
      <ellipse
        cx={f(x)}
        cy={f(y)}
        rx={f(r)}
        ry={f(ry ?? r)}
        fill={`url(#${gid ?? uid})`}
        className={className}
        style={style}
      />
    </g>
  )
}

/** Радиальный градиент свечения (для общего использования несколькими Glow через gid). */
export function GlowGrad({ id, color, hot }: { id: string; color: string; hot?: string }) {
  return (
    <defs>
      <radialGradient id={id}>
        <stop offset="0" stopColor={hot ?? color} stopOpacity="1" />
        <stop offset="0.16" stopColor={color} stopOpacity="0.62" />
        <stop offset="0.42" stopColor={color} stopOpacity="0.2" />
        <stop offset="0.72" stopColor={color} stopOpacity="0.055" />
        <stop offset="1" stopColor={color} stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

export interface StarsProps {
  seed: number
  count?: number
  yMax?: number
  twinkle?: number
  bright?: number
  color?: string
  opacity?: number
  x0?: number
  x1?: number
}

export function Stars({
  seed,
  count = 110,
  yMax = 500,
  twinkle = 22,
  bright = 4,
  color = '#fdf6e3',
  opacity = 1,
  x0 = 0,
  x1 = VW,
}: StarsProps) {
  const uid = useUid()
  const data = useMemo(() => {
    const r = mulberry32(seed)
    const small: [number, number, number][] = []
    const mid: [number, number, number][] = []
    const low: [number, number, number][] = []
    const tw: { x: number; y: number; r: number; d: number; dl: number }[] = []
    const br: { x: number; y: number; s: number }[] = []
    for (let i = 0; i < count; i++) {
      const x = rangeRand(r, x0, x1)
      const y = 8 + (yMax - 8) * Math.pow(r(), 1.45)
      const s = r()
      if (i < bright) br.push({ x, y: Math.min(y, yMax * 0.6), s: 0.8 + s * 0.6 })
      else if (i < bright + twinkle) tw.push({ x, y, r: 0.9 + s * 1.1, d: 2.6 + r() * 4.5, dl: -r() * 7 })
      else if (y > yMax * 0.7) low.push([x, y, 0.5 + s * 0.6])
      else if (s < 0.74) small.push([x, y, 0.5 + r() * 0.55])
      else mid.push([x, y, 0.95 + r() * 0.6])
    }
    return { small: dotsPath(small), mid: dotsPath(mid), low: dotsPath(low), tw, br }
  }, [seed, count, yMax, twinkle, bright, x0, x1])
  return (
    <g opacity={opacity}>
      <defs>
        <radialGradient id={uid}>
          <stop offset="0" stopColor={color} stopOpacity="0.9" />
          <stop offset="0.25" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={data.low} fill={color} opacity={0.3} />
      <path d={data.small} fill={color} opacity={0.55} />
      <path d={data.mid} fill={color} opacity={0.85} />
      {data.tw.map((s, i) => (
        <circle
          key={i}
          className="art-twinkle"
          cx={f(s.x)}
          cy={f(s.y)}
          r={f(s.r)}
          fill={color}
          style={{ animationDuration: `${s.d.toFixed(2)}s`, animationDelay: `${s.dl.toFixed(2)}s` }}
        />
      ))}
      {data.br.map((s, i) => (
        <g key={i} transform={`translate(${f(s.x)} ${f(s.y)})`}>
          <circle r={f(9 * s.s)} fill={`url(#${uid})`} />
          <path
            d={`M${f(-7 * s.s)} 0H${f(7 * s.s)}M0 ${f(-7 * s.s)}V${f(7 * s.s)}`}
            stroke={color}
            strokeWidth={0.6}
            opacity={0.7}
          />
          <circle r={f(1.5 * s.s)} fill="#fffdf5" />
        </g>
      ))}
    </g>
  )
}

export function Moon({
  x,
  y,
  r,
  color = '#f6eed8',
  halo = 1,
}: {
  x: number
  y: number
  r: number
  color?: string
  halo?: number
}) {
  const uid = useUid()
  return (
    <g>
      <defs>
        <radialGradient id={`${uid}h`}>
          <stop offset="0" stopColor={color} stopOpacity="0.34" />
          <stop offset="0.2" stopColor={color} stopOpacity="0.14" />
          <stop offset="0.5" stopColor={color} stopOpacity="0.045" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}d`} cx="0.38" cy="0.36" r="0.75">
          <stop offset="0" stopColor="#fffcf2" />
          <stop offset="0.55" stopColor={color} />
          <stop offset="1" stopColor="#bdb3c9" />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r * 8} fill={`url(#${uid}h)`} opacity={halo} />
      <circle cx={x} cy={y} r={r} fill={`url(#${uid}d)`} />
      <g fill="#a99fc0" opacity="0.28">
        <ellipse cx={x - r * 0.28} cy={y - r * 0.12} rx={r * 0.3} ry={r * 0.22} />
        <ellipse cx={x + r * 0.3} cy={y + r * 0.26} rx={r * 0.22} ry={r * 0.17} />
        <ellipse cx={x + r * 0.06} cy={y - r * 0.46} rx={r * 0.13} ry={r * 0.09} />
      </g>
    </g>
  )
}

/** Полярное сияние: «занавеси» с яркой нижней кромкой и лучами, гаснущими кверху. */
export function Aurora({
  seed,
  x0 = 150,
  x1 = 1450,
  y = 300,
  h = 150,
  color = '#6fe3c8',
  color2 = '#8e7bd8',
  opacity = 0.5,
  bands = 3,
}: {
  seed: number
  x0?: number
  x1?: number
  y?: number
  h?: number
  color?: string
  color2?: string
  opacity?: number
  bands?: number
}) {
  const uid = useUid()
  const list = useMemo(() => {
    const r = mulberry32(seed)
    const out: { d: string; edge: string; rays: { x: number; y: number; w: number; h: number; o: number }[]; dl: number; o: number }[] = []
    for (let b = 0; b < bands; b++) {
      const n = noise1(seed * 7 + b)
      const ph = r() * 6
      const amp = rangeRand(r, 12, 26)
      const bx0 = x0 + rangeRand(r, -40, 220)
      const bx1 = x1 - rangeRand(r, -40, 220)
      const hb = h * rangeRand(r, 0.6, 1)
      const top: Pt[] = []
      const bot: Pt[] = []
      const rays: { x: number; y: number; w: number; h: number; o: number }[] = []
      for (let x = bx0; x <= bx1; x += 24) {
        const wave = Math.sin(x * 0.004 + ph) * amp + Math.sin(x * 0.013 + ph * 2) * amp * 0.3
        const edge = Math.min(1, (x - bx0) / 220, (bx1 - x) / 220)
        const hh = hb * (0.35 + 0.65 * (n(x * 0.007) * 0.5 + 0.5)) * Math.max(0.08, edge)
        const yb = y + wave + b * 24
        top.push([x, yb - hh])
        bot.push([x, yb])
        if (r() < 0.55) {
          const rh = hh * rangeRand(r, 0.45, 1.05)
          rays.push({ x: x + rangeRand(r, -6, 6), y: yb - rh, w: rangeRand(r, 2, 5), h: rh + 4, o: rangeRand(r, 0.3, 0.8) * Math.max(0.2, edge) })
        }
      }
      out.push({
        d: smooth([...top, ...[...bot].reverse()], true),
        edge: smooth(bot, false),
        rays,
        dl: -r() * 10,
        o: rangeRand(r, 0.6, 1),
      })
    }
    return out
  }, [seed, x0, x1, y, h, bands])
  return (
    <g opacity={opacity}>
      <defs>
        <linearGradient id={`${uid}f`} x1="0" y1={f(y - h - 40)} x2="0" y2={f(y + 30 + bands * 24)} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={color2} stopOpacity="0" />
          <stop offset="0.45" stopColor={color2} stopOpacity="0.16" />
          <stop offset="0.8" stopColor={color} stopOpacity="0.34" />
          <stop offset="1" stopColor={color} stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={`${uid}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color2} stopOpacity="0" />
          <stop offset="0.6" stopColor={color} stopOpacity="0.45" />
          <stop offset="1" stopColor={color} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {list.map((b, i) => (
        <g key={i} opacity={b.o}>
          <g className="art-a art-aurora" style={{ animationDelay: `${b.dl.toFixed(2)}s` }}>
            <path d={b.d} fill={`url(#${uid}f)`} />
            {b.rays.map((ry, k) => (
              <rect key={k} x={f(ry.x)} y={f(ry.y)} width={f(ry.w)} height={f(ry.h)} fill={`url(#${uid}r)`} opacity={f(ry.o)} />
            ))}
            <path d={b.edge} fill="none" stroke={color} strokeWidth={2.2} opacity={0.55} strokeLinecap="round" />
          </g>
        </g>
      ))}
    </g>
  )
}

// ---------- Рельеф ----------

export interface RidgeOpts {
  seed: number
  base: number | ((x: number) => number)
  amp: number
  /** «особенностей» на 1000px */
  freq?: number
  oct?: number
  /** 0..1 — острые гребни (ridged noise) */
  sharp?: number
  /** мелкая «скальная» изрезанность, доля amp */
  rough?: number
  x0?: number
  x1?: number
  step?: number
  bottom?: number
  mod?: (x: number, y: number) => number
}

export interface RidgeGeo {
  d: string
  top: string
  y: (x: number) => number
  minY: number
}

export function ridge(o: RidgeOpts): RidgeGeo {
  const n = noise1(o.seed)
  const n2 = noise1(o.seed + 99)
  const n3 = noise1(o.seed + 555)
  const fr = (o.freq ?? 3) / 1000
  const sharp = o.sharp ?? 0
  const rough = o.rough ?? 0
  const oct = o.oct ?? 4
  const base = o.base
  const y = (x: number): number => {
    const b = typeof base === 'number' ? base : base(x)
    let h = fbm(n, x * fr, oct)
    if (sharp > 0) {
      const rr = 1 - Math.abs(fbm(n2, x * fr * 0.8, oct))
      h = lerp(h, rr * 2 - 1, sharp)
    }
    if (rough > 0) h += rough * fbm(n3, x * fr * 9, 3)
    const v = b - o.amp * h
    return o.mod ? o.mod(x, v) : v
  }
  const x0 = o.x0 ?? -20
  const x1 = o.x1 ?? VW + 20
  const step = o.step ?? 8
  const bottom = o.bottom ?? VH + 10
  const pts: [number, number][] = []
  let minY = Infinity
  for (let x = x0; x < x1; x += step) {
    const v = y(x)
    pts.push([x, v])
    if (v < minY) minY = v
  }
  const vEnd = y(x1)
  pts.push([x1, vEnd])
  minY = Math.min(minY, vEnd)
  const top = poly(pts, false)
  const d = `M${f(x0)} ${f(bottom)}L${top.slice(1)}L${f(x1)} ${f(bottom)}Z`
  return { d, top, y, minY }
}

/** Слой рельефа с вертикальным градиентом (вершина → дымка у подножия) и тонким контровым кантом. */
export function RidgeFill({
  geo,
  from,
  to,
  y1,
  y2,
  rim,
  rimOpacity = 0.35,
  rimWidth = 1.4,
}: {
  geo: RidgeGeo
  from: string
  to: string
  y1?: number
  y2?: number
  rim?: string
  rimOpacity?: number
  rimWidth?: number
}) {
  const uid = useUid()
  const a = y1 ?? geo.minY
  const b = y2 ?? a + 150
  return (
    <>
      <defs>
        <linearGradient id={uid} x1="0" y1={f(a)} x2="0" y2={f(b)} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <path d={geo.d} fill={`url(#${uid})`} />
      {rim && (
        <path
          d={geo.top}
          fill="none"
          stroke={rim}
          strokeWidth={rimWidth}
          opacity={rimOpacity}
          strokeLinejoin="round"
        />
      )}
    </>
  )
}

/** Вертикальный градиент для произвольной фигуры (userSpace). */
export function VGrad({ id, y1, y2, stops }: { id: string; y1: number; y2: number; stops: readonly (readonly [number, string, number?])[] }) {
  return (
    <linearGradient id={id} x1="0" y1={f(y1)} x2="0" y2={f(y2)} gradientUnits="userSpaceOnUse">
      {stops.map(([o, c, op], i) => (
        <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />
      ))}
    </linearGradient>
  )
}

// ---------- Деревья ----------

/** Силуэт ели: ярусы свисающих лап. */
export function pineD(r: Rng, x: number, yb: number, h: number, w: number): string {
  const tiers = h > 110 ? 9 : h > 60 ? 7 : h > 28 ? 5 : 3
  const crownB = yb - h * 0.06
  const top = yb - h
  const trunk = Math.max(0.8, w * 0.055)
  const lean = (r() - 0.5) * h * 0.05
  const span = crownB - top
  const R: Pt[] = []
  const L: Pt[] = []
  for (let i = 1; i <= tiers; i++) {
    const t = i / tiers
    const ty = top + span * Math.pow(t, 0.95)
    const k = 0.16 + 0.84 * Math.pow(t, 0.85)
    const cxT = x + lean * (1 - t)
    const hwR = (w / 2) * k * rangeRand(r, 0.8, 1.18)
    const hwL = (w / 2) * k * rangeRand(r, 0.8, 1.18)
    const droop = (span / tiers) * rangeRand(r, 0.08, 0.3)
    R.push([cxT + hwR, ty + droop])
    L.push([cxT - hwL, ty + droop * rangeRand(r, 0.6, 1.3)])
    if (i < tiers) {
      const ny = ty - (span / tiers) * rangeRand(r, 0.0, 0.2)
      R.push([cxT + hwR * rangeRand(r, 0.28, 0.46), ny])
      L.push([cxT - hwL * rangeRand(r, 0.28, 0.46), ny])
    }
  }
  const pts: Pt[] = [
    [x + lean, top - h * 0.02],
    ...R,
    [x + trunk, crownB],
    [x + trunk, yb + 8],
    [x - trunk, yb + 8],
    [x - trunk, crownB],
    ...L.reverse(),
  ]
  return poly(pts, true)
}

/** Ряд елей вдоль линии рельефа — одним path. */
export function forestD(
  seed: number,
  yAt: (x: number) => number,
  x0: number,
  x1: number,
  o: { gap: [number, number]; h: [number, number]; ratio?: number; sink?: number; skip?: (x: number) => boolean },
): string {
  const r = mulberry32(seed)
  let d = ''
  let x = x0 + r() * o.gap[1]
  while (x < x1) {
    if (!o.skip || !o.skip(x)) {
      const h = rangeRand(r, o.h[0], o.h[1])
      const w = h * (o.ratio ?? 0.36) * rangeRand(r, 0.85, 1.15)
      d += pineD(r, x, yAt(x) + (o.sink ?? 4), h, w)
    }
    x += rangeRand(r, o.gap[0], o.gap[1])
  }
  return d
}

/** Голое кривое дерево: рекурсивные сужающиеся ветви, одним path. */
export function bareTreeD(
  seed: number,
  x: number,
  yb: number,
  h: number,
  o: { lean?: number; spread?: number; depth?: number; width?: number } = {},
): string {
  const r = mulberry32(seed)
  const parts: string[] = []
  const spread = o.spread ?? 0.62
  const grow = (x0: number, y0: number, ang: number, len: number, w: number, depth: number) => {
    const bend = rangeRand(r, -0.45, 0.45)
    const segs: [number, number][] = [[x0, y0]]
    let a = ang
    let px = x0
    let py = y0
    for (let s = 0; s < 3; s++) {
      a += bend * (s === 1 ? -0.8 : 0.6) + rangeRand(r, -0.12, 0.12)
      px += Math.cos(a) * (len / 3)
      py += Math.sin(a) * (len / 3)
      segs.push([px, py])
    }
    const w1 = w * 0.62
    parts.push(w > 5 ? taper(segs, w, w1, 1, false) : poly(offsetLine(segs, w, w1), true))
    if (depth <= 0 || len < 5) return
    const kids = depth > 3 ? 2 : r() < 0.4 ? 3 : 2
    for (let k = 0; k < kids; k++) {
      const side = k / (kids - 1) - 0.5
      const na = a + side * spread * 2 + rangeRand(r, -0.25, 0.25)
      grow(px, py, na, len * rangeRand(r, 0.6, 0.8), w1, depth - 1)
    }
    if (r() < 0.35 && depth > 1) {
      const m = segs[1]
      grow(m[0], m[1], ang + (r() < 0.5 ? -1 : 1) * rangeRand(r, 0.7, 1.1), len * 0.45, w * 0.5, depth - 2)
    }
  }
  const w = o.width ?? h * 0.075
  grow(x, yb + 4, -Math.PI / 2 + (o.lean ?? 0), h * 0.34, w, o.depth ?? 5)
  return parts.join('')
}

function offsetLine(pts: [number, number][], w0: number, w1: number): Pt[] {
  const n = pts.length
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    let dx = b[0] - a[0]
    let dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const w = lerp(w0, w1, i / (n - 1)) / 2
    left.push([pts[i][0] - dy * w, pts[i][1] + dx * w])
    right.push([pts[i][0] + dy * w, pts[i][1] - dx * w])
  }
  return [...left, ...right.reverse()]
}

/** Пучки травы вдоль линии рельефа. */
export function grassD(seed: number, yAt: (x: number) => number, x0: number, x1: number, gap: number, hMin: number, hMax: number): string {
  const r = mulberry32(seed)
  let d = ''
  for (let x = x0; x < x1; x += gap * rangeRand(r, 0.5, 1.6)) {
    const y = yAt(x) + 2
    const blades = 2 + Math.floor(r() * 4)
    for (let b = 0; b < blades; b++) {
      const bx = x + rangeRand(r, -5, 5)
      const h = rangeRand(r, hMin, hMax)
      const lean = rangeRand(r, -0.45, 0.45) * h
      const w = rangeRand(r, 1.2, 2.4)
      d += `M${f(bx - w)} ${f(y)}Q${f(bx + lean * 0.3)} ${f(y - h * 0.6)} ${f(bx + lean)} ${f(y - h)}Q${f(bx + lean * 0.2 + w * 0.4)} ${f(y - h * 0.5)} ${f(bx + w)} ${f(y)}Z`
    }
  }
  return d
}

/** Угловатый валун. */
export function rockD(r: Rng, x: number, yb: number, w: number, h: number): string {
  const n = 7
  const pts: Pt[] = [[x - w / 2, yb + 4, 0]]
  for (let i = 1; i < n; i++) {
    const t = i / n
    const a = Math.PI * (1 - t)
    pts.push([x + Math.cos(a) * (w / 2) * rangeRand(r, 0.85, 1.05), yb - Math.sin(a) * h * rangeRand(r, 0.78, 1.08), 0.35])
  }
  pts.push([x + w / 2, yb + 4, 0])
  return smooth(pts, true)
}

// ---------- Живое ----------

export function Fireflies({
  seed,
  count = 16,
  x0,
  x1,
  y0,
  y1,
  color = '#ffd68a',
  size = 1,
}: {
  seed: number
  count?: number
  x0: number
  x1: number
  y0: number
  y1: number
  color?: string
  size?: number
}) {
  const uid = useUid()
  const list = useMemo(() => {
    const r = mulberry32(seed)
    return Array.from({ length: count }, () => ({
      x: rangeRand(r, x0, x1),
      y: rangeRand(r, y0, y1),
      s: size * rangeRand(r, 0.6, 1.25),
      fx: rangeRand(r, -40, 40),
      fy: rangeRand(r, -45, 20),
      d: rangeRand(r, 6, 13),
      dl: -rangeRand(r, 0, 12),
    }))
  }, [seed, count, x0, x1, y0, y1, size])
  return (
    <g>
      <defs>
        <radialGradient id={uid}>
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="0.3" stopColor={color} stopOpacity="0.32" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      {list.map((p, i) => (
        <g key={i} transform={`translate(${f(p.x)} ${f(p.y)})`}>
          <g
            className="art-a art-firefly"
            style={
              {
                '--fx': `${p.fx.toFixed(1)}px`,
                '--fy': `${p.fy.toFixed(1)}px`,
                animationDuration: `${p.d.toFixed(2)}s`,
                animationDelay: `${p.dl.toFixed(2)}s`,
              } as CSSProperties
            }
          >
            <circle r={f(10 * p.s)} fill={`url(#${uid})`} />
            <circle r={f(1.4 * p.s)} fill="#fffbe6" />
          </g>
        </g>
      ))}
    </g>
  )
}

// ---------- Вода ----------

/** Световая дорожка на воде (луна, маяк, окна). */
export function LightPath({
  seed,
  x,
  y0,
  y1,
  color,
  width = 70,
  spread = 0.16,
  count = 28,
  opacity = 0.75,
  shimmer = 7,
}: {
  seed: number
  x: number
  y0: number
  y1: number
  color: string
  width?: number
  spread?: number
  count?: number
  opacity?: number
  shimmer?: number
}) {
  const data = useMemo(() => {
    const r = mulberry32(seed)
    const g: string[] = ['', '', '']
    const sh: { d: string; w: number; dl: number; dur: number }[] = []
    for (let i = 0; i < count; i++) {
      const t = Math.pow(i / count, 1.25)
      const y = y0 + (y1 - y0) * t
      const w = (6 + width * t) * rangeRand(r, 0.35, 1)
      const xo = x + rangeRand(r, -1, 1) * (6 + (y - y0) * spread)
      const seg = `M${f(xo - w / 2)} ${f(y)}H${f(xo + w / 2)}`
      if (i < shimmer * 3 && i % 3 === 1) sh.push({ d: seg, w: 1 + t * 2.6, dl: -r() * 4, dur: 2.5 + r() * 2.5 })
      else g[t < 0.3 ? 0 : t < 0.65 ? 1 : 2] += seg
    }
    return { g, sh }
  }, [seed, x, y0, y1, width, spread, count, shimmer])
  return (
    <g stroke={color} strokeLinecap="round" opacity={opacity} fill="none">
      <path d={data.g[0]} strokeWidth={1.1} opacity={0.9} />
      <path d={data.g[1]} strokeWidth={2} opacity={0.65} />
      <path d={data.g[2]} strokeWidth={3} opacity={0.4} />
      {data.sh.map((s, i) => (
        <path
          key={i}
          d={s.d}
          strokeWidth={f(s.w)}
          className="art-shimmer"
          style={{ animationDelay: `${s.dl.toFixed(2)}s`, animationDuration: `${s.dur.toFixed(2)}s` }}
        />
      ))}
    </g>
  )
}

/** Рябь/зыбь: штрихи, редеющие к зрителю (перспектива). */
export function Swells({
  seed,
  y0,
  y1,
  color,
  opacity = 0.2,
  count = 24,
  x0 = -20,
  x1 = VW + 20,
}: {
  seed: number
  y0: number
  y1: number
  color: string
  opacity?: number
  count?: number
  x0?: number
  x1?: number
}) {
  const d = useMemo(() => {
    const r = mulberry32(seed)
    const g: string[] = ['', '', '']
    for (let i = 1; i <= count; i++) {
      const t = Math.pow(i / count, 1.7)
      const y = y0 + (y1 - y0) * t
      let x = x0 + r() * 60
      while (x < x1) {
        const len = rangeRand(r, 20, 90) * (0.6 + t * 1.6)
        g[t < 0.25 ? 0 : t < 0.6 ? 1 : 2] += `M${f(x)} ${f(y + rangeRand(r, -2, 2))}h${f(len)}`
        x += len + rangeRand(r, 30, 160) * (0.6 + t)
      }
    }
    return g
  }, [seed, y0, y1, count, x0, x1])
  return (
    <g stroke={color} strokeLinecap="round" fill="none" opacity={opacity}>
      <path d={d[0]} strokeWidth={0.8} />
      <path d={d[1]} strokeWidth={1.3} />
      <path d={d[2]} strokeWidth={2} />
    </g>
  )
}

/** Чайки/птицы — лёгкие «галочки». */
export function birdsD(seed: number, x0: number, x1: number, y0: number, y1: number, n: number, s = 1): string {
  const r = mulberry32(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const x = rangeRand(r, x0, x1)
    const y = rangeRand(r, y0, y1)
    const w = rangeRand(r, 6, 11) * s
    const lift = rangeRand(r, 0.25, 0.55) * w
    d += `M${f(x - w)} ${f(y - lift)}Q${f(x - w * 0.45)} ${f(y - lift * 0.9)} ${f(x)} ${f(y + 1)}Q${f(x + w * 0.45)} ${f(y - lift * 0.9)} ${f(x + w)} ${f(y - lift)}Q${f(x + w * 0.4)} ${f(y - lift * 0.35)} ${f(x)} ${f(y + 3)}Q${f(x - w * 0.4)} ${f(y - lift * 0.35)} ${f(x - w)} ${f(y - lift)}Z`
  }
  return d
}
