// Площадь Запуска: крыши города, гирлянды фонариков дугами, светящиеся окна, фейерверки.
import { useMemo } from 'react'
import { f, poly, quadPts, useUid, type Pt } from '../geom'
import { FogPlane, Glow, Plane, RidgeFill, Sky, Stars, VGrad, ridge } from '../landscape'
import { mulberry32, rangeRand } from '../rng'

const HZ = 600
const BULBS = ['#ffd68a', '#ff8fb1', '#6fe3c8', '#ffb547']

function skylineD(seed: number, x0: number, x1: number, base: number, h: [number, number], w: [number, number]): string {
  const r = mulberry32(seed)
  const pts: Pt[] = [[x0, base + 20]]
  let x = x0
  while (x < x1) {
    const ww = rangeRand(r, w[0], w[1])
    const hh = rangeRand(r, h[0], h[1])
    const top = base - hh
    pts.push([x, top])
    const t = r()
    if (t < 0.3) pts.push([x + ww / 2, top - ww * 0.45])
    else if (t < 0.4) pts.push([x + ww * 0.42, top], [x + ww / 2, top - hh * 0.55], [x + ww * 0.58, top])
    else if (t < 0.5) pts.push([x + ww * 0.25, top], [x + ww * 0.25, top - 10], [x + ww * 0.35, top - 10], [x + ww * 0.35, top])
    pts.push([x + ww, top])
    x += ww
  }
  pts.push([x, base + 20])
  return poly(pts)
}

interface House {
  d: string
  lit: string
  lit2: string
  flick: [number, number][]
}

function housesD(seed: number, x0: number, x1: number, base: number, h: [number, number], w: [number, number], skip?: (x: number) => boolean): House {
  const r = mulberry32(seed)
  let d = ''
  let lit = ''
  let lit2 = ''
  const flick: [number, number][] = []
  let x = x0
  while (x < x1) {
    const ww = rangeRand(r, w[0], w[1])
    if (skip && skip(x + ww / 2)) {
      x += ww
      continue
    }
    const hh = rangeRand(r, h[0], h[1])
    const top = base - hh
    const roof = rangeRand(r, 0.35, 0.7) * ww
    const pts: Pt[] = [
      [x, base + 30],
      [x, top],
      [x + ww / 2, top - roof],
      [x + ww, top],
      [x + ww, base + 30],
    ]
    d += poly(pts)
    if (r() < 0.6) d += `M${f(x + ww * 0.68)} ${f(top - roof * 0.3)}V${f(top - roof * 0.9)}h10V${f(top - roof * 0.1)}Z`
    const cols = Math.max(1, Math.floor(ww / 26))
    const rows = Math.max(1, Math.floor(hh / 34))
    for (let cI = 0; cI < cols; cI++) {
      for (let rI = 0; rI < rows; rI++) {
        if (r() < 0.45) continue
        const wx = x + ((cI + 0.5) / cols) * ww - 5
        const wy = top + 12 + rI * 32
        const rect = `M${f(wx)} ${f(wy)}h10v14h-10Z`
        const k = r()
        if (k < 0.1) flick.push([wx, wy])
        else if (k < 0.6) lit += rect
        else lit2 += rect
      }
    }
    x += ww + rangeRand(r, -4, 6)
  }
  return { d, lit, lit2, flick }
}

