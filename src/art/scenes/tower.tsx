// Башня Ботов: высокая башня с окнами-огоньками (циан), антенна с мигающим огнём, шестерни, провода.
import { useMemo } from 'react'
import { ellipsePath, f, poly, quadPts, smooth, useUid, type Pt } from '../geom'
import { Aurora, Fireflies, FogPlane, Glow, GlowGrad, Plane, RidgeFill, Sky, Stars, ridge, rockD } from '../landscape'
import { mulberry32 } from '../rng'

const HZ = 600

export function gearD(R: number, teeth: number, depth = 0.17): string {
  const pts: Pt[] = []
  const ri = R * (1 - depth)
  const step = (Math.PI * 2) / teeth
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step
    pts.push([Math.cos(a0) * ri, Math.sin(a0) * ri])
    pts.push([Math.cos(a0 + step * 0.16) * R, Math.sin(a0 + step * 0.16) * R])
    pts.push([Math.cos(a0 + step * 0.44) * R, Math.sin(a0 + step * 0.44) * R])
    pts.push([Math.cos(a0 + step * 0.6) * ri, Math.sin(a0 + step * 0.6) * ri])
  }
  let d = poly(pts) + ellipsePath(0, 0, R * 0.16)
  const r1 = R * 0.3
  const r2 = R * 0.64
  const spokes = teeth > 9 ? 6 : 5
  for (let k = 0; k < spokes; k++) {
    const a1 = (k / spokes) * Math.PI * 2 + 0.16
    const a2 = ((k + 1) / spokes) * Math.PI * 2 - 0.16
    const c = Math.cos
    const s = Math.sin
    d +=
      `M${f(c(a1) * r1)} ${f(s(a1) * r1)}L${f(c(a1) * r2)} ${f(s(a1) * r2)}` +
      `A${f(r2)} ${f(r2)} 0 0 1 ${f(c(a2) * r2)} ${f(s(a2) * r2)}` +
      `L${f(c(a2) * r1)} ${f(s(a2) * r1)}A${f(r1)} ${f(r1)} 0 0 0 ${f(c(a1) * r1)} ${f(s(a1) * r1)}Z`
  }
  return d
}

const WINDOWS: [number, number, number][] = [
  // x, y, мерцает?
  [786, 596, 0],
  [816, 520, 1],
  [780, 452, 0],
  [812, 388, 0],
  [788, 324, 1],
  [812, 262, 0],
  [770, 540, 0],
  [826, 432, 0],
]

