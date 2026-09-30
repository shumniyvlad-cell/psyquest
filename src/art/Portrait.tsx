// Портреты NPC для диалогов: силуэты с контровым светом и светящимися глазами.
// viewBox 300×360, прозрачный фон, персонаж стоит на нижней кромке.
import type { JSX } from 'react'
import './art.css'
import { cx, f, smooth, useUid, type Pt } from './geom'
import { FACE, EyeDefs, GlowEye, Silhouette, brow, type Mood, type MoodFace, type Part, type RimLight } from './portrait-kit'

export type { Mood } from './portrait-kit'
export type NpcId = 'owl' | 'bear' | 'robot' | 'fox' | 'raven' | 'lion'

/** Симметричный контур: половина (от верхней точки на оси до нижней на оси) + зеркало. */
function sym(half: Pt[], c = 150): Pt[] {
  const left = half
    .slice(1, -1)
    .reverse()
    .map((p): Pt => (p.length === 3 ? [2 * c - p[0], p[1], p[2]] : [2 * c - p[0], p[1]]))
  return [...half, ...left]
}
const S = (pts: Pt[]) => smooth(pts, true)
const mirrorX = (pts: Pt[], c = 150): Pt[] => pts.map((p): Pt => (p.length === 3 ? [2 * c - p[0], p[1], p[2]] : [2 * c - p[0], p[1]]))

const COOL: RimLight = { color: '#bdb8f4', dx: -2.4, dy: -2, o: 0.5 }

interface CharProps {
  u: string
  m: MoodFace
  mood: Mood
}

// ============ Сова Юнга ============

const OWL_BODY = S(
  sym([
    [150, 176],
    [196, 182],
    [236, 202],
    [256, 240],
    [260, 290],
    [246, 332],
    [212, 354],
    [150, 360],
  ]),
)
const OWL_HEAD = S(
  sym([
    [150, 76],
    [192, 80],
    [230, 100],
    [250, 136],
    [250, 176],
    [230, 208],
    [192, 226],
    [150, 232],
  ]),
)
const OWL_DISC = S(
  sym([
    [150, 122, 0.4],
    [178, 110],
    [214, 116],
    [234, 142],
    [232, 174],
    [212, 196],
    [182, 206],
    [150, 214, 0.2],
  ]),
)

function owlTuft(side: -1 | 1, mood: Mood): string {
  const k = mood === 'worried' ? 2 : mood === 'happy' || mood === 'proud' ? 0 : 1
  const tips: [Pt, Pt][] = [
    [
      [56, 44, 0],
      [70, 56, 0],
    ],
    [
      [50, 58, 0],
      [66, 66, 0],
    ],
    [
      [36, 104, 0],
      [46, 90, 0],
    ],
  ]
  const [t1, t2] = tips[k]
  const pts: Pt[] = [[70, 118], [62, 88], t1, [72, 76], t2, [86, 78], [112, 86]]
  return S(side === -1 ? pts : mirrorX(pts))
}

function owlWing(side: -1 | 1, mood: Mood): string {
  let pts: Pt[]
  if (mood === 'thinking' && side === 1) {
    // крыло у клюва: через грудь вверх
    pts = [
      [236, 206],
      [256, 250],
      [240, 296],
      [204, 290],
      [180, 248],
      [164, 206, 0],
      [184, 212],
      [206, 246],
      [222, 262],
      [224, 226],
    ]
    return S(pts)
  }
  pts = [
    [66, 208],
    [48, 240],
    [40, 284],
    [46, 324],
    [60, 348, 0],
    [78, 330],
    [88, 290],
    [90, 246],
    [82, 216],
  ]
  const rot =
    mood === 'happy' ? -12 : mood === 'proud' ? -20 : mood === 'worried' ? 12 : 0
  const p = side === -1 ? pts : mirrorX(pts)
  if (!rot) return S(p)
  const a = ((rot * Math.PI) / 180) * (side === -1 ? 1 : -1)
  const ox = side === -1 ? 72 : 228
  const oy = 214
  return S(
    p.map((q): Pt => {
      const dx = q[0] - ox
      const dy = q[1] - oy
      const nx = ox + dx * Math.cos(a) - dy * Math.sin(a)
      const ny = oy + dx * Math.sin(a) + dy * Math.cos(a)
      return q.length === 3 ? [nx, ny, q[2]] : [nx, ny]
    }),
  )
}

