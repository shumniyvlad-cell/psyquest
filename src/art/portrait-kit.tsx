// Общие детали портретов: силуэт с контровым светом, светящиеся глаза с веками, брови.
import type { ReactNode } from 'react'
import { f } from './geom'

export type Mood = 'neutral' | 'happy' | 'thinking' | 'worried' | 'proud'

export interface Part {
  d: string
  t?: string
}

export interface RimLight {
  color: string
  dx: number
  dy: number
  o: number
}

/** Силуэт: сначала все «канты» (смещённые копии), затем заливка — кант виден только по внешнему краю. */
export function Silhouette({ parts, fill, rims }: { parts: Part[]; fill: string; rims: RimLight[] }) {
  return (
    <g>
      {rims.map((rm, i) => (
        <g key={i} fill={rm.color} opacity={rm.o} transform={`translate(${rm.dx} ${rm.dy})`}>
          {parts.map((p, k) => (
            <path key={k} d={p.d} transform={p.t} />
          ))}
        </g>
      ))}
      <g fill={fill}>
        {parts.map((p, k) => (
          <path key={k} d={p.d} transform={p.t} />
        ))}
      </g>
    </g>
  )
}

/** Градиенты глаза: свечение и радужка. */
export function EyeDefs({ id, color, hot = '#fff3cf', deep }: { id: string; color: string; hot?: string; deep?: string }) {
  return (
    <>
      <radialGradient id={`${id}g`}>
        <stop offset="0" stopColor={color} stopOpacity="0.75" />
        <stop offset="0.35" stopColor={color} stopOpacity="0.28" />
        <stop offset="0.7" stopColor={color} stopOpacity="0.07" />
        <stop offset="1" stopColor={color} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}i`} cx="0.45" cy="0.42" r="0.62">
        <stop offset="0" stopColor={hot} />
        <stop offset="0.45" stopColor={color} />
        <stop offset="1" stopColor={deep ?? color} />
      </radialGradient>
    </>
  )
}

export interface EyeSpec {
  x: number
  y: number
  r: number
  ry?: number
  /** -1 — левый глаз (на экране), 1 — правый */
  side: -1 | 1
  pupil?: number
  look?: [number, number]
  /** доля глаза, закрытая верхним веком */
  upper?: number
  /** доля снизу («улыбающиеся» глаза) */
  lower?: number
  /** наклон верхнего века: + внутренний угол ниже (строгий), − выше (тревога) */
  tilt?: number
  lid: string
  glow?: number
  /** угол миндалевидного глаза */
  rot?: number
  blinkDelay?: number
  pupilColor?: string
  slit?: boolean
}

export function GlowEye({ id, e, gid }: { id: string; e: EyeSpec; gid: string }) {
  const ry = e.ry ?? e.r
  const up = e.upper ?? 0
  const lo = e.lower ?? 0
  const tilt = (e.tilt ?? 0) * (e.side === -1 ? 1 : -1)
  const yEdge = e.y - ry + 2 * ry * up
  const px = e.x + (e.look?.[0] ?? 0) * e.r
  const py = e.y + (e.look?.[1] ?? 0) * ry
  const pr = (e.pupil ?? 0.45) * e.r
  const rot = e.rot ? `rotate(${f(e.rot * (e.side === -1 ? 1 : -1))} ${f(e.x)} ${f(e.y)})` : undefined
  return (
    <g>
      <circle className="art-pt-glow" cx={f(e.x)} cy={f(e.y)} r={f(e.r * (e.glow ?? 2.6))} fill={`url(#${gid}g)`} />
      <clipPath id={id}>
        <ellipse cx={f(e.x)} cy={f(e.y)} rx={f(e.r)} ry={f(ry)} transform={rot} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <ellipse cx={f(e.x)} cy={f(e.y)} rx={f(e.r)} ry={f(ry)} fill={`url(#${gid}i)`} transform={rot} />
        {pr > 0 &&
          (e.slit ? (
            <ellipse cx={f(px)} cy={f(py)} rx={f(pr * 0.38)} ry={f(pr * 1.5)} fill={e.pupilColor ?? '#140a16'} />
          ) : (
            <circle cx={f(px)} cy={f(py)} r={f(pr)} fill={e.pupilColor ?? '#140a16'} />
          ))}
        <circle cx={f(px - pr * 0.45 - e.r * 0.12)} cy={f(py - pr * 0.5 - ry * 0.1)} r={f(Math.max(1.2, e.r * 0.16))} fill="#fffdf6" opacity={0.9} />
        {up > 0 && (
          <rect
            x={f(e.x - e.r * 2)}
            y={f(e.y - ry * 3)}
            width={f(e.r * 4)}
            height={f(yEdge - (e.y - ry * 3))}
            fill={e.lid}
            transform={`rotate(${f(tilt)} ${f(e.x)} ${f(yEdge)})`}
          />
        )}
        {lo > 0 && (
          <ellipse cx={f(e.x)} cy={f(e.y + ry * (2.15 - 2 * lo) )} rx={f(e.r * 1.7)} ry={f(ry * 1.3)} fill={e.lid} />
        )}
        <rect
          className="art-lid"
          style={e.blinkDelay ? { animationDelay: `${e.blinkDelay}s` } : undefined}
          x={f(e.x - e.r * 1.3)}
          y={f(e.y - ry * 1.2)}
          width={f(e.r * 2.6)}
          height={f(ry * 2.4)}
          fill={e.lid}
        />
      </g>
    </g>
  )
}