export function LaunchScene() {
  const u = useUid()
  const g = useMemo(() => {
    const far = skylineD(801, -20, 1640, 548, [28, 96], [26, 64])
    const mid = housesD(802, -20, 1640, 640, [60, 130], [60, 110], (x) => x > 700 && x < 900)
    const nearL = housesD(803, -60, 470, 700, [150, 220], [110, 170])
    const nearR = housesD(804, 1150, 1700, 704, [150, 230], [110, 170])
    const ground = ridge({ seed: 805, base: 712, amp: 2, freq: 2 })
    const garlands: [Pt, Pt, Pt][] = [
      [
        [470, 520],
        [640, 600],
        [770, 470],
      ],
      [
        [830, 470],
        [960, 600],
        [1150, 520],
      ],
      [
        [380, 600],
        [800, 700],
        [1220, 600],
      ],
      [
        [200, 540],
        [330, 600],
        [470, 520],
      ],
      [
        [1150, 520],
        [1280, 600],
        [1420, 545],
      ],
    ]
    const wires: string[] = []
    const bulbs: { x: number; y: number; c: number; dl: number }[] = []
    garlands.forEach(([a, c, b], gi) => {
      const pts = quadPts(a, c, b, 36)
      wires.push(poly(pts, false))
      pts.forEach(([x, y], i) => {
        if (i % 3 === 1) bulbs.push({ x, y: y + 4, c: (i + gi) % BULBS.length, dl: -((i * 0.37 + gi) % 3) })
      })
    })
    const r = mulberry32(806)
    const bursts = [
      { x: 590, y: 200, c: '#ffd68a', dl: 0, n: 26, s: 1 },
      { x: 1000, y: 150, c: '#ff8fb1', dl: -2.3, n: 22, s: 0.9 },
      { x: 790, y: 250, c: '#8ff0da', dl: -4.4, n: 20, s: 0.75 },
      { x: 1260, y: 230, c: '#ffb547', dl: -5.6, n: 24, s: 1.05 },
      { x: 330, y: 170, c: '#c9b6ff', dl: -3.4, n: 22, s: 0.85 },
    ].map((b) => {
      let rays = ''
      let tips = ''
      for (let i = 0; i < b.n; i++) {
        const a = (i / b.n) * Math.PI * 2 + rangeRand(r, -0.05, 0.05)
        const r0 = 20 * b.s
        const r1 = rangeRand(r, 70, 96) * b.s
        rays += `M${f(Math.cos(a) * r0)} ${f(Math.sin(a) * r0)}L${f(Math.cos(a) * r1)} ${f(Math.sin(a) * r1 + 6)}`
        tips += `M${f(Math.cos(a) * r1 - 1.8)} ${f(Math.sin(a) * r1 + 6)}a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0Z`
      }
      return { ...b, rays, tips }
    })
    return { far, mid, nearL, nearR, ground, wires, bulbs, bursts }
  }, [])

  return (
    <>
      <Plane>
        <Sky
          stops={[
            [0, '#0a0d2b'],
            [0.42, '#161947'],
            [0.8, '#29285f'],
            [1, '#4a3462'],
          ]}
          y1={HZ}
        />
        <Stars seed={81} count={90} yMax={420} twinkle={16} bright={3} />
        <Glow x={800} y={560} r={900} ry={220} color="#9a5a8a" opacity={0.4} />
      </Plane>
      <Plane fx>
        {g.bursts.map((b, i) => (
          <g key={i} transform={`translate(${b.x} ${b.y})`}>
            <g className="art-a art-firework" style={{ animationDelay: `${b.dl}s` }} opacity={0}>
              <circle r={70 * b.s} fill={b.c} opacity={0.08} />
              <path d={b.rays} stroke={b.c} strokeWidth={2} strokeLinecap="round" opacity={0.85} />
              <path d={b.tips} fill="#fffbe8" />
            </g>
          </g>
        ))}
      </Plane>
      <Plane>
        <path d={g.far} fill="#2b2e66" />
        <path d={g.far} fill="none" stroke="#8a86c8" strokeWidth={1} opacity={0.18} />
      </Plane>
      <FogPlane seed={82} y={560} h={60} color="#a88ab8" opacity={0.2} duration={46} />
      <Plane>
        <defs>
          <VGrad
            id={`${u}mid`}
            y1={500}
            y2={700}
            stops={[
              [0, '#1c1f4c'],
              [1, '#151843'],
            ]}
          />
        </defs>
        <path d={g.mid.d} fill={`url(#${u}mid)`} />
        <path d={g.mid.lit} fill="#ffc977" opacity={0.9} />
        <path d={g.mid.lit2} fill="#ffb24d" opacity={0.65} />
        {g.mid.flick.map(([x, y], i) => (
          <rect key={i} x={f(x)} y={f(y)} width={10} height={14} fill="#ffd68a" className="art-flicker" style={{ animationDelay: `${-i * 0.9}s` }} />
        ))}
        <TownHall />
        <RidgeFill geo={g.ground} from="#141640" to="#0a0c28" y1={700} y2={900} />
        <Glow x={800} y={740} r={420} ry={60} color="#ffb547" opacity={0.2} />
        <path d={g.nearL.d} fill="#0b0e2c" />
        <path d={g.nearR.d} fill="#0b0e2c" />
        <path d={g.nearL.lit + g.nearR.lit} fill="#ffbf66" opacity={0.85} />
        <path d={g.nearL.lit2 + g.nearR.lit2} fill="#ff9f45" opacity={0.55} />
        <Garlands wires={g.wires} bulbs={g.bulbs} />
        <LampPost x={596} />
        <LampPost x={1004} />
      </Plane>
    </>
  )
}

