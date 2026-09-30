// Маяк крупным планом: лампа разгорается по lit (0..1), к бухте подплывают корабли (ships 0..12).
// Обёртка как у Scene: absolute/inset:0, SVG-слои 1600×900 slice.
import { useMemo, type JSX } from 'react'
import './art.css'
import { clamp, cx, lerp, noise1, smooth, useUid, type Pt } from './geom'
import { LighthouseBeam, LighthouseTower, Ship, towerGeo } from './lighthouse-parts'
import { Aurora, FogPlane, Glow, LightPath, Plane, RidgeFill, Sky, Stars, Swells, VGrad, ridge } from './landscape'
import { mulberry32, rangeRand } from './rng'

const HZ = 520

/** Места для кораблей: сначала — видимые и на узком телефоне (центр), потом — по краям. */
const SLOTS: [number, number, number][] = [
  [700, 604, 0.55],
  [640, 712, 0.82],
  [720, 800, 1.05],
  [620, 566, 0.4],
  [548, 650, 0.66],
  [470, 764, 0.98],
  [380, 590, 0.5],
  [270, 690, 0.8],
  [400, 850, 1.2],
  [160, 616, 0.58],
  [100, 780, 1.05],
  [300, 552, 0.36],
]

export function LighthouseArt({
  lit,
  ships = 0,
  className,
}: {
  /** 0..1 — 0 тёмный, 0.5 тёплый огонёк, 1 полный свет с лучом */
  lit: number
  /** 0..12 */
  ships?: number
  className?: string
}): JSX.Element {
  const u = useUid()
  const L = clamp(lit)
  const n = Math.round(clamp(ships, 0, 12))
  const g = useMemo(() => {
    const coast = ridge({ seed: 1101, base: (x) => lerp(500, 530, clamp((x - 200) / 420)), amp: 12, freq: 4, x0: -20, x1: 660, bottom: HZ + 4 })
    const r = mulberry32(1102)
    const key: Pt[] = [
      [764, 912],
      [772, 860],
      [790, 792],
      [812, 734],
      [842, 694],
      [874, 668],
      [906, 654],
      [960, 650],
      [1010, 652],
      [1070, 640],
      [1150, 626],
      [1250, 612],
      [1370, 600],
      [1490, 590],
      [1630, 582],
    ]
    const nz = noise1(1103)
    const pts: Pt[] = [[764, 912, 0]]
    for (let i = 1; i < key.length - 1; i++) {
      const [x0, y0] = key[i]
      const [x1, y1] = key[i + 1]
      for (let k = 0; k < 3; k++) {
        const t = k / 3
        const x = lerp(x0, x1, t)
        const y = lerp(y0, y1, t)
        const flat = Math.abs(x - 930) < 70 ? 0.1 : 1
        pts.push([x + (r() - 0.5) * 5, y + nz(x * 0.045) * 10 * flat, r() < 0.4 ? 0 : 0.6])
      }
    }
    pts.push([1630, 582], [1630, 912, 0])
    const cliff = smooth(pts, true)
    const cliffTop = smooth(pts.slice(1, -2), false)
    const facets = 'M800 780l24 50l-6 60M850 700l-6 50l20 70M1080 660l18 60l-12 80M1200 640l-14 70l18 70M1340 620l14 60l-10 80M960 660l8 40'
    const rocks = [
      smooth([[690, 906, 0], [700, 872], [730, 856], [760, 866], [772, 906, 0]], true),
      smooth([[640, 900, 0], [650, 884], [672, 880], [684, 900, 0]], true),
    ].join('')
    const sr = mulberry32(1104)
    const slots = SLOTS.map(([x, y, s], i) => ({
      x: x + rangeRand(sr, -18, 18),
      y: y + rangeRand(sr, -6, 6),
      s,
      flip: i % 2 === 1,
      delay: -rangeRand(sr, 0, 5),
    }))
    return { coast, cliff, cliffTop, facets, rocks, slots, tower: towerGeo(930, 652, 470) }
  }, [])
  const t = g.tower
  const beam = clamp((L - 0.66) / 0.34)
  const aur = clamp((L - 0.45) / 0.55)

  return (
    <div className={cx('art-scene', 'art-lighthouse', className)} style={{ background: '#070d26' }}>
      <Plane>
        <Sky
          stops={[
            [0, '#060b22'],
            [0.42, '#0d1a40'],
            [0.8, '#182d5a'],
            [1, '#263f6c'],
          ]}
          y1={HZ}
        />
        <g className="art-lh-fade" style={{ opacity: aur }}>
          <Aurora seed={1105} y={230} h={160} x0={120} x1={1300} color="#6fe3c8" color2="#8e7bd8" opacity={0.5} bands={3} />
        </g>
        <Stars seed={1106} count={150} yMax={480} twinkle={28} bright={5} />
        <Glow x={t.lx} y={t.ly + 40} r={820} ry={520} color="#ffb85c" opacity={0.26 * L} fade />
        <Glow x={800} y={HZ} r={900} ry={160} color="#5f7fb8" opacity={0.32} />
        <RidgeFill geo={g.coast} from="#1f3264" to="#2a4274" y2={HZ} />
        <defs>
          <VGrad
            id={`${u}sea`}
            y1={HZ}
            y2={900}
            stops={[
              [0, '#27436f'],
              [0.28, '#132754'],
              [1, '#07102c'],
            ]}
          />
        </defs>
        <rect x={-400} y={HZ} width={2400} height={400} fill={`url(#${u}sea)`} />
        <Swells seed={1107} y0={HZ + 3} y1={900} color="#8fb0e0" opacity={0.14} count={26} />
        <g className="art-lh-fade" style={{ opacity: L }}>
          <LightPath seed={1108} x={t.lx} y0={HZ + 3} y1={660} color="#ffd68a" width={70} spread={0.1} count={22} opacity={0.7} />
          <LightPath seed={1109} x={t.lx - 250} y0={HZ + 40} y1={900} color="#ffcf80" width={120} spread={0.2} count={20} opacity={0.3} shimmer={5} />
        </g>
      </Plane>
      <FogPlane seed={1110} y={HZ + 8} h={44} color="#9fb4e0" opacity={0.2} duration={48} />
      <Plane fx>
        {beam > 0 && <LighthouseBeam x={t.lx} y={t.ly} len={1100} spread={140} color="#ffe3a0" opacity={0.85 * beam} period={9} />}
      </Plane>
      <Plane>
        {g.slots.slice(0, n).map((sl, i) => (
          <Ship key={i} x={sl.x} y={sl.y} s={sl.s} flip={sl.flip} delay={sl.delay} />
        ))}
        <defs>
          <VGrad
            id={`${u}cl`}
            y1={590}
            y2={900}
            stops={[
              [0, '#10183c'],
              [1, '#050a1e'],
            ]}
          />
        </defs>
        <path d={g.cliff} fill={`url(#${u}cl)`} />
        <path d={g.facets} fill="none" stroke="#1d2a5a" strokeWidth={2} opacity={0.7} strokeLinecap="round" />
        <path d={g.cliffTop} fill="none" stroke="#9aa6e0" strokeWidth={1.6} opacity={0.28} />
        <path d={g.cliffTop} fill="none" stroke="#ffcf80" strokeWidth={1.8} className="art-lh-fade" style={{ opacity: 0.4 * L }} />
        <path d={g.rocks} fill="#050818" />
        {/* домик смотрителя */}
        <path d="M1000 652V616H1072V650Z" fill="#0c1232" />
        <path d="M992 618L1036 590L1080 618Z" fill="#0a0f2b" />
        <rect x={1016} y={624} width={14} height={14} rx={1.5} fill={L > 0.15 ? '#ffc977' : '#141b44'} className="art-lh-fade" />
        <Glow x={1023} y={631} r={36} color="#ffb24d" opacity={L > 0.15 ? 0.6 : 0} fade />
        <LighthouseTower geo={t} lit={L} body="#121a40" stripe="#1e2758" rim="#9aa6e0" />
        <Glow x={t.lx} y={t.ly} r={60 + 240 * L} color="#ffc56a" opacity={clamp(L * 1.5)} hot="#fffbea" fade />
      </Plane>
    </div>
  )
}