/** Настройки мимики по настроению (общие для персонажей). */
export interface MoodFace {
  tilt: number
  dy: number
  upper: number
  lower: number
  lidTilt: number
  look: [number, number]
  pupil: number
  /** брови: подъём (−вверх) и наклон (+ внутренний угол вниз) */
  browDy: number
  browTilt: number
}

export const FACE: Record<Mood, MoodFace> = {
  neutral: { tilt: 0, dy: 0, upper: 0.14, lower: 0, lidTilt: 0, look: [0, 0.05], pupil: 0.46, browDy: 0, browTilt: 0 },
  happy: { tilt: 5, dy: -2, upper: 0, lower: 0.6, lidTilt: 0, look: [0, 0.34], pupil: 0.4, browDy: -5, browTilt: -6 },
  thinking: { tilt: -7, dy: 0, upper: 0.24, lower: 0.04, lidTilt: 4, look: [0.34, -0.14], pupil: 0.42, browDy: -2, browTilt: 8 },
  worried: { tilt: 2, dy: 8, upper: 0.12, lower: 0, lidTilt: -20, look: [0, 0.12], pupil: 0.32, browDy: -3, browTilt: -18 },
  proud: { tilt: -4, dy: -6, upper: 0.44, lower: 0.08, lidTilt: 6, look: [0, 0.18], pupil: 0.44, browDy: 2, browTilt: 4 },
}

/** Бровь-перо/мех: сужающийся штрих, наклон по настроению. */
export function brow(x0: number, y0: number, x1: number, y1: number, w: number, side: -1 | 1, m: MoodFace): string {
  // x0,y0 — внутренний конец; x1,y1 — внешний
  const t = (m.browTilt * Math.PI) / 180
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2 + m.browDy
  const rot = (px: number, py: number): [number, number] => {
    const dx = px - cx
    const dy = py - (cy - m.browDy)
    // знак: для левой брови внутренний конец справа
    const a = t * (side === -1 ? 1 : -1)
    return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]
  }
  const [ax, ay] = rot(x0, y0)
  const [bx, by] = rot(x1, y1)
  const nx = -(by - ay)
  const ny = bx - ax
  const len = Math.hypot(nx, ny) || 1
  const ox = (nx / len) * w
  const oy = (ny / len) * w
  const mx = (ax + bx) / 2 - ox * 0.6
  const my = (ay + by) / 2 - Math.abs(oy) * 0.8 - 2
  return `M${f(ax)} ${f(ay)}Q${f(mx)} ${f(my)} ${f(bx)} ${f(by)}Q${f(mx + ox * 0.3)} ${f(my + w * 1.2)} ${f(ax)} ${f(ay + w * 0.9)}Z`
}

export function Group({ t, children, className }: { t?: string; children: ReactNode; className?: string }) {
  return (
    <g transform={t} className={className}>
      {children}
    </g>
  )
}