function Owl({ u, m, mood }: CharProps) {
  const head = `translate(0 ${m.dy}) rotate(${m.tilt} 150 214)`
  const puff = mood === 'proud' ? 'translate(150 300) scale(1.06 1) translate(-150 -300)' : undefined
  const warm: RimLight = { color: '#ffb547', dx: 2, dy: 1.6, o: 0.32 }
  const eyeBase = { r: 23, lid: '#232964', glow: 2.5 }
  const eyes = ([-1, 1] as const).map((side) => ({
    ...eyeBase,
    side,
    x: 150 + side * 37,
    y: 154,
    upper: m.upper,
    lower: m.lower,
    tilt: m.lidTilt,
    look: m.look,
    pupil: m.pupil + 0.08,
    blinkDelay: side === 1 ? -0.04 : 0,
  }))
  const wingL = owlWing(-1, mood)
  const wingR = owlWing(1, mood)
  return (
    <g>
      <defs>
        <linearGradient id={`${u}b`} x1="70" y1="80" x2="250" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#262c64" />
          <stop offset="0.55" stopColor="#151a44" />
          <stop offset="1" stopColor="#0a0d26" />
        </linearGradient>
        <radialGradient id={`${u}d`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#2e3574" />
          <stop offset="1" stopColor="#1e2358" />
        </radialGradient>
        <EyeDefs id={`${u}e`} color="#ffb547" hot="#fff0c4" deep="#d9822b" />
      </defs>
      <g transform={puff}>
        <Silhouette parts={[{ d: OWL_BODY }]} fill={`url(#${u}b)`} rims={[COOL, warm]} />
        {/* перья на груди */}
        <path
          d={[0, 1, 2, 3]
            .map((row) =>
              [-2, -1, 0, 1, 2]
                .filter((c) => Math.abs(c) + row * 0.5 < 3)
                .map((c) => {
                  const x = 150 + c * 26 + (row % 2) * 13
                  const y = 270 + row * 22
                  return `M${x - 8} ${y}Q${x} ${y + 7} ${x + 8} ${y}`
                })
                .join(''),
            )
            .join('')}
          fill="none"
          stroke="#2c3274"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.8}
        />
      </g>
      {/* лапы */}
      <path d="M122 352l-8 8M128 352v8M134 352l6 8M166 352l-6 8M172 352v8M178 352l8 8" stroke="#8a6a3a" strokeWidth={3.4} strokeLinecap="round" />
      <Silhouette parts={[{ d: wingL }, ...(mood === 'thinking' ? [] : [{ d: wingR }])]} fill={`url(#${u}b)`} rims={[{ ...COOL, o: 0.35 }]} />
      <path
        d="M52 300q8 10 18 12M50 320q9 8 18 8M248 300q-8 10 -18 12M250 320q-9 8 -18 8"
        fill="none"
        stroke="#2c3274"
        strokeWidth={1.8}
        opacity={mood === 'thinking' ? 0 : 0.7}
      />
      <g transform={head}>
        <Silhouette
          parts={[{ d: OWL_HEAD }, { d: owlTuft(-1, mood) }, { d: owlTuft(1, mood) }]}
          fill={`url(#${u}b)`}
          rims={[COOL, warm]}
        />
        <path d={OWL_DISC} fill={`url(#${u}d)`} />
        {/* лобные перья */}
        <path d="M150 124Q142 104 150 90Q158 104 150 124Z" fill="#2c3274" opacity={0.9} />
        {eyes.map((e, i) => (
          <GlowEye key={i} id={`${u}c${i}`} gid={`${u}e`} e={e} />
        ))}
        {/* очки */}
        <g fill="none" stroke="#e2aa52" strokeWidth={4.2}>
          <circle cx={113} cy={154} r={30} />
          <circle cx={187} cy={154} r={30} />
          <path d="M143 150Q150 142 157 150" strokeWidth={3.4} />
          <path d="M83 148L60 140M217 148L240 140" strokeWidth={3} />
        </g>
        <g fill="none" stroke="#fff6e0" strokeWidth={2.2} opacity={0.4} strokeLinecap="round">
          <path d="M92 142A22 22 0 0 1 106 131" />
          <path d="M166 142A22 22 0 0 1 180 131" />
        </g>
        {/* брови-перья */}
        <g fill="#343c86">
          <path d={brow(140, 118, 90, 112, 5, -1, mood === 'thinking' ? { ...m, browDy: -8, browTilt: -6 } : m)} />
          <path d={brow(160, 118, 210, 112, 5, 1, mood === 'thinking' ? { ...m, browDy: 3, browTilt: 10 } : m)} />
        </g>
        {/* клюв */}
        <path d="M140 176Q150 168 160 176Q158 190 150 202Q142 190 140 176Z" fill="#c78d3c" />
        <path d="M143 186Q150 196 157 186Q155 194 150 202Q145 194 143 186Z" fill="#8f5f24" />
        <path d="M144 176Q150 172 156 176" stroke="#ffe2a6" strokeWidth={1.4} fill="none" opacity={0.7} />
      </g>
      {/* шарф */}
      <g>
        <path d="M58 228Q104 250 150 252Q196 250 242 228L246 248Q200 272 150 274Q100 272 54 248Z" fill="#1d5a62" />
        <path d="M58 228Q104 250 150 252Q196 250 242 228" fill="none" stroke="#7fe8d0" strokeWidth={1.6} opacity={0.55} />
        <path d="M78 246Q112 262 150 263Q188 262 222 246" fill="none" stroke="#3fb5a0" strokeWidth={3} opacity={0.7} />
        <path d="M192 256Q206 262 218 262L230 320Q218 326 206 324L196 272Z" fill="#1d5a62" />
        <path d="M200 280L224 282M203 298L226 300" stroke="#3fb5a0" strokeWidth={3.4} opacity={0.75} />
        <path d="M208 324l-2 8M214 325l-1 8M220 324l0 8M226 322l1 8" stroke="#1d5a62" strokeWidth={2} strokeLinecap="round" />
      </g>
      {mood === 'thinking' && (
        <Silhouette parts={[{ d: wingR }]} fill={`url(#${u}b)`} rims={[{ ...COOL, o: 0.45 }, { ...warm, o: 0.4 }]} />
      )}
    </g>
  )
}

// ============ Медведь-кузнец Бер ============

const BEAR_BODY = S(
  sym([
    [150, 200],
    [206, 206],
    [248, 226],
    [276, 258],
    [292, 306],
    [298, 362, 0],
    [150, 362],
  ]),
)
const BEAR_HEAD = S(
  sym([
    [150, 70],
    [194, 76],
    [218, 102],
    [226, 140],
    [216, 176],
    [192, 200],
    [150, 212],
  ]),
)