function TownHall() {
  return (
    <g>
      <path d="M716 640V520H884V640Z" fill="#171a46" />
      <path d="M706 522L800 470L894 522Z" fill="#141740" />
      <path d="M770 480V330H830V480Z" fill="#171a46" />
      <path d="M762 334L800 250L838 334Z" fill="#141740" />
      <path d="M800 250V226" stroke="#141740" strokeWidth={3} />
      <path d="M762 334L800 250" stroke="#8a86c8" strokeWidth={1.2} opacity={0.4} />
      <Glow x={800} y={380} r={60} color="#ffc56a" opacity={0.7} />
      <circle cx={800} cy={380} r={20} fill="#ffe0a0" />
      <circle cx={800} cy={380} r={20} fill="none" stroke="#141740" strokeWidth={3} />
      <path d="M800 380V366M800 380L810 386" stroke="#3a2a30" strokeWidth={2.2} strokeLinecap="round" />
      {[736, 766, 834, 864].map((x) => (
        <path key={x} d={`M${x - 7} 620V590Q${x} 580 ${x + 7} 590V620Z`} fill="#ffc977" opacity={0.85} />
      ))}
      <path d="M784 640V600Q800 586 816 600V640Z" fill="#ffd68a" opacity={0.9} />
    </g>
  )
}

function Garlands({ wires, bulbs }: { wires: string[]; bulbs: { x: number; y: number; c: number; dl: number }[] }) {
  const u = useUid()
  return (
    <g>
      <defs>
        {BULBS.map((c, i) => (
          <radialGradient key={i} id={`${u}${i}`}>
            <stop offset="0" stopColor={c} stopOpacity="0.9" />
            <stop offset="0.3" stopColor={c} stopOpacity="0.3" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <g fill="none" stroke="#090b24" strokeWidth={1.6}>
        {wires.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {bulbs.map((b, i) => (
        <g key={i}>
          <circle cx={f(b.x)} cy={f(b.y)} r={13} fill={`url(#${u}${b.c})`} />
          <circle
            cx={f(b.x)}
            cy={f(b.y)}
            r={3.2}
            fill={BULBS[b.c]}
            className={i % 3 === 0 ? 'art-twinkle' : undefined}
            style={i % 3 === 0 ? { animationDelay: `${b.dl}s`, animationDuration: '2.4s' } : undefined}
          />
        </g>
      ))}
    </g>
  )
}

function LampPost({ x }: { x: number }) {
  return (
    <g>
      <Glow x={x} y={650} r={90} color="#ffc56a" opacity={0.6} />
      <path d={`M${x} 800V660`} stroke="#090b24" strokeWidth={5} />
      <path d={`M${x - 10} 800h20v6h-20Z`} fill="#090b24" />
      <path d={`M${x - 9} 664L${x - 7} 640H${x + 7}L${x + 9} 664Z`} fill="#ffd68a" />
      <path d={`M${x - 11} 640H${x + 11}L${x} 630Z`} fill="#090b24" />
      <path d={`M${x - 10} 664h20v4h-20Z`} fill="#090b24" />
    </g>
  )
}
