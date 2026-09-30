// Студия Эха: пещера с кристаллами, концентрические круги эха, тёплый кольцевой свет-софит.
import { useMemo } from 'react'
import { f, mix, poly, smooth, useUid, type Pt } from '../geom'
import { Fireflies, Glow, Plane, VGrad } from '../landscape'
import { mulberry32, rangeRand } from '../rng'

interface Crystal {
  light: string
  dark: string
  edge: string
  c: string
}

function crystals(seed: number, x: number, yb: number, n: number, hMax: number, colors: string[], dir = 1): Crystal[] {
  const r = mulberry32(seed)
  const out: (Crystal & { h: number })[] = []
  for (let i = 0; i < n; i++) {
    const t = rangeRand(r, -0.5, 0.5) * (i === 0 ? 0.2 : 1)
    const h = hMax * (i === 0 ? 1 : (1 - Math.abs(t) * 1.2) * rangeRand(r, 0.35, 0.9))
    const w = h * rangeRand(r, 0.19, 0.3)
    const tilt = (t * 1.25 + rangeRand(r, -0.1, 0.1)) * dir
    const bx = x + t * hMax * 0.75
    const by = yb + rangeRand(r, -4, 6)
    const cs = Math.cos(tilt)
    const sn = Math.sin(tilt)
    const T = (px: number, py: number): Pt => [bx + px * cs - py * sn, by + px * sn + py * cs]
    const c = colors[i % colors.length]
    out.push({
      light: poly([T(-w / 2, 4), T(-w / 2, -h * 0.76), T(0, -h), T(0, 4)]),
      dark: poly([T(0, 4), T(0, -h), T(w / 2, -h * 0.76), T(w / 2, 4)]),
      edge: poly([T(0, 0), T(0, -h), T(-w / 2, -h * 0.76)], false),
      c,
      h,
    })
  }
  return out.sort((a, b) => b.h - a.h)
}