function Bear({ u, m, mood }: CharProps) {
  const head = `translate(0 ${m.dy}) rotate(${m.tilt} 150 210)`
  const warm: RimLight = { color: '#ff9a4a', dx: 2.2, dy: 1.8, o: 0.7 }
  const earRot = mood === 'worried' ? 18 : 0
  const ears = [
    { d: S([[70, 96], [74, 68], [96, 60], [116, 72], [112, 96]]), t: `rotate(${-earRot} 100 90)` },
    { d: S(mirrorX([[70, 96], [74, 68], [96, 60], [116, 72], [112, 96]])), t: `rotate(${earRot} 200 90)` },
  ]
  const eyes = ([-1, 1] as const).map((side) => ({
    side,
    x: 150 + side * 27,
    y: 134,
    r: 7,
    ry: 6.5,
    lid: '#1a1530',
    upper: m.upper + 0.06,
    lower: m.lower,
    tilt: m.lidTilt,
    look: m.look,
    pupil: 0.4,
    glow: 3.4,
  }))
  const thinking = mood === 'thinking'
  const proud = mood === 'proud'
  const hammerRot = proud ? -10 : 0
  const mouth =
    mood === 'happy'
      ? 'M132 180Q150 204 168 180Q150 190 132 180Z'
      : mood === 'worried'
        ? 'M138 188Q144 182 150 186Q156 182 162 188'
        : proud
          ? 'M134 182Q150 194 166 182'
          : 'M138 184Q150 190 162 184'
  return (
    <g>
      <defs>
        <linearGradient id={`${u}b`} x1="60" y1="60" x2="250" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2b2446" />
          <stop offset="0.6" stopColor="#191431" />
          <stop offset="1" stopColor="#0e0a1f" />
        </linearGradient>
        <radialGradient id={`${u}w`} cx="150" cy="430" r="300" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff7a2a" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#ff6a2a" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ff6a2a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${u}a`} x1="0" y1="220" x2="0" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4d2e1e" />
          <stop offset="1" stopColor="#2a160e" />
        </linearGradient>
        <EyeDefs id={`${u}e`} color="#ffb547" hot="#fff0c4" />
        <clipPath id={`${u}clip`}>
          <path d={BEAR_BODY} />
        </clipPath>
      </defs>
      {/* молот на плече — рукоять от кулака через плечо, боёк за головой */}
      <g transform={`rotate(${hammerRot} 214 300)`}>
        <path d="M212 306L256 140" stroke="#2a1a14" strokeWidth={11} strokeLinecap="round" />
        <path d="M212 306L256 140" stroke="#ff9a4a" strokeWidth={1.6} opacity={0.5} transform="translate(4.5 1)" />
        <g transform="rotate(15 257 132)">
          <rect x={218} y={112} width={80} height={40} rx={6} fill="#1e2244" />
          <rect x={218} y={112} width={80} height={40} rx={6} fill="none" stroke="#9aa6e0" strokeWidth={1.4} opacity={0.35} />
          <path d="M224 152H292" stroke="#ffb46a" strokeWidth={2} opacity={0.55} />
          <rect x={214} y={108} width={10} height={48} rx={3} fill="#161a38" />
          <rect x={292} y={108} width={10} height={48} rx={3} fill="#161a38" />
        </g>
      </g>
      <Silhouette parts={[{ d: BEAR_BODY }]} fill={`url(#${u}b)`} rims={[COOL, warm]} />
      {/* фартук */}
      <path d="M112 232L188 232L198 268L214 362L86 362L102 268Z" fill={`url(#${u}a)`} />
      <path d="M112 232L188 232L198 268L214 362M86 362L102 268L112 232" fill="none" stroke="#b07a4a" strokeWidth={1.6} strokeDasharray="4 4" opacity={0.6} />
      <path d="M112 232L122 206M188 232L178 206" stroke="#3a2216" strokeWidth={6} strokeLinecap="round" />
      <rect x={128} y={290} width={46} height={40} rx={4} fill="#3a2216" />
      <path d="M128 290h46" stroke="#b07a4a" strokeWidth={1.4} opacity={0.6} strokeDasharray="3 3" />
      <path d="M140 290l-4 -22M148 290l4 -22" stroke="#1c2040" strokeWidth={4} strokeLinecap="round" />
      {/* отсвет углей снизу */}
      <g clipPath={`url(#${u}clip)`}>
        <rect x={0} y={180} width={300} height={190} fill={`url(#${u}w)`} />
      </g>
      {/* предплечье и кулак на рукояти */}
      <path d="M244 250Q278 292 266 336Q238 342 206 318Q228 298 244 250Z" fill={`url(#${u}b)`} />
      <path d="M266 336Q238 342 206 318" fill="none" stroke="#ff9a4a" strokeWidth={1.8} opacity={0.65} />
      <path d="M196 300Q196 284 212 282Q232 282 234 298Q234 316 214 318Q198 316 196 300Z" fill="#221b3a" />
      <path d="M202 290Q214 286 228 292M200 300Q214 296 230 302M202 309Q214 306 228 311" fill="none" stroke="#0e0a1f" strokeWidth={1.6} />
      <path d="M198 306Q212 322 232 306" fill="none" stroke="#ff9a4a" strokeWidth={1.6} opacity={0.75} />
      {thinking && (
        <g>
          <path d="M40 330Q70 250 118 214Q132 218 128 234Q96 266 80 340Z" fill={`url(#${u}b)`} />
          <path d="M80 340Q96 266 128 234" fill="none" stroke="#ff9a4a" strokeWidth={1.5} opacity={0.55} />
          <circle cx={122} cy={220} r={15} fill="#1d1733" />
        </g>
      )}
      <g transform={head}>
        <Silhouette parts={[...ears, { d: BEAR_HEAD }]} fill={`url(#${u}b)`} rims={[COOL, { ...warm, o: 0.5 }]} />
        <path d="M84 84Q94 72 106 80" fill="none" stroke="#3a2d58" strokeWidth={6} strokeLinecap="round" transform={`rotate(${-earRot} 100 90)`} />
        <path d="M216 84Q206 72 194 80" fill="none" stroke="#3a2d58" strokeWidth={6} strokeLinecap="round" transform={`rotate(${earRot} 200 90)`} />
        {/* морда */}
        <path d="M150 146Q186 146 190 176Q186 204 150 206Q114 204 110 176Q114 146 150 146Z" fill="#2e2442" />
        <path d="M110 176Q114 204 150 206Q186 204 190 176" fill="none" stroke="#ff9a4a" strokeWidth={1.6} opacity={0.5} />
        {eyes.map((e, i) => (
          <GlowEye key={i} id={`${u}c${i}`} gid={`${u}e`} e={e} />
        ))}
        <g fill="#3b3060">
          <path d={brow(142, 120, 110, 116, 4.5, -1, m)} />
          <path d={brow(158, 120, 190, 116, 4.5, 1, m)} />
        </g>
        <path d="M134 158Q150 150 166 158Q162 170 150 174Q138 170 134 158Z" fill="#0b0816" />
        <path d="M140 156Q150 152 158 156" stroke="#9a8ad0" strokeWidth={1.6} fill="none" opacity={0.6} />
        <path d="M150 174V182" stroke="#0b0816" strokeWidth={2.4} />
        <path d={mouth} fill={mood === 'happy' ? '#140c1c' : 'none'} stroke="#0b0816" strokeWidth={2.4} strokeLinecap="round" />
      </g>
    </g>
  )
}

// ============ Бип, механик Башни ============

type PixelArt = string[]
const PIX: Record<Mood, PixelArt> = {
  neutral: ['.............', '..##.....##..', '..##.....##..', '..##.....##..', '.............', '....#####....', '.............'],
  happy: ['.............', '..###...###..', '.#...#.#...#.', '.............', '...#.....#...', '....#####....', '.............'],
  thinking: ['.........#.#.', '.............', '..###....##..', '.........##..', '.............', '......###....', '.............'],
  worried: ['..#.......#..', '...#.....#...', '..##.....##..', '..##.....##..', '.............', '....#.#.#....', '.....#.#.#...'],
  proud: ['.............', '.####...####.', '.#..#####..#.', '.####...####.', '.............', '...#.....#...', '....#####....'],
}

function Robot({ u, mood }: CharProps) {
  const art = PIX[mood]
  let pix = ''
  const px = 8
  const x0 = 98
  const y0 = 150
  art.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      if (ch === '#') pix += `M${x0 + rx * px + 0.8} ${y0 + ry * px + 0.8}h${px - 1.6}v${px - 1.6}h${-(px - 1.6)}Z`
    }),
  )
  const cyan: RimLight = { color: '#6fe3f0', dx: 2, dy: 1, o: 0.45 }
  const arms: Record<Mood, [string, string]> = {
    neutral: ['M106 258L80 292L76 322', 'M194 258L220 292L224 322'],
    happy: ['M106 258L80 292L76 322', 'M194 256L232 236L240 196'],
    thinking: ['M106 258L80 292L76 322', 'M194 258L214 262L184 232'],
    worried: ['M106 252L72 226L78 180', 'M194 252L228 226L222 180'],
    proud: ['M106 262L78 284L102 304', 'M194 262L222 284L198 304'],
  }
  const claw = (d: string) => {
    const pts = d.split(/[ML]/).filter(Boolean).map((s) => s.trim().split(/\s+/).map(Number))
    const [x, y] = pts[pts.length - 1]
    return (
      <g>
        <circle cx={x} cy={y} r={8.5} fill="#28336c" />
        <path d={`M${x - 6} ${y + 4}l-3 8M${x + 6} ${y + 4}l3 8`} stroke="#28336c" strokeWidth={4} strokeLinecap="round" />
      </g>
    )
  }
  return (
    <g>
      <defs>
        <linearGradient id={`${u}b`} x1="70" y1="120" x2="230" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2c3668" />
          <stop offset="0.55" stopColor="#1a2150" />
          <stop offset="1" stopColor="#0d122e" />
        </linearGradient>
        <radialGradient id={`${u}s`} cx="0.5" cy="0.5" r="0.7">
          <stop offset="0" stopColor="#0f4f58" />
          <stop offset="1" stopColor="#051d24" />
        </radialGradient>
        <radialGradient id={`${u}g`}>
          <stop offset="0" stopColor="#6fe3f0" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#6fe3f0" stopOpacity="0.12" />
          <stop offset="1" stopColor="#6fe3f0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${u}a`}>
          <stop offset="0" stopColor="#fff2c4" />
          <stop offset="0.3" stopColor="#ffb547" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={150} cy={180} r={150} fill={`url(#${u}g)`} className="art-pt-glow" />
      {/* гусеницы */}
      <Silhouette parts={[{ d: 'M92 326Q92 314 108 314H192Q208 314 208 326V346Q208 358 192 358H108Q92 358 92 346Z' }]} fill="#141a3c" rims={[COOL]} />
      {[112, 136, 164, 188].map((x) => (
        <circle key={x} cx={x} cy={336} r={9} fill="#0b1030" stroke="#2c3668" strokeWidth={2} />
      ))}
      {/* руки */}
      <g fill="none" stroke="#28336c" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round">
        <path d={arms[mood][0]} />
        <path d={arms[mood][1]} />
      </g>
      <g fill="none" stroke="#141a3c" strokeWidth={3} strokeLinecap="round" strokeDasharray="2 6">
        <path d={arms[mood][0]} />
        <path d={arms[mood][1]} />
      </g>
      <g fill="none" stroke="#6fe3f0" strokeWidth={1.4} opacity={0.35} strokeLinecap="round">
        <path d={arms[mood][0]} transform="translate(-2 -2)" />
        <path d={arms[mood][1]} transform="translate(2 -2)" />
      </g>
      {claw(arms[mood][0])}
      {claw(arms[mood][1])}
      {/* корпус */}
      <Silhouette
        parts={[{ d: 'M112 242Q150 234 188 242L200 314Q150 322 100 314Z' }, { d: 'M136 222H164V246H136Z' }]}
        fill={`url(#${u}b)`}
        rims={[COOL, cyan]}
      />
      <rect x={128} y={262} width={44} height={30} rx={5} fill="#0b1030" />
      <circle cx={140} cy={277} r={4} fill="#6fe3c8" className="art-twinkle" style={{ animationDuration: '1.6s' }} />
      <circle cx={152} cy={277} r={4} fill="#ffb547" />
      <circle cx={164} cy={277} r={4} fill="#ff6b5a" className="art-twinkle" style={{ animationDuration: '2.3s' }} />
      <path d="M126 302h48M126 308h48" stroke="#0b1030" strokeWidth={2.4} />
      {/* голова-экран */}
      <g transform={`rotate(${mood === 'thinking' ? -5 : mood === 'happy' ? 4 : 0} 150 230)`}>
        <path d="M150 124V92" stroke="#1b2248" strokeWidth={4} />
        <path d="M150 116l-6 -4l12 -4l-12 -4l12 -4l-6 -4" fill="none" stroke="#2c3668" strokeWidth={2} />
        <circle cx={150} cy={84} r={22} fill={`url(#${u}a)`} className="art-blinklight" />
        <circle cx={150} cy={84} r={6.5} fill="#ffcf73" />
        <Silhouette
          parts={[
            { d: 'M98 122H202Q228 122 228 148V204Q228 230 202 230H98Q72 230 72 204V148Q72 122 98 122Z' },
            { d: 'M60 158H74V196H60Z' },
            { d: 'M226 158H240V196H226Z' },
          ]}
          fill={`url(#${u}b)`}
          rims={[COOL, cyan]}
        />
        <rect x={88} y={138} width={124} height={78} rx={16} fill={`url(#${u}s)`} />
        <path d="M92 150H208M92 162H208M92 174H208M92 186H208M92 198H208" stroke="#6fe3f0" strokeWidth={1} opacity={0.08} />
        <g className="art-screen-blink">
          <path d={pix} fill="#8ff3ff" />
        </g>
        <path d={pix} fill="#8ff3ff" opacity={0.25} transform="translate(0 0.5)" />
        <path d="M96 146Q120 140 150 142" stroke="#ffffff" strokeWidth={2.4} opacity={0.15} strokeLinecap="round" fill="none" />
        {[
          [84, 132],
          [216, 132],
          [84, 220],
          [216, 220],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={2.6} fill="#3a4680" />
        ))}
      </g>
    </g>
  )
}

