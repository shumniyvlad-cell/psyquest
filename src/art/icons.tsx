// Иконки локаций для карты мира: медальон 64×64, силуэт + свет.
// lit=false — локация в тумане: приглушённо, без огней; lit=true — тёплое свечение.
import type { JSX, ReactNode } from 'react'
import './art.css'
import { useUid } from './geom'

export type PlaceId = 'camp' | 'doubt' | 'forest' | 'forge' | 'tower' | 'studio' | 'launch' | 'arena' | 'lighthouse' | 'gate'

interface Ink {
  s: string
  lit: boolean
  warm: string
  hot: string
  glow: string
  beam: string
  cyan: string
}

const GROUND = 'M0 47Q32 41 64 47V64H0Z'

function Spark({ x, y, r, c, glow }: { x: number; y: number; r: number; c: string; glow: string }) {
  return (
    <>
      <circle cx={x} cy={y} r={r * 3.4} fill={glow} opacity={0.9} />
      <circle cx={x} cy={y} r={r} fill={c} />
    </>
  )
}

const ICONS: Record<PlaceId, (k: Ink) => ReactNode> = {
  camp: ({ s, lit, warm, glow }) => (
    <>
      <path d="M44 47L48.5 30L53 47Z M46 40L48.5 34L51 40Z" fill={s} />
      <path d="M46.5 47L48.5 26L50.5 47" fill={s} />
      <path d="M36 25h3.2v7H36Z" fill={s} />
      <path d="M17 36L29 26L41 36L39.6 37L29 29L18.4 37Z" fill={s} />
      <path d="M20 35.5H38V47H20Z" fill={s} />
      {lit && <circle cx={25.5} cy={40.5} r={7} fill={glow} />}
      <path d="M23.5 38.5h4.4v4.4h-4.4Z" fill={lit ? warm : '#1a1d3a'} />
      <path d="M31.5 47V40.5Q33 39 34.5 40.5V47Z" fill={lit ? warm : '#1a1d3a'} opacity={lit ? 0.85 : 1} />
    </>
  ),
  doubt: ({ s, lit, hot, glow }) => (
    <>
      <path d="M9 47C11 38 12 32 10 24M10.6 33L6 28M10.6 29L14 24M11 38L15 34" stroke={s} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      {lit && <circle cx={32} cy={31} r={14} fill={glow} />}
      <path d="M22 47Q23 42 32 41Q41 42 42 47Z" fill={s} />
      <ellipse cx={32} cy={31} rx={7.4} ry={10} fill={s} />
      <ellipse cx={32} cy={31} rx={5.4} ry={7.8} fill={lit ? '#c9c3ea' : '#3a3b60'} />
      <path d="M29 26Q31 23.5 34 24L29.5 31Q28.4 28.5 29 26Z" fill="#ffffff" opacity={lit ? 0.4 : 0.12} />
      {lit && <circle cx={33} cy={33} r={1.4} fill={hot} />}
      <circle cx={32} cy={19.6} r={1.3} fill={s} />
    </>
  ),
  forest: ({ s, lit, glow }) => (
    <>
      <path d="M20 47L20 44L13 44L17.5 38L15 38L19.5 31.5L17.5 31.5L21 25L24.5 31.5L22.5 31.5L27 38L24.5 38L29 44L22 44L22 47Z" fill={s} />
      <path d="M33 47L33 43L24 43L29.5 35L26.5 35L31.5 27L29 27L34 18L39 27L36.5 27L41.5 35L38.5 35L44 43L35 43L35 47Z" fill={s} />
      <path d="M46 47L46 44.5L40.5 44.5L44 39.5L42 39.5L45.5 34L44 34L47 28.5L50 34L48.5 34L52 39.5L50 39.5L53.5 44.5L48 44.5L48 47Z" fill={s} />
      {lit && (
        <>
          <Spark x={27} y={46} r={1.2} c="#8ff5da" glow={glow} />
          <Spark x={40} y={45.5} r={1.1} c="#8ff5da" glow={glow} />
          <Spark x={24} y={30} r={0.8} c="#ffe39a" glow={glow} />
          <Spark x={44} y={24} r={0.8} c="#ffe39a" glow={glow} />
        </>
      )}
    </>
  ),
  forge: ({ s, lit, warm, hot, glow }) => (
    <>
      {lit && <circle cx={32} cy={27} r={15} fill={glow} />}
      {lit ? (
        <>
          <path d="M32 14C37 20 38 26 32 31C26 26 27 20 32 14Z" fill={warm} />
          <path d="M32 21C34.4 24 34.6 27 32 29.4C29.4 27 29.6 24 32 21Z" fill={hot} />
          <circle cx={24} cy={19} r={0.9} fill={hot} />
          <circle cx={41} cy={16} r={0.8} fill={hot} />
          <circle cx={38} cy={22} r={0.7} fill={hot} />
        </>
      ) : (
        <path d="M32 18C35 22 35.5 26 32 29C28.5 26 29 22 32 18Z" fill="#23264a" />
      )}
      <path d="M15 33.5Q20 32 24 32H45L46.5 33.2L46.5 36L42 36.8L38.6 39.5L38.6 42L42 44.5L42 47H24L24 44.5L27.4 42L27.4 39.5L24 36.8L20 36Q16.5 35.5 15 33.5Z" fill={s} />
      {lit && <path d="M24 32H45" stroke={hot} strokeWidth={1} opacity={0.7} />}
    </>
  ),
  tower: ({ s, lit, hot, glow, cyan }) => (
    <>
      {lit && <circle cx={32} cy={20} r={12} fill={cyan} />}
      <path d="M28 47L29.4 22H34.6L36 47Z" fill={s} />
      <path d="M26.5 22.5H37.5V20.5H26.5Z" fill={s} />
      <path d="M29 20.5V16.5Q32 14 35 16.5V20.5Z" fill={s} />
      <path d="M32 14.5V7" stroke={s} strokeWidth={1.2} />
      <circle cx={21} cy={36} r={5.2} fill={s} />
      <circle cx={21} cy={36} r={1.8} fill={lit ? '#1b2250' : '#1a1d3a'} />
      {lit ? (
        <>
          <circle cx={32} cy={7} r={3.2} fill={glow} />
          <circle cx={32} cy={7} r={1.2} fill="#ff8a7a" />
          <circle cx={32} cy={18} r={1.5} fill="#8ff3ff" />
          <path d="M31 27h2v2.6h-2ZM31.2 34h2v2.6h-2ZM31 40.5h2v2.6h-2Z" fill="#8ff3ff" />
          <circle cx={32} cy={18} r={0.6} fill={hot} />
        </>
      ) : (
        <path d="M31 27h2v2.6h-2ZM31.2 34h2v2.6h-2Z" fill="#1a1d3a" />
      )}
    </>
  ),
  studio: ({ s, lit, warm, glow }) => (
    <>
      {lit && <circle cx={32} cy={24} r={13} fill={glow} />}
      <circle cx={32} cy={24} r={8} fill="none" stroke={lit ? warm : '#2a2d50'} strokeWidth={2.2} />
      <path d="M32 32V47M28 47L32 42L36 47" stroke={s} strokeWidth={1.4} fill="none" />
      <path d="M13 47L15 36L17.5 32L19.5 36L20 47Z" fill={lit ? '#ff8fb1' : s} opacity={lit ? 0.95 : 1} />
      <path d="M18.5 47L21 39L23 36.5L24.5 39.5L24 47Z" fill={lit ? '#c07aff' : s} />
      <path d="M41 47L42.5 38L45 34L47.5 38L47.5 47Z" fill={lit ? '#6fe3c8' : s} />
      <path d="M47 47L48.5 41L50.5 39L52 42L51.5 47Z" fill={lit ? '#9a86ff' : s} />
      {lit && <path d="M17.5 32V47M45 34V47" stroke="#ffffff" strokeWidth={0.6} opacity={0.6} />}
    </>
  ),
  launch: ({ s, lit, warm, hot, glow }) => (
    <>
      {lit && (
        <g>
          <circle cx={32} cy={17} r={9} fill={glow} />
          <path
            d="M32 11V8.5M32 23V25.5M26 17H23.5M38 17H40.5M27.8 12.8L26 11M36.2 12.8L38 11M27.8 21.2L26 23M36.2 21.2L38 23"
            stroke={warm}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <circle cx={32} cy={17} r={1.3} fill={hot} />
        </g>
      )}
      <path d="M8 47V36L13 31L18 36V47ZM18 47V38H21V33H24V38H27V47ZM27 47V33L32 28L37 33V47ZM37 47V37L42 33L47 37V47ZM47 47V35H56V47Z" fill={s} />
      <path d="M8 34Q20 40 32 33Q44 40 56 34" fill="none" stroke={lit ? warm : '#2a2d50'} strokeWidth={0.8} strokeDasharray="1.6 1.6" />
      <path d="M12 40h2v2.6h-2ZM30.8 37h2.4v3h-2.4ZM41 40h2v2.6h-2ZM50 39h2v2.6h-2Z" fill={lit ? warm : '#1a1d3a'} />
    </>
  ),
  arena: ({ s, lit, warm, glow }) => (
    <>
      {lit && <circle cx={32} cy={38} r={16} fill={glow} />}
      <path d="M9 47V33Q32 26 55 33V47Z" fill={s} />
      <path d="M13 47V41A2.5 2.5 0 0 1 18 41V47ZM21.5 47V40A3 3 0 0 1 27.5 40V47ZM29 47V39.5A3 3 0 0 1 35 39.5V47ZM36.5 47V40A3 3 0 0 1 42.5 40V47ZM46 47V41A2.5 2.5 0 0 1 51 41V47Z" fill={lit ? warm : '#1a1d3a'} opacity={lit ? 0.9 : 1} />
      <path d="M14 34.5A2 2 0 0 1 18 34.5V37H14ZM22.5 33.5A2 2 0 0 1 26.5 33.5V36H22.5ZM30 33A2 2 0 0 1 34 33V35.5H30ZM37.5 33.5A2 2 0 0 1 41.5 33.5V36H37.5ZM46 34.5A2 2 0 0 1 50 34.5V37H46Z" fill={lit ? warm : '#1a1d3a'} opacity={lit ? 0.7 : 1} />
      <path d="M32 29V18" stroke={s} strokeWidth={1.2} />
      <path d="M32.6 18Q37 17 41 18.4L38.6 20.6L41 23Q37 21.6 32.6 22.6Z" fill={lit ? '#d23a52' : '#2a2d50'} />
    </>
  ),
  lighthouse: ({ s, lit, hot, glow, beam }) => (
    <>
      {lit && (
        <>
          <path d="M32 17L60 11V23Z" fill={beam} />
          <circle cx={32} cy={17} r={10} fill={glow} />
        </>
      )}
      <path d="M8 47Q20 43 26 44L28.6 22H35.4L38 44Q46 43 56 47Z" fill={s} />
      <path d="M27 22.4H37V20.6H27Z" fill={s} />
      <path d="M29.2 20.6V14.6H34.8V20.6Z" fill={lit ? '#ffe7a8' : '#23264a'} />
      <path d="M28.6 14.8Q32 10.6 35.4 14.8Z" fill={s} />
      <path d="M32 11V8.6" stroke={s} strokeWidth={1} />
      {lit && <circle cx={32} cy={17.6} r={1.6} fill={hot} />}
      <path d="M29.5 29H34.5V31.5H29.5ZM29.2 36H34.8V38.5H29.2Z" fill={lit ? '#1b2250' : '#1a1d3a'} opacity={0.9} />
    </>
  ),
  gate: ({ s, lit, warm, hot, glow }) => (
    <>
      {lit && <circle cx={32} cy={34} r={15} fill={glow} />}
      <path d="M14 47V28Q14 14 32 13Q50 14 50 28V47H43V29Q43 21 32 20.5Q21 21 21 29V47Z" fill={s} />
      <path d="M12 47H20V44H12ZM44 47H52V44H44Z" fill={s} />
      <path d="M21.5 47V29.5Q21.5 21.5 31.6 21V47Z" fill={lit ? '#141a44' : '#1e2140'} />
      <path d="M32.4 47V21Q42.5 21.5 42.5 29.5V47Z" fill={lit ? '#141a44' : '#1e2140'} />
      {lit && <path d="M31.4 22V47H32.6V22Z" fill={warm} />}
      <path d="M29.6 33.5V31.6Q29.6 29 32 29Q34.4 29 34.4 31.6V33.5" fill="none" stroke={lit ? hot : '#3a3d62'} strokeWidth={1.2} />
      <rect x={28.6} y={33} width={6.8} height={5.6} rx={1.2} fill={lit ? '#e2aa52' : '#3a3d62'} />
      <circle cx={32} cy={35.4} r={0.9} fill={lit ? '#5a3410' : '#1e2140'} />
      <path d="M32 13V9.6M29.6 10.6L32 8.2L34.4 10.6" stroke={s} strokeWidth={1} fill="none" />
    </>
  ),
}

