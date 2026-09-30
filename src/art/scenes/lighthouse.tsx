// Маяк (финал главы): утёс, маяк с вращающимся лучом, море в бликах, корабли с огоньками на горизонте.
import { useMemo } from 'react'
import { lerp, noise1, smooth, useUid, type Pt } from '../geom'
import { LighthouseBeam, LighthouseTower, Ship, towerGeo } from '../lighthouse-parts'
import { Aurora, FogPlane, Glow, LightPath, Plane, RidgeFill, Sky, Stars, Swells, VGrad, ridge } from '../landscape'
import { mulberry32 } from '../rng'

const HZ = 560

export function LighthouseScene() {
  const u = useUid()
  const g = useMemo(() => {
    const coast = ridge({ seed: 1001, base: 548, amp: 12, freq: 4, x0: -20, x1: 430, bottom: HZ + 4 })
    const r = mulberry32(1002)
    const key: Pt[] = [
      [548, 912],
      [566, 836],
      [604, 758],
      [644, 690],
      [692, 642],
      [744, 612],
      [800, 603],
      [856, 607],
      [906, 620],
      [962, 642],
      [1032, 666],
      [1112, 704],
      [1178, 764],
      [1226, 842],
      [1248, 912],
    ]
    const n = noise1(1009)
    const cliffPts: Pt[] = [[548, 912, 0]]
    for (let i = 1; i < key.length - 1; i++) {
      const [x0, y0] = key[i]
      const [x1, y1] = key[i + 1]
      for (let k = 0; k < 3; k++) {
        const t = k / 3
        const x = lerp(x0, x1, t)
        const y = lerp(y0, y1, t)
        const near = Math.abs(x - 800) < 60 ? 0.15 : 1
        cliffPts.push([x + (r() - 0.5) * 6, y + n(x * 0.05) * 9 * near, r() < 0.4 ? 0 : 0.6])
      }
    }
    cliffPts.push([1248, 912, 0])
    const cliff = smooth(cliffPts, true)
    const cliffTop = smooth(cliffPts.slice(1, -1), false)
    const facets = 'M620 720l30 40l-6 60M700 660l-8 50l24 70M1000 660l20 50l-10 70M1120 712l-20 60l14 60M860 640l6 40'
    const rocksL = smooth(
      [
        [-30, 912, 0],
        [-30, 830],
        [80, 812],
        [180, 830],
        [270, 870],
        [310, 912, 0],
      ],
      true,
    )
    const rocksR = smooth(
      [
        [1330, 912, 0],
        [1380, 860],
        [1480, 836],
        [1630, 826],
        [1630, 912, 0],
      ],
      true,
    )
    return { coast, cliff, cliffTop, facets, rocksL, rocksR, tower: towerGeo(800, 606, 330) }
  }, [])
  const t = g.tower

  return (
    <>
      <Plane>
        <Sky
          stops={[
            [0, '#070f2b'],
            [0.42, '#0f1f4a'],
            [0.8, '#1b3462'],
            [1, '#2c4b78'],
          ]}
          y1={HZ}
        />
        <Aurora seed={1003} y={250} h={170} x0={180} x1={1420} color="#6fe3c8" color2="#8e7bd8" opacity={0.5} bands={3} />
        <Stars seed={1004} count={130} yMax={500} twinkle={26} bright={5} />
        <Glow x={t.lx} y={t.ly} r={700} ry={420} color="#ffb85c" opacity={0.2} />
        <Glow x={800} y={HZ} r={900} ry={170} color="#5f7fb8" opacity={0.35} />
        <RidgeFill geo={g.coast} from="#223668" to="#2c4476" y2={HZ} />
        <defs>
          <VGrad
            id={`${u}sea`}
            y1={HZ}
            y2={900}
            stops={[
              [0, '#294677'],
              [0.3, '#152a58'],
              [1, '#08122e'],
            ]}
          />
        </defs>
        <rect x={-400} y={HZ} width={2400} height={380} fill={`url(#${u}sea)`} />
        <Swells seed={1005} y0={HZ + 3} y1={900} color="#8fb0e0" opacity={0.16} count={26} />
        <LightPath seed={1006} x={t.lx} y0={HZ + 3} y1={900} color="#ffd68a" width={110} spread={0.12} count={34} opacity={0.6} />
        {[
          [330, HZ + 2, 0.34, false],
          [470, HZ + 5, 0.42, true],
          [1150, HZ + 3, 0.38, false],
          [1330, HZ + 6, 0.46, true],
          [1010, HZ + 10, 0.5, true],
        ].map(([x, y, s, fl], i) => (
          <Ship key={i} x={x as number} y={y as number} s={s as number} flip={fl as boolean} delay={-i * 1.3} />
        ))}
      </Plane>
      <FogPlane seed={1007} y={HZ + 6} h={40} color="#9fb4e0" opacity={0.2} duration={46} />
      <Plane fx>
        <LighthouseBeam x={t.lx} y={t.ly} len={1000} spread={130} color="#ffe3a0" opacity={0.85} period={9} />
      </Plane>
      <Plane>
        <defs>
          <VGrad
            id={`${u}cl`}
            y1={600}
            y2={900}
            stops={[
              [0, '#10183c'],
              [1, '#060a1f'],
            ]}
          />
        </defs>
        <path d={g.cliff} fill={`url(#${u}cl)`} />
        <path d={g.facets} fill="none" stroke="#1d2a5a" strokeWidth={1.8} opacity={0.7} strokeLinecap="round" />
        <path d={g.cliffTop} fill="none" stroke="#ffcf80" strokeWidth={1.6} opacity={0.35} />
        {/* домик смотрителя */}
        <path d="M852 612V580H912V618Z" fill="#0c1232" />
        <path d="M846 582L882 560L918 582Z" fill="#0a0f2b" />
        <rect x={866} y={588} width={12} height={12} rx={1.5} fill="#ffc977" />
        <Glow x={872} y={594} r={30} color="#ffb24d" opacity={0.6} />
        <LighthouseTower geo={t} lit={1} body="#131a40" stripe="#1f2858" rim="#9aa6e0" />
        <Glow x={t.lx} y={t.ly} r={130} color="#ffc56a" opacity={0.9} hot="#fffbea" className="art-glowpulse" />
        <path d={g.rocksL} fill="#050818" />
        <path d={g.rocksR} fill="#050818" />
      </Plane>
    </>
  )
}