// ============ Лиса-режиссёр Рыжая ============

const FOX_HEAD = S([
  [150, 100],
  [182, 104],
  [206, 122],
  [218, 150],
  [226, 178, 0],
  [206, 186],
  [186, 202],
  [166, 216],
  [150, 226, 0.3],
  [134, 216],
  [114, 202],
  [94, 186],
  [74, 178, 0],
  [82, 150],
  [94, 122],
  [118, 104],
])

function Fox({ u, m, mood }: CharProps) {
  const head = `translate(0 ${m.dy}) rotate(${m.tilt} 150 222)`
  const warm: RimLight = { color: '#ff9a5a', dx: 2.2, dy: -1, o: 0.8 }
  const earRot = mood === 'worried' ? 22 : mood === 'happy' ? -4 : 0
  const earL: Pt[] = [
    [98, 128],
    [80, 38, 0],
    [134, 104],
  ]
  const ears: Part[] = [
    { d: S(earL), t: `rotate(${-earRot} 110 116)` },
    { d: S(mirrorX(earL)), t: `rotate(${earRot + (mood === 'thinking' ? 10 : 0)} 190 116)` },
  ]
  const eyes = ([-1, 1] as const).map((side) => ({
    side,
    x: 150 + side * 29,
    y: 160,
    r: 12,
    ry: 8,
    rot: -12,
    lid: '#2a1622',
    upper: m.upper,
    lower: m.lower,
    tilt: m.lidTilt,
    look: m.look,
    pupil: 0.36,
    slit: true,
    glow: 3,
  }))
  // хлопушка: положение по настроению
  const board =
    mood === 'proud'
      ? 'translate(-6 -52) rotate(-16 90 290)'
      : mood === 'thinking'
        ? 'translate(-10 26) rotate(10 90 290)'
        : mood === 'worried'
          ? 'translate(24 -6) rotate(-4 90 290)'
          : 'rotate(-6 90 290)'
  const clapOpen = mood === 'happy' ? -26 : mood === 'proud' ? -14 : -6
  return (
    <g>
      <defs>
        <linearGradient id={`${u}b`} x1="60" y1="60" x2="250" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4a2330" />
          <stop offset="0.55" stopColor="#2a1320" />
          <stop offset="1" stopColor="#140a16" />
        </linearGradient>
        <linearGradient id={`${u}m`} x1="0" y1="170" x2="0" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5a3a44" />
          <stop offset="1" stopColor="#3a2430" />
        </linearGradient>
        <EyeDefs id={`${u}e`} color="#ffcf5a" hot="#fff6d0" deep="#e0902a" />
      </defs>
      {/* хвост */}
      <Silhouette
        parts={[{ d: S([[214, 362, 0], [252, 334], [280, 286], [282, 236], [262, 206, 0], [258, 250], [244, 300], [206, 340]]) }]}
        fill={`url(#${u}b)`}
        rims={[{ ...warm, o: 0.9 }]}
      />
      <path d="M262 206Q286 222 282 250Q270 238 258 236Z" fill="#e9d6c4" opacity={0.85} />
      {/* тело */}
      <Silhouette
        parts={[{ d: S([[150, 212], [196, 226, 0.6], [214, 262], [228, 320], [236, 362, 0], [64, 362, 0], [72, 320], [86, 262], [104, 226, 0.6]]) }]}
        fill={`url(#${u}b)`}
        rims={[COOL, warm]}
      />
      <path d="M150 232Q182 250 184 300Q176 340 150 362Q124 340 116 300Q118 250 150 232Z" fill="#4a2e3a" opacity={0.9} />
      {/* шарф */}
      <path d="M100 222Q150 250 200 222L206 242Q150 272 94 242Z" fill="#c98f36" />
      <path d="M190 238Q226 244 254 264L246 280Q220 264 186 256Z" fill="#c98f36" />
      <path d="M110 238Q150 256 190 238M200 250L238 266" fill="none" stroke="#7a4a1a" strokeWidth={3} opacity={0.6} />
      <path d="M100 222Q150 250 200 222" fill="none" stroke="#ffe0a0" strokeWidth={1.5} opacity={0.6} />
      <g transform={head}>
        <Silhouette parts={[...ears, { d: FOX_HEAD }]} fill={`url(#${u}b)`} rims={[COOL, warm]} />
        <path d="M104 118L92 62L124 102Z" fill="#6a2a32" opacity={0.8} transform={`rotate(${-earRot} 110 116)`} />
        <path
          d="M196 118L208 62L176 102Z"
          fill="#6a2a32"
          opacity={0.8}
          transform={`rotate(${earRot + (mood === 'thinking' ? 10 : 0)} 190 116)`}
        />
        {/* светлая маска морды */}
        <path d="M84 176Q112 170 130 180Q142 190 150 192Q158 190 170 180Q188 170 216 176Q196 204 170 214Q158 222 150 226Q142 222 130 214Q104 204 84 176Z" fill={`url(#${u}m)`} />
        {eyes.map((e, i) => (
          <GlowEye key={i} id={`${u}c${i}`} gid={`${u}e`} e={e} />
        ))}
        <g fill="#5c2a36">
          <path d={brow(140, 144, 110, 140, 3.4, -1, m)} />
          <path d={brow(160, 144, 190, 140, 3.4, 1, m)} />
        </g>
        <path d="M143 206Q150 202 157 206Q155 213 150 215Q145 213 143 206Z" fill="#0c060e" />
        <path
          d={mood === 'happy' ? 'M138 218Q150 228 162 218' : mood === 'worried' ? 'M142 222Q150 218 158 222' : 'M142 220Q150 224 158 220'}
          fill="none"
          stroke="#0c060e"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* берет */}
        <g transform="rotate(-10 150 100)">
          <path d="M92 108Q96 80 140 74Q190 72 210 94Q206 108 150 112Q112 114 92 108Z" fill="#7a2638" />
          <path d="M92 108Q96 80 140 74Q190 72 210 94" fill="none" stroke="#ff9aa8" strokeWidth={1.6} opacity={0.45} />
          <path d="M96 108Q150 118 206 100" fill="none" stroke="#4a1422" strokeWidth={4} />
          <path d="M146 74Q148 64 154 62" stroke="#7a2638" strokeWidth={4} strokeLinecap="round" />
        </g>
      </g>
      {/* хлопушка */}
      <g transform={board}>
        <rect x={48} y={262} width={86} height={58} rx={3} fill="#15101e" />
        <path d="M56 280H124M56 294H110M56 306H118" stroke="#e8dcc0" strokeWidth={1.6} opacity={0.55} />
        <text x={116} y={312} fontSize={16} fill="#e8dcc0" opacity={0.8} fontFamily="var(--font-display)" textAnchor="middle">
          1
        </text>
        <g transform={`rotate(${clapOpen} 48 262)`}>
          <rect x={48} y={248} width={86} height={14} rx={2} fill="#e8dcc0" />
          <path d="M58 248L50 262H62L70 248ZM82 248L74 262H86L94 248ZM106 248L98 262H110L118 248Z" fill="#15101e" />
        </g>
        <rect x={48} y={262} width={86} height={5} fill="#e8dcc0" />
        <path d="M58 262L52 267H60L66 262ZM82 262L76 267H84L90 262ZM106 262L100 267H108L114 262Z" fill="#15101e" />
        <circle cx={132} cy={296} r={11} fill="#2a1320" />
        <path d="M122 300Q132 310 142 300" fill="none" stroke="#ff9a5a" strokeWidth={1.4} opacity={0.6} />
      </g>
      {mood === 'thinking' && (
        <g>
          <path d="M214 330Q220 270 176 232Q164 236 168 250Q196 280 196 334Z" fill={`url(#${u}b)`} />
          <circle cx={170} cy={230} r={11} fill="#2a1320" />
          <path d="M196 334Q196 280 168 250" fill="none" stroke="#ff9a5a" strokeWidth={1.4} opacity={0.6} />
        </g>
      )}
    </g>
  )
}