export function TowerScene() {
  const u = useUid()
  const g = useMemo(() => {
    const l1 = ridge({ seed: 601, base: 548, amp: 38, freq: 2.4, sharp: 0.3 })
    const l2 = ridge({ seed: 602, base: 592, amp: 22, freq: 3 })
    const l3 = ridge({ seed: 603, base: 662, amp: 12, freq: 2.6 })
    const r = mulberry32(604)
    const rocks = [rockD(r, 560, 690, 120, 40), rockD(r, 1080, 700, 150, 46), rockD(r, 330, 760, 200, 60), rockD(r, 1330, 770, 220, 70)].join('')
    // ствол башни с лёгким изгибом
    const shaft = smooth(
      [
        [736, 664, 0],
        [742, 560],
        [752, 420],
        [760, 214, 0],
        [840, 214, 0],
        [848, 420],
        [858, 560],
        [864, 664, 0],
      ],
      true,
    )
    const ledges = [572, 482, 392, 302].map((y) => {
      const k = (664 - y) / 450
      const hw = 64 - k * 22 + 8
      return `M${800 - hw} ${y}h${hw * 2}v7h${-hw * 2}Z`
    })
    // провода-цепные линии
    const wireL1 = quadPts([764, 300], [520, 470], [262, 470], 24)
    const wireL2 = quadPts([766, 316], [520, 500], [262, 490], 24)
    const wireR1 = quadPts([836, 300], [1090, 480], [1340, 486], 24)
    const wireR2 = quadPts([834, 318], [1090, 510], [1340, 506], 24)
    const beads = [...wireL1.filter((_, i) => i % 4 === 2), ...wireR1.filter((_, i) => i % 4 === 2)]
    return {
      l1,
      l2,
      l3,
      rocks,
      shaft,
      ledges: ledges.join(''),
      wires: [wireL1, wireL2, wireR1, wireR2].map((p) => poly(p, false)),
      beads,
      big: gearD(92, 14),
      mid: gearD(60, 10),
      small: gearD(34, 8),
    }
  }, [])

  return (
    <>
      <Plane>
        <Sky
          stops={[
            [0, '#060b1f'],
            [0.4, '#0c1636'],
            [0.78, '#15284e'],
            [1, '#224168'],
          ]}
          y1={HZ}
        />
        <Aurora seed={61} y={230} h={130} x0={200} x1={1400} color="#5fd8e8" color2="#6a5ad0" opacity={0.2} bands={2} />
        <Stars seed={62} count={160} yMax={520} twinkle={34} bright={6} color="#eaf6ff" />
        <Glow x={800} y={HZ} r={900} ry={200} color="#3a78a8" opacity={0.32} />
        <RidgeFill geo={g.l1} from="#1c2a56" to="#283b6a" y2={HZ + 20} />
      </Plane>
      <FogPlane seed={63} y={590} h={60} color="#6f8fc0" opacity={0.2} duration={48} />
      <Plane>
        <RidgeFill geo={g.l2} from="#131d43" to="#19264f" y2={680} />
        {/* провода и опоры */}
        <g fill="none" stroke="#070b1f" strokeWidth={2}>
          {g.wires.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <path d="M262 600V440M244 452H280M246 470H278M1340 612V452M1322 464H1358M1324 482H1356" stroke="#0a0f28" strokeWidth={5} />
        <GlowGrad id={`${u}cy`} color="#5fe3f0" />
        {g.beads.map(([x, y], i) => (
          <g key={i}>
            <Glow x={x} y={y + 2} r={10} color="#6fe3f0" opacity={0.8} gid={`${u}cy`} />
            <circle cx={f(x)} cy={f(y + 2)} r={1.8} fill="#d8fbff" className="art-twinkle" style={{ animationDelay: `${-i * 0.45}s`, animationDuration: '2.2s' }} />
          </g>
        ))}
        {/* шестерни за башней */}
        <Gear x={688} y={520} d={g.big} cls="art-spin" dur={56} />
        <Gear x={915} y={398} d={g.mid} cls="art-spin-rev" dur={38} />
        <Gear x={712} y={330} d={g.small} cls="art-spin" dur={22} />
        {/* башня */}
        <Glow x={800} y={170} r={260} color="#4fd8e0" opacity={0.28} />
        <defs>
          <linearGradient id={`${u}t`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1e2a58" />
            <stop offset="0.5" stopColor="#111a40" />
            <stop offset="1" stopColor="#0a1030" />
          </linearGradient>
        </defs>
        <path d={g.shaft} fill="#6f9ae0" opacity={0.28} transform="translate(-1.8 -1)" />
        <path d={g.shaft} fill={`url(#${u}t)`} />
        <path d={g.ledges} fill="#0b1132" />
        {WINDOWS.map(([x, y, fl], i) => (
          <g key={i}>
            <Glow x={x + 6} y={y + 8} r={26} color="#5fe3f0" opacity={0.6} gid={`${u}cy`} />
            <path
              d={`M${x} ${y + 18}V${y + 6}Q${x + 6} ${y - 1} ${x + 12} ${y + 6}V${y + 18}Z`}
              fill="#8ff3ff"
              className={fl ? 'art-flicker' : undefined}
              style={fl ? { animationDelay: `${-i}s`, animationDuration: '1.9s' } : undefined}
            />
          </g>
        ))}
        {/* дверь */}
        <path d="M786 664V630Q800 616 814 630V664Z" fill="#060a1e" />
        <path d="M790 664V632Q800 622 810 632V664Z" fill="#3fb6c6" opacity={0.35} />
        {/* площадка, кабина-«глаз», купол */}
        <path d="M730 214h140v10H730Z" fill="#0b1132" />
        <path d="M736 214V200h128v14" fill="none" stroke="#1f2c5c" strokeWidth={2} />
        <path d="M740 200h120M748 214V200M764 214V200M780 214V200M796 214V200M812 214V200M828 214V200M844 214V200" stroke="#1f2c5c" strokeWidth={1.4} />
        <path d="M770 200V160Q800 140 830 160V200Z" fill="#111a40" />
        <Glow x={800} y={178} r={44} color="#5fe3f0" opacity={0.85} />
        <circle cx={800} cy={178} r={13} fill="#8ff3ff" />
        <circle cx={800} cy={178} r={13} fill="none" stroke="#0b1132" strokeWidth={3} />
        <circle cx={800} cy={178} r={5} fill="#e8fdff" className="art-flicker" />
        <path d="M766 162Q800 118 834 162Z" fill="#0d1437" />
        {/* тарелка */}
        <path d="M856 196l18-26" stroke="#0d1437" strokeWidth={3} />
        <path d="M862 168q14 -14 28 4q-14 12 -28 -4Z" fill="#0d1437" />
        {/* антенна-решётка */}
        <path d="M800 128V52M790 128L800 60L810 128M792 112H808M794 94H806M796 78H804" stroke="#0d1437" strokeWidth={2.4} fill="none" />
        <Glow x={800} y={50} r={40} color="#ff6b5a" opacity={0.9} className="art-blinklight" />
        <circle cx={800} cy={50} r={3.6} fill="#ffd0c8" className="art-blinklight" />
      </Plane>
      <Plane>
        <RidgeFill geo={g.l3} from="#0b1130" to="#070a22" y1={640} y2={900} rim="#5fb8e0" rimOpacity={0.14} />
        <path d={g.rocks} fill="#080c24" />
        <Fireflies seed={64} count={14} x0={480} x1={1120} y0={260} y1={640} color="#7feeff" size={0.7} />
      </Plane>
    </>
  )
}

function Gear({ x, y, d, cls, dur }: { x: number; y: number; d: string; cls: string; dur: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform="translate(-1.6 -1.6)">
        <g className={`art-a ${cls}`} style={{ animationDuration: `${dur}s` }}>
          <path d={d} fill="#6f9ae0" opacity={0.24} fillRule="evenodd" />
        </g>
      </g>
      <g className={`art-a ${cls}`} style={{ animationDuration: `${dur}s` }}>
        <path d={d} fill="#101840" fillRule="evenodd" />
      </g>
    </g>
  )
}