export function PlaceIcon({ id, lit, size = 64 }: { id: PlaceId; lit: boolean; size?: number }): JSX.Element {
  const u = useUid()
  const k: Ink = {
    s: lit ? '#080b20' : '#262946',
    lit,
    warm: '#ffc56a',
    hot: '#fff3d0',
    glow: `url(#${u}g)`,
    beam: `url(#${u}beam)`,
    cyan: `url(#${u}tg)`,
  }
  return (
    <svg className="art-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id={`${u}h`}>
          <stop offset="0.55" stopColor="#ffb547" stopOpacity="0.32" />
          <stop offset="0.8" stopColor="#ffb547" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${u}g`}>
          <stop offset="0" stopColor="#ffc56a" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#ffb547" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${u}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lit ? '#27306e' : '#1d2040'} />
          <stop offset="0.7" stopColor={lit ? '#172058' : '#16182f'} />
          <stop offset="1" stopColor={lit ? '#10163e' : '#111326'} />
        </linearGradient>
        <linearGradient id={`${u}beam`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffe3a0" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffe3a0" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${u}tg`}>
          <stop offset="0" stopColor="#6fe3f0" stopOpacity="0.5" />
          <stop offset="1" stopColor="#6fe3f0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${u}fog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8e8bb8" stopOpacity="0" />
          <stop offset="0.5" stopColor="#8e8bb8" stopOpacity="0.42" />
          <stop offset="1" stopColor="#8e8bb8" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${u}c`}>
          <circle cx={32} cy={32} r={27.2} />
        </clipPath>
      </defs>
      {lit && <circle cx={32} cy={32} r={40} fill={`url(#${u}h)`} />}
      <circle cx={32} cy={32} r={28} fill={`url(#${u}bg)`} />
      <g clipPath={`url(#${u}c)`}>
        <g fill="#fdf6e3" opacity={lit ? 0.9 : 0.35}>
          <circle cx={16} cy={16} r={0.7} />
          <circle cx={47} cy={13} r={0.6} />
          <circle cx={53} cy={24} r={0.5} />
          <circle cx={11} cy={27} r={0.5} />
        </g>
        {ICONS[id](k)}
        <path d={GROUND} fill={k.s} />
        {lit && <path d="M0 47Q32 41 64 47" fill="none" stroke="#ffcf80" strokeWidth={0.8} opacity={0.35} />}
        {!lit && (
          <g fill={`url(#${u}fog)`}>
            <rect x={-4} y={16} width={72} height={12} opacity={0.5} />
            <rect x={-4} y={27} width={72} height={14} opacity={0.75} />
            <rect x={-4} y={37} width={72} height={16} />
          </g>
        )}
      </g>
      <circle cx={32} cy={32} r={28} fill="none" stroke={lit ? '#ffd68a' : '#8e8bb8'} strokeOpacity={lit ? 0.75 : 0.32} strokeWidth={1.5} />
      {lit && <circle cx={32} cy={32} r={25.6} fill="none" stroke="#ffd68a" strokeOpacity={0.18} strokeWidth={0.8} />}
    </svg>
  )
}