// ============ Ворон-глашатай Карл ============

function Raven({ u, m, mood }: CharProps) {
  const up = mood === 'proud' ? -12 : mood === 'happy' ? -7 : mood === 'thinking' ? 9 : mood === 'worried' ? 4 : 3
  const head = `translate(0 ${m.dy * 0.6}) rotate(${up} 152 176)`
  const violet: RimLight = { color: '#a57bff', dx: -2.4, dy: -1.8, o: 0.8 }
  const warm: RimLight = { color: '#ffcf80', dx: 2, dy: 1, o: 0.3 }
  const rf = mood === 'worried' ? 12 : 0
  const hackles = S([
    [118, 164],
    [124, 200 + rf, 0],
    [138, 186],
    [146, 212 + rf, 0],
    [156, 190],
    [168, 208 + rf, 0],
    [178, 186],
    [190, 200 + rf * 0.7, 0],
    [194, 164],
  ])
  const beakOpen = mood === 'happy' || mood === 'proud'
  const eye = {
    side: 1 as const,
    x: 164,
    y: 116,
    r: 9.5,
    lid: '#1e1840',
    upper: m.upper,
    lower: m.lower,
    tilt: -m.lidTilt,
    look: [m.look[0] - 0.22, m.look[1]] as [number, number],
    pupil: 0.44,
    glow: 3.4,
  }
  const puff = mood === 'proud' ? 1.08 : 1
  const body = S([
    [150, 168],
    [186 * puff - 150 * (puff - 1), 176],
    [212, 208],
    [222, 262],
    [214, 318],
    [198, 362, 0],
    [102, 362, 0],
    [88, 318],
    [82, 262],
    [92, 208],
    [118, 176],
  ])
  const wing = S([
    [196, 188],
    [224, 230],
    [232, 290],
    [222, 340],
    [206, 358, 0],
    [194, 318],
    [190, 262],
    [182, 212],
  ])
  const scroll =
    mood === 'proud'
      ? 'translate(-4 -44) rotate(-6 90 280)'
      : mood === 'thinking'
        ? 'translate(0 24) rotate(8 90 280)'
        : mood === 'worried'
          ? 'translate(8 12)'
          : undefined
  return (
    <g>
      <defs>
        <linearGradient id={`${u}b`} x1="80" y1="60" x2="230" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#30275e" />
          <stop offset="0.5" stopColor="#191438" />
          <stop offset="1" stopColor="#0b0920" />
        </linearGradient>
        <linearGradient id={`${u}p`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9c8a62" />
          <stop offset="0.3" stopColor="#e2d2aa" />
          <stop offset="1" stopColor="#bba77c" />
        </linearGradient>
        <EyeDefs id={`${u}e`} color="#ffd68a" hot="#fffaf0" deep="#d9a24a" />
      </defs>
      {/* хвост */}
      <path d="M168 326L236 362H146Z" fill="#100c28" />
      <path d="M168 326L236 362" stroke="#a57bff" strokeWidth={1.4} opacity={0.5} />
      <Silhouette parts={[{ d: body }]} fill={`url(#${u}b)`} rims={[violet, warm]} />
      <Silhouette parts={[{ d: wing }]} fill={`url(#${u}b)`} rims={[{ ...violet, dx: -2, dy: 0, o: 0.6 }]} />
      {/* отлив перьев на крыле */}
      <path d="M204 226Q222 270 212 324M196 244Q208 280 200 338M120 214Q100 254 106 300" fill="none" stroke="#7d5cf0" strokeWidth={2} opacity={0.45} strokeLinecap="round" />
      <path d="M200 340l8 16M210 330l10 18M218 318l8 14" stroke="#0b0920" strokeWidth={2.4} strokeLinecap="round" />
      {/* лапы */}
      <path d="M134 346V362M166 346V362M124 362h20M156 362h20" stroke="#3e3456" strokeWidth={4} strokeLinecap="round" />
      {/* цепь и медальон */}
      <path d="M120 194Q152 244 188 194" fill="none" stroke="#d9a24a" strokeWidth={2.4} strokeDasharray="3 2" />
      <circle cx={154} cy={232} r={12.5} fill="#d9a24a" />
      <circle cx={154} cy={232} r={8.5} fill="none" stroke="#8a5a1a" strokeWidth={1.6} />
      <path d="M154 225l2 5h5l-4 3l2 5l-5 -3l-5 3l2 -5l-4 -3h5Z" fill="#8a5a1a" />
      <g transform={head}>
        <Silhouette
          parts={[
            {
              d: S([
                [152, 66],
                [186, 72],
                [206, 98],
                [210, 130],
                [198, 160],
                [172, 178],
                [140, 178],
                [114, 162],
                [102, 134],
                [108, 100],
                [126, 76],
              ]),
            },
            { d: hackles },
          ]}
          fill={`url(#${u}b)`}
          rims={[violet, warm]}
        />
        {/* клюв */}
        {beakOpen ? (
          <>
            <path d="M132 106Q96 110 58 128Q96 132 134 134Z" fill="#161234" />
            <path d="M134 138Q100 142 70 156Q102 156 136 152Z" fill="#161234" />
            <path d="M132 106Q96 110 58 128" fill="none" stroke="#a592ff" strokeWidth={1.8} opacity={0.7} />
          </>
        ) : (
          <>
            <path d="M132 106Q96 114 58 144Q98 150 136 150Z" fill="#161234" />
            <path d="M132 106Q96 114 58 144" fill="none" stroke="#a592ff" strokeWidth={1.8} opacity={0.7} />
            <path d="M68 142Q100 138 134 136" fill="none" stroke="#07051a" strokeWidth={1.6} opacity={0.8} />
          </>
        )}
        <GlowEye id={`${u}c0`} gid={`${u}e`} e={eye} />
        <path d={brow(152, 100, 180, 98, 3.8, 1, m)} fill="#3c3082" />
        <path d="M170 84Q186 80 196 92" fill="none" stroke="#8d6cf6" strokeWidth={1.6} opacity={0.55} />
      </g>
      {/* свиток в крыле */}
      <g transform={scroll}>
        <path d="M54 232H118V330H54Z" fill={`url(#${u}p)`} />
        <path d="M62 250H110M62 262H104M62 274H110M62 286H98M62 298H108M62 310H92" stroke="#6a5438" strokeWidth={2} opacity={0.55} />
        <rect x={48} y={222} width={76} height={12} rx={6} fill="#b09c72" />
        <rect x={48} y={326} width={76} height={12} rx={6} fill="#b09c72" />
        <path d="M54 234H118" stroke="#fff4d6" strokeWidth={1.4} opacity={0.5} />
        <path d="M100 216Q140 238 132 304Q122 318 110 304Q116 256 92 234Z" fill={`url(#${u}b)`} />
        <path d="M100 216Q140 238 132 304" fill="none" stroke="#a57bff" strokeWidth={1.6} opacity={0.65} />
      </g>
    </g>
  )
}

// ============ Лев, хранитель Арены ============

function lionMane(scale: number, seed: number): { outer: string; inner: string; strands: string } {
  const outer: Pt[] = []
  const inner: Pt[] = []
  const n = 16
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    const low = Math.sin(a)
    const beard = low > 0.3 ? 1 + (low - 0.3) * 0.34 : 1
    const peak = i % 2 === 0
    const jit = Math.sin(i * 12.9898 + seed) * 4
    const R = ((peak ? 122 : 106) + jit) * scale * beard
    outer.push([150 + Math.cos(a) * R, 156 + Math.sin(a) * R * 0.94, peak ? 1 : 0.35])
    const Ri = ((peak ? 98 : 86) + jit * 0.6) * scale * (low > 0.3 ? 1 + (low - 0.3) * 0.2 : 1)
    inner.push([150 + Math.cos(a + 0.1) * Ri, 158 + Math.sin(a + 0.1) * Ri * 0.94, peak ? 1 : 0.35])
  }
  let strands = ''
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2 + 0.13
    const r0 = 74 * scale
    const r1 = 112 * scale
    const bend = 0.22
    const x0 = 150 + Math.cos(a) * r0
    const y0 = 156 + Math.sin(a) * r0
    const x1 = 150 + Math.cos(a + bend) * r1
    const y1 = 156 + Math.sin(a + bend) * r1
    const mx = 150 + Math.cos(a + bend * 0.2) * (r0 + r1) * 0.52
    const my = 156 + Math.sin(a + bend * 0.2) * (r0 + r1) * 0.52
    strands += `M${f(x0)} ${f(y0)}Q${f(mx)} ${f(my)} ${f(x1)} ${f(y1)}`
  }
  return { outer: S(outer), inner: S(inner), strands }
}