export function StudioScene() {
  const u = useUid()
  const g = useMemo(() => {
    const pink = ['#ff8fb1', '#c07aff', '#ff9fc4']
    const mint = ['#6fe3c8', '#9a86ff', '#8ff0da']
    const left = crystals(701, 468, 756, 8, 176, pink, 1)
    const right = crystals(702, 1146, 760, 7, 150, mint, -1)
    const backL = crystals(703, 612, 648, 4, 72, mint, 1)
    const backR = crystals(704, 994, 636, 4, 66, pink, -1)
    const rr = mulberry32(708)
    const jag = (pts: Pt[]): Pt[] => pts.map((p, i) => (p.length === 3 ? p : [p[0] + rangeRand(rr, -8, 8), p[1] + rangeRand(rr, -8, 8), i % 2 ? 0.25 : 0.8]))
    const wallL = smooth(
      jag([
        [-40, -40, 0],
        [330, -40, 0],
        [300, 40],
        [236, 84],
        [256, 150],
        [196, 214],
        [212, 300],
        [160, 380],
        [178, 480],
        [128, 572],
        [150, 690],
        [104, 800],
        [120, 940, 0],
        [-40, 940, 0],
      ]),
      true,
    )
    const wallR = smooth(
      jag([
        [1270, -40, 0],
        [1640, -40, 0],
        [1640, 940, 0],
        [1488, 940, 0],
        [1500, 820],
        [1456, 700],
        [1478, 590],
        [1424, 500],
        [1440, 400],
        [1386, 320],
        [1400, 230],
        [1340, 160],
        [1352, 90],
        [1296, 40],
      ]),
      true,
    )
    const ceilPts: Pt[] = [[-40, -40, 0], [1640, -40, 0], [1640, 30, 0]]
    for (let x = 1600; x >= 0; x -= 40) {
      const stal = rr() < 0.3
      const base = 40 + Math.sin(x * 0.006) * 16 + rangeRand(rr, -6, 8)
      if (stal) {
        const len = rangeRand(rr, 50, 120) * (1 - Math.abs(x - 800) / 1400)
        ceilPts.push([x + 14, base, 0.4], [x, base + len, 0], [x - 12, base + 6, 0.4])
      } else ceilPts.push([x, base])
    }
    ceilPts.push([-40, 30, 0])
    const ceil = smooth(ceilPts, true)
    const backRocks = [
      smooth([[250, 700, 0], [270, 610], [330, 560], [400, 574], [440, 640], [460, 700, 0]], true),
      smooth([[1150, 690, 0], [1180, 600], [1250, 556], [1320, 580], [1360, 640], [1370, 690, 0]], true),
    ].join('')
    const floor = `M-40 716Q800 604 1640 716V940H-40Z`
    const strata = [0, 1, 2, 3, 4]
      .map((i) => {
        const y = 240 + i * 90
        return `M180 ${y + 30}Q800 ${y - 40 - i * 6} 1440 ${y + 30}`
      })
      .join('')
    return { left, right, backL, backR, wallL, wallR, ceil, backRocks, floor, strata }
  }, [])

  return (
    <>
      <Plane>
        <defs>
          <radialGradient id={`${u}bg`} cx="0.5" cy="0.45" r="0.7">
            <stop offset="0" stopColor="#2e1b56" />
            <stop offset="0.4" stopColor="#1b0f38" />
            <stop offset="0.8" stopColor="#0d0722" />
            <stop offset="1" stopColor="#070412" />
          </radialGradient>
          <VGrad
            id={`${u}floor`}
            y1={630}
            y2={900}
            stops={[
              [0, '#20133a'],
              [1, '#0b0617'],
            ]}
          />
          <radialGradient id={`${u}ring`}>
            <stop offset="0" stopColor="#ffd68a" stopOpacity="0.07" />
            <stop offset="0.36" stopColor="#ffd68a" stopOpacity="0.03" />
            <stop offset="0.47" stopColor="#ffc56a" stopOpacity="0.3" />
            <stop offset="0.52" stopColor="#ffe2a8" stopOpacity="0.95" />
            <stop offset="0.58" stopColor="#ffc56a" stopOpacity="0.28" />
            <stop offset="0.78" stopColor="#ffb547" stopOpacity="0.06" />
            <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x={-40} y={-40} width={1680} height={980} fill={`url(#${u}bg)`} />
        <path d={g.strata} fill="none" stroke="#3a2770" strokeWidth={2} opacity={0.35} />
        <CrystalGroup list={g.backL} opacity={0.75} />
        <CrystalGroup list={g.backR} opacity={0.75} />
        <Glow x={640} y={610} r={90} color="#6fe3c8" opacity={0.35} />
        <Glow x={1000} y={600} r={90} color="#ff8fb1" opacity={0.35} />
        <path d={g.backRocks} fill="#c49aff" opacity={0.16} transform="translate(0 -2)" />
        <path d={g.backRocks} fill="#1a0f34" />
        <path d={g.floor} fill={`url(#${u}floor)`} />
        <Glow x={800} y={712} r={330} ry={64} color="#ffb547" opacity={0.42} />
      </Plane>
      <Plane fx>
        {/* круги эха */}
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform="translate(800 392)">
            <circle
              className="art-a art-echo"
              r={185}
              fill="none"
              stroke={i % 2 ? '#8ff0da' : '#c9b6ff'}
              strokeWidth={2}
              style={{ animationDelay: `${-i * 1.35}s` }}
            />
          </g>
        ))}
      </Plane>
      <Plane>
        {/* софит сверху: мягкий конус света на кольцо и пол */}
        <defs>
          <linearGradient id={`${u}cone`} x1="0" y1="60" x2="0" y2="760" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffd68a" stopOpacity="0.2" />
            <stop offset="0.6" stopColor="#ffd68a" stopOpacity="0.07" />
            <stop offset="1" stopColor="#ffd68a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M770 60H830L1010 760H590Z" fill={`url(#${u}cone)`} />
        {/* кольцевой свет на стойке */}
        <circle cx={800} cy={392} r={200} fill={`url(#${u}ring)`} className="art-glowpulse" />
        <path d="M800 498V724M800 724L754 778M800 724L846 778M800 724V784" stroke="#0a0616" strokeWidth={5} strokeLinecap="round" />
        <path d="M786 498H814L808 510H792Z" fill="#0a0616" />
        <circle cx={800} cy={392} r={104} fill="none" stroke="#1a1030" strokeWidth={14} />
        <circle cx={800} cy={392} r={104} fill="none" stroke="#ffd68a" strokeWidth={8} />
        <circle cx={800} cy={392} r={104} fill="none" stroke="#fff5dc" strokeWidth={2.6} />
        <Camera />
        <CrystalGroup list={g.left} opacity={0.96} />
        <CrystalGroup list={g.right} opacity={0.96} />
        <Glow x={470} y={700} r={200} ry={120} color="#ff8fb1" opacity={0.35} />
        <Glow x={1150} y={700} r={190} ry={110} color="#6fe3c8" opacity={0.32} />
        <path d={g.wallL} fill="#ff8fb1" opacity={0.28} transform="translate(2.5 0)" />
        <path d={g.wallR} fill="#6fe3c8" opacity={0.24} transform="translate(-2.5 0)" />
        <path d={g.wallL} fill="#06030e" />
        <path d={g.wallR} fill="#06030e" />
        <path d={g.ceil} fill="#b99aff" opacity={0.18} transform="translate(0 2)" />
        <path d={g.ceil} fill="#06030e" />
        <Fireflies seed={71} count={10} x0={420} x1={760} y0={420} y1={760} color="#ff9fc4" size={0.7} />
        <Fireflies seed={72} count={10} x0={860} x1={1200} y0={420} y1={760} color="#8ff0da" size={0.7} />
      </Plane>
    </>
  )
}

