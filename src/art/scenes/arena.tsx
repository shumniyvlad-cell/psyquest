// Арена Продаж: силуэт амфитеатра арками на закатном небе, солнце в арках, флаги, факелы.
import { useMemo } from 'react'
import { f, useUid, type Pt } from '../geom'
import { FogPlane, Glow, Plane, RidgeFill, Sky, Stars, VGrad, birdsD, ridge } from '../landscape'
import { mulberry32, rangeRand } from '../rng'

const HZ = 560

function archesD(cx: number, R: number, n: number, yb: number, yt: number, wk: number, a0 = -1.2, a1 = 1.2): { d: string; xs: number[] } {
  let d = ''
  const xs: number[] = []
  for (let i = 0; i < n; i++) {
    const t = a0 + ((a1 - a0) * (i + 0.5)) / n
    const x = cx + Math.sin(t) * R
    const dx = (Math.cos(t) * R * (a1 - a0)) / n
    const w = dx * wk
    const hw = w / 2
    const ya = yt + hw
    d += `M${f(x - hw)} ${f(yb)}V${f(ya)}A${f(hw)} ${f(hw)} 0 0 1 ${f(x + hw)} ${f(ya)}V${f(yb)}Z`
    xs.push(x)
  }
  return { d, xs }
}

export function ArenaScene() {
  const u = useUid()
  const g = useMemo(() => {
    const hills = ridge({ seed: 901, base: 556, amp: 22, freq: 2.6, sharp: 0.2 })
    const ground = ridge({ seed: 902, base: 648, amp: 6, freq: 2 })
    const R = 480
    const top = (x: number) => 402 + Math.pow((x - 800) / R, 2) * 58
    const outline: Pt[] = []
    for (let x = 316; x <= 1284; x += 24) outline.push([x, top(x)])
    const merlons = outline
      .filter((_, i) => i % 2 === 0)
      .map(([x, y]) => `M${f(x - 7)} ${f(y + 2)}V${f(y - 9)}H${f(x + 7)}V${f(y + 2)}Z`)
      .join('')
    const body = `M316 660L316 ${f(top(316))}` + outline.map(([x, y]) => `L${f(x)} ${f(y)}`).join('') + `L1284 660Z`
    const tier1 = archesD(800, R, 15, 652, 556, 0.62)
    const tier2 = archesD(800, R, 15, 536, 476, 0.54)
    const tier3 = archesD(800, R, 23, 452, 430, 0.4, -1.12, 1.12)
    const bands = `M316 544H1284V552H316ZM316 462H1284V468H316Z`
    const flags = [-0.95, -0.5, 0, 0.5, 0.95].map((t, i) => {
      const x = 800 + Math.sin(t) * R
      return { x, y: top(x) - 8, c: i % 2 ? '#ffb547' : '#d23a52', h: i === 2 ? 74 : 58 }
    })
    const r = mulberry32(903)
    // облака: стопки мягких эллипсов (радиальный градиент), подсвеченные снизу
    const clouds: { x: number; y: number; rx: number; ry: number; lit: boolean; o: number }[] = []
    for (let i = 0; i < 7; i++) {
      const cx = rangeRand(r, 120, 1480)
      const cy = rangeRand(r, 170, 380)
      const w = rangeRand(r, 180, 360)
      const lit = cy > 280
      for (let k = 0; k < 4; k++) {
        clouds.push({
          x: cx + rangeRand(r, -0.5, 0.5) * w,
          y: cy + rangeRand(r, -6, 6),
          rx: w * rangeRand(r, 0.4, 0.75),
          ry: rangeRand(r, 9, 20),
          lit,
          o: rangeRand(r, 0.45, 0.85),
        })
      }
    }
    const birds = birdsD(904, 1040, 1300, 150, 260, 6, 1.1)
    return { hills, ground, body, merlons, tier1, tier2, tier3, bands, flags, clouds, birds }
  }, [])

  return (
    <>
      <Plane>
        <Sky
          stops={[
            [0, '#1b1340'],
            [0.3, '#3b1d5a'],
            [0.56, '#78295d'],
            [0.78, '#c64d4c'],
            [0.92, '#ee8744'],
            [1, '#ffc16e'],
          ]}
          y1={HZ}
        />
        <Stars seed={91} count={34} yMax={170} twinkle={8} bright={1} opacity={0.7} />
        <Glow x={800} y={480} r={760} ry={420} color="#ff9a4a" opacity={0.5} />
        <circle cx={800} cy={486} r={92} fill="#ffd98f" />
        <Glow x={800} y={486} r={220} color="#ffe2a0" opacity={0.7} hot="#fff6da" />
        <defs>
          <radialGradient id={`${u}cl`}>
            <stop offset="0" stopColor="#ffb68c" stopOpacity="0.85" />
            <stop offset="0.6" stopColor="#e27a72" stopOpacity="0.35" />
            <stop offset="1" stopColor="#c05a6a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${u}cd`}>
            <stop offset="0" stopColor="#b0567a" stopOpacity="0.7" />
            <stop offset="0.6" stopColor="#8a3a6a" stopOpacity="0.28" />
            <stop offset="1" stopColor="#6a2a5a" stopOpacity="0" />
          </radialGradient>
        </defs>
        {g.clouds.map((c, i) => (
          <ellipse key={i} cx={f(c.x)} cy={f(c.y)} rx={f(c.rx)} ry={f(c.ry)} fill={`url(#${u}${c.lit ? 'cl' : 'cd'})`} opacity={f(c.o)} />
        ))}
        <path d={g.birds} fill="#2a1030" opacity={0.75} />
        <RidgeFill geo={g.hills} from="#6a2b56" to="#8e3f56" y2={HZ + 20} />
      </Plane>
      <FogPlane seed={92} y={560} h={60} color="#ff9f7a" opacity={0.2} duration={50} />
      <Plane>
        <defs>
          <VGrad
            id={`${u}ar`}
            y1={400}
            y2={660}
            stops={[
              [0, '#2b1236'],
              [1, '#1b0a24'],
            ]}
          />
        </defs>
        <path d={g.body + g.tier1.d + g.tier2.d + g.tier3.d} fill={`url(#${u}ar)`} fillRule="evenodd" />
        <path d={g.merlons} fill="#2b1236" />
        <path d={g.bands} fill="#200c2a" />
        <path d={g.body} fill="none" stroke="#ffb07a" strokeWidth={1.4} opacity={0.35} />
        {g.flags.map((fl, i) => (
          <g key={i} transform={`translate(${f(fl.x)} ${f(fl.y)})`}>
            <path d={`M0 0V${-fl.h}`} stroke="#241030" strokeWidth={3} />
            <circle cy={-fl.h - 2} r={3} fill="#241030" />
            <g transform={`translate(1.5 ${-fl.h + 2})`}>
              <path
                className="art-a art-flag"
                style={{ animationDelay: `${-i * 0.5}s` }}
                d="M0 0C12 -3 24 3 38 0L30 11L38 22C24 25 12 19 0 22Z"
                fill={fl.c}
              />
            </g>
          </g>
        ))}
        <RidgeFill geo={g.ground} from="#241029" to="#14081c" y1={640} y2={900} rim="#ffb07a" rimOpacity={0.18} />
        <Glow x={800} y={660} r={520} ry={50} color="#ff9a4a" opacity={0.22} />
        <Torch x={548} y={770} />
        <Torch x={1052} y={770} />
      </Plane>
    </>
  )
}

function Torch({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Glow x={x} y={y - 104} r={110} color="#ff9a3c" opacity={0.6} className="art-flicker" />
      <path d={`M${x} ${y + 80}L${x - 3} ${y - 80}H${x + 3}Z`} fill="#12071a" />
      <path d={`M${x - 14} ${y - 80}H${x + 14}L${x + 9} ${y - 94}H${x - 9}Z`} fill="#12071a" />
      <g className="art-flicker" style={{ animationDuration: '1.4s' }}>
        <path d={`M${x} ${y - 140}C${x + 12} ${y - 118} ${x + 13} ${y - 102} ${x} ${y - 94}C${x - 13} ${y - 102} ${x - 10} ${y - 120} ${x} ${y - 140}Z`} fill="#ffb547" />
        <path d={`M${x} ${y - 124}C${x + 6} ${y - 112} ${x + 6} ${y - 102} ${x} ${y - 97}C${x - 6} ${y - 102} ${x - 5} ${y - 112} ${x} ${y - 124}Z`} fill="#fff0c4" />
      </g>
    </g>
  )
}