function Lion({ u, m, mood }: CharProps) {
  const head = `translate(0 ${m.dy}) rotate(${m.tilt} 150 236)`
  const gold: RimLight = { color: '#ffb547', dx: 2.6, dy: -2, o: 0.9 }
  const cool: RimLight = { ...COOL, o: 0.3 }
  const mane = lionMane(mood === 'proud' ? 1.05 : 1, 3)
  const eyes = ([-1, 1] as const).map((side) => ({
    side,
    x: 150 + side * 27,
    y: 146,
    r: 9.5,
    ry: 7,
    rot: -8,
    lid: '#33263e',
    upper: mood === 'proud' ? 0.62 : mood === 'worried' ? 0.06 : mood === 'happy' ? 0 : Math.max(m.upper, 0.3),
    lower: m.lower,
    tilt: m.lidTilt,
    look: m.look,
    pupil: 0.38,
    glow: 3,
  }))
  const earRot = mood === 'worried' ? 16 : 0
  const mouth =
    mood === 'happy'
      ? 'M132 198Q150 214 168 198'
      : mood === 'worried'
        ? 'M136 204Q150 198 164 204'
        : 'M134 198Q142 205 150 199Q158 205 166 198'
  return (
    <g>
      <defs>
        <linearGradient id={`${u}b`} x1="60" y1="30" x2="260" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4a2e3e" />
          <stop offset="0.55" stopColor="#2a1a2e" />
          <stop offset="1" stopColor="#140a18" />
        </linearGradient>
        <radialGradient id={`${u}m`} cx="150" cy="150" r="130" gradientUnits="userSpaceOnUse">
          <stop offset="0.5" stopColor="#3e2636" />
          <stop offset="1" stopColor="#24142a" />
        </radialGradient>
        <linearGradient id={`${u}c`} x1="0" y1="240" x2="0" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6a1e30" />
          <stop offset="1" stopColor="#3a0e1c" />
        </linearGradient>
        <EyeDefs id={`${u}e`} color="#ffc94d" hot="#fff6d0" deep="#d98a1a" />
      </defs>
      {/* плечи и мантия */}
      <Silhouette parts={[{ d: S([[150, 236], [214, 244], [258, 272], [282, 320], [290, 362, 0], [10, 362, 0], [18, 320], [42, 272], [86, 244]]) }]} fill={`url(#${u}b)`} rims={[cool, gold]} />
      <path d="M42 292Q90 266 150 268Q210 266 258 292L282 362H18Z" fill={`url(#${u}c)`} />
      <path d="M42 292Q90 266 150 268Q210 266 258 292" fill="none" stroke="#ffcf80" strokeWidth={1.8} opacity={0.5} />
      <path d="M150 268V362" stroke="#2a0a14" strokeWidth={2} opacity={0.5} />
      <circle cx={150} cy={278} r={12} fill="#d9a24a" />
      <circle cx={150} cy={278} r={6} fill="#ffe6a8" />
      <g transform={head}>
        {/* грива: мягкие пряди, золотой контровой свет */}
        <Silhouette parts={[{ d: mane.outer }]} fill={`url(#${u}m)`} rims={[cool, gold]} />
        <path d={mane.inner} fill="#4a2c3e" opacity={0.85} />
        <path d={mane.strands} fill="none" stroke="#1e1022" strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
        <path d={mane.strands} fill="none" stroke="#ffb547" strokeWidth={1} strokeLinecap="round" opacity={0.18} transform="translate(1.5 -1)" />
        {/* уши */}
        {([-1, 1] as const).map((side) => (
          <g key={side} transform={`rotate(${side * earRot} ${150 + side * 44} 96)`}>
            <path d={`M${150 + side * 30} 102Q${150 + side * 36} 74 ${150 + side * 56} 78Q${150 + side * 66} 92 ${150 + side * 58} 110Z`} fill="#3a2a44" />
            <path d={`M${150 + side * 38} 100Q${150 + side * 42} 84 ${150 + side * 54} 86Q${150 + side * 58} 96 ${150 + side * 54} 104Z`} fill="#1a1020" />
          </g>
        ))}
        {/* лицо */}
        <path d={S(sym([[150, 88], [184, 94], [208, 120], [212, 152], [202, 184], [180, 208], [150, 220]]))} fill="#3a2a44" />
        <path d="M150 88Q184 92 206 116" fill="none" stroke="#ffb547" strokeWidth={1.4} opacity={0.4} />
        <path d="M150 116Q164 132 162 164H138Q136 132 150 116Z" fill="#46344f" opacity={0.8} />
        <path d="M150 172Q176 168 186 188Q184 210 158 212Q150 208 150 206Q150 208 142 212Q116 210 114 188Q124 168 150 172Z" fill="#4c3a56" />
        {eyes.map((e, i) => (
          <GlowEye key={i} id={`${u}k${i}`} gid={`${u}e`} e={e} />
        ))}
        <g fill="#1a1020">
          <path d={brow(142, 132, 112, 126, 4.4, -1, m)} />
          <path d={brow(158, 132, 188, 126, 4.4, 1, m)} />
        </g>
        <path d="M136 166Q150 160 164 166Q160 178 150 184Q140 178 136 166Z" fill="#140a16" />
        <path d="M141 165Q150 162 159 165" stroke="#c9a0b8" strokeWidth={1.4} fill="none" opacity={0.5} />
        <path d="M150 184V196" stroke="#140a16" strokeWidth={2.2} />
        <path d={mouth} fill="none" stroke="#140a16" strokeWidth={2.2} strokeLinecap="round" />
        <g fill="#140a16" opacity={0.7}>
          <circle cx={128} cy={190} r={1.4} />
          <circle cx={122} cy={196} r={1.4} />
          <circle cx={130} cy={198} r={1.4} />
          <circle cx={172} cy={190} r={1.4} />
          <circle cx={178} cy={196} r={1.4} />
          <circle cx={170} cy={198} r={1.4} />
        </g>
      </g>
      {mood === 'thinking' && (
        <g>
          <path d="M232 362Q240 300 204 248Q186 246 184 262Q210 300 200 362Z" fill={`url(#${u}b)`} />
          <path d="M200 362Q210 300 184 262" fill="none" stroke="#ffb547" strokeWidth={1.4} opacity={0.5} />
          <ellipse cx={192} cy={246} rx={22} ry={16} fill="#3a2a44" />
          <path d="M176 240q4 -6 10 -2M188 238q4 -6 10 -2M200 242q4 -6 8 0" fill="none" stroke="#140a16" strokeWidth={2} />
        </g>
      )}
    </g>
  )
}

const CHARS: Record<NpcId, (p: CharProps) => JSX.Element> = {
  owl: Owl,
  bear: Bear,
  robot: Robot,
  fox: Fox,
  raven: Raven,
  lion: Lion,
}

export function Portrait({
  who,
  mood = 'neutral',
  size = 320,
  className,
  talking,
}: {
  who: NpcId
  mood?: Mood
  /** высота, px */
  size?: number
  className?: string
  talking?: boolean
}): JSX.Element {
  const u = useUid()
  const Char = CHARS[who]
  return (
    <svg
      className={cx('art-portrait', `art-portrait--${who}`, talking && 'art-portrait--talking', className)}
      viewBox="0 0 300 360"
      width={f((size * 300) / 360)}
      height={f(size)}
      aria-hidden="true"
    >
      <g className="art-pt-rig">
        <Char u={u} m={FACE[mood]} mood={mood} />
      </g>
    </svg>
  )
}