function CrystalGroup({ list, opacity }: { list: Crystal[]; opacity: number }) {
  return (
    <g opacity={opacity}>
      {list.map((c, i) => (
        <g key={i}>
          <path d={c.light} fill={mix(c.c, '#ffffff', 0.28)} />
          <path d={c.dark} fill={mix(c.c, '#1a0a2e', 0.42)} />
          <path d={c.edge} fill="none" stroke="#fff6fb" strokeWidth={1.1} opacity={0.6} />
        </g>
      ))}
    </g>
  )
}

function Camera() {
  return (
    <g>
      <path d="M1004 640L966 772M1004 640L1042 772M1004 640V780" stroke="#0a0616" strokeWidth={4} strokeLinecap="round" />
      <rect x={972} y={600} width={66} height={42} rx={6} fill="#0c0819" />
      <path d="M972 608L948 600V642L972 634Z" fill="#0c0819" />
      <circle cx={988} cy={586} r={15} fill="#0c0819" />
      <circle cx={1022} cy={584} r={17} fill="#0c0819" />
      <circle cx={988} cy={586} r={4} fill="#2a1c48" />
      <circle cx={1022} cy={584} r={5} fill="#2a1c48" />
      <path d="M948 600V642" stroke="#ffd68a" strokeWidth={1.3} opacity={0.5} />
      <path d="M972 601H1038" stroke="#c49aff" strokeWidth={1.2} opacity={0.4} />
      <Glow x={1030} y={610} r={10} color="#ff5a5a" opacity={0.9} className="art-blinklight" />
      <circle cx={1030} cy={610} r={2.2} fill="#ffb0a8" className="art-blinklight" />
      <text x={f(978)} y={f(632)} fontSize={9} fill="#3a2a60" fontFamily="var(--font-ui)">
        REC
      </text>
    </g>
  )
}
