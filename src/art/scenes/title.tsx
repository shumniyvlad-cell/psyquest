// Титул: ночное море, далёкий маяк на мысе, скала справа внизу — место для героя.
import { useMemo } from 'react'
import { lerp, smooth, smoothstep, useUid, type Pt } from '../geom'
import { LighthouseBeam, LighthouseTower, towerGeo } from '../lighthouse-parts'
import { FogPlane, Glow, LightPath, Moon, Plane, RidgeFill, Sky, Stars, Swells, VGrad, ridge } from '../landscape'
import { mulberry32 } from '../rng'

const HZ = 520

export function TitleScene() {
  const u = useUid()
  const g = useMemo(() => {
    const coast = ridge({
      seed: 101,
      base: (x) => lerp(498, 530, smoothstep(360, 620, x)),
      amp: 12,
      freq: 5,
      x0: -20,
      x1: 640,
      bottom: HZ + 6,
    })
    const coast2 = ridge({
      seed: 104,
      base: (x) => lerp(486, 540, smoothstep(200, 470, x)),
      amp: 18,
      freq: 3,
      sharp: 0.4,
      x0: -20,
      x1: 480,
      bottom: HZ + 6,
    })
    const cape = ridge({
      seed: 102,
      base: (x) => (x < 884 ? lerp(532, 474, smoothstep(846, 884, x)) : lerp(474, 402, smoothstep(950, 1620, x))),
      amp: 14,
      freq: 3.4,
      sharp: 0.35,
      x0: 840,
      x1: 1640,
      bottom: HZ + 6,
      mod: (x, y) => {
        const k = 1 - smoothstep(10, 34, Math.abs(x - 912))
        return lerp(y, 471, k)
      },
    })
    const tower = towerGeo(912, cape.y(912) + 2, 96)
    const r = mulberry32(107)
    const rockPts: Pt[] = [
      [826, 912, 0],
      [846, 856],
      [872, 808],
      [906, 772],
      [948, 750],
      [1004, 740],
      [1070, 737],
      [1136, 739],
      [1190, 731],
      [1262, 712],
      [1350, 690],
      [1450, 664],
      [1540, 648],
      [1640, 632],
      [1640, 912, 0],
    ]
    for (let i = 2; i < rockPts.length - 2; i++) rockPts[i] = [rockPts[i][0], rockPts[i][1] + (r() - 0.5) * 6, 0.55]
    const rock = smooth(rockPts, true)
    const rockTop = smooth(rockPts.slice(1, -1), false)
    const cracks =
      'M952 770l18 34l-6 30M1058 752l-10 40l14 36M1212 742l22 30l-4 44M1380 700l-16 38l10 52M1500 668l12 44'
    const leftRockPts: Pt[] = [
      [-30, 912, 0],
      [-30, 806],
      [52, 796],
      [140, 802],
      [230, 822],
      [318, 852],
      [372, 880],
      [400, 912, 0],
    ]
    const leftRock = smooth(leftRockPts, true)
    const leftTop = smooth(leftRockPts.slice(1, -1), false)
    return { coast, coast2, cape, tower, rock, rockTop, cracks, leftRock, leftTop }
  }, [])

  return (
    <>
      <Plane>
        <Sky
          stops={[
            [0, '#090d2a'],
            [0.36, '#141a48'],
            [0.72, '#27285f'],
            [1, '#4a3d7e'],
          ]}
          y1={HZ}
        />
        <Glow x={800} y={HZ} r={1000} ry={210} color="#7a62a8" opacity={0.55} />
        <Stars seed={11} count={150} yMax={470} twinkle={26} bright={5} />
        <Moon x={652} y={172} r={30} />
        <RidgeFill geo={g.coast2} from="#353a78" to="#4a4486" y2={HZ} />
        <RidgeFill geo={g.coast} from="#2a2f68" to="#3c3a7a" y2={HZ} />
        {[
          [214, 505],
          [258, 508],
          [405, 514],
          [452, 516],
        ].map(([x, y], i) => (
          <g key={i}>
            <Glow x={x} y={y} r={7} color="#ffc76a" opacity={0.8} />
            <circle cx={x} cy={y} r={1} fill="#ffe2a8" className="art-flicker" style={{ animationDelay: `${-i * 0.7}s` }} />
          </g>
        ))}
        <RidgeFill geo={g.cape} from="#1d2154" to="#2d2c68" y1={g.cape.minY} y2={HZ} rim="#8a86c8" rimOpacity={0.3} />
        <Glow x={1188} y={438} r={8} color="#ffc76a" opacity={0.7} />
        <circle cx={1188} cy={438} r={1.1} fill="#ffe2a8" />
        <LighthouseTower geo={g.tower} lit={1} body="#141942" stripe="#20275a" />
        <Glow x={g.tower.lx} y={g.tower.ly} r={90} color="#ffc56a" opacity={0.75} hot="#fff6da" />
        {/* море */}
        <defs>
          <VGrad
            id={`${u}sea`}
            y1={HZ}
            y2={900}
            stops={[
              [0, '#2e2c68'],
              [0.28, '#171b4a'],
              [1, '#080b24'],
            ]}
          />
        </defs>
        <rect x={-400} y={HZ} width={2400} height={420} fill={`url(#${u}sea)`} />
        <Glow x={800} y={HZ + 4} r={900} ry={40} color="#8e7ec0" opacity={0.35} />
        <Swells seed={12} y0={HZ + 4} y1={900} color="#8c89c8" opacity={0.13} count={24} />
        <LightPath seed={13} x={652} y0={HZ + 3} y1={830} color="#f3ead2" width={96} spread={0.1} count={34} opacity={0.62} />
        <LightPath seed={14} x={912} y0={HZ + 3} y1={700} color="#ffcf7a" width={36} spread={0.07} count={18} opacity={0.5} shimmer={4} />
      </Plane>
      <FogPlane seed={15} y={HZ - 8} h={56} color="#a39bd0" opacity={0.3} duration={50} />
      <FogPlane seed={16} y={HZ + 44} h={80} color="#7f7ab4" opacity={0.2} duration={38} delay={12} reverse />
      <Plane fx>
        <LighthouseBeam x={g.tower.lx} y={g.tower.ly} len={980} spread={120} color="#ffe0a0" opacity={0.75} period={10} flare={0.8} />
      </Plane>
      <Plane>
        <defs>
          <VGrad
            id={`${u}rock`}
            y1={640}
            y2={900}
            stops={[
              [0, '#11163a'],
              [1, '#05071a'],
            ]}
          />
        </defs>
        <path d={g.leftRock} fill={`url(#${u}rock)`} />
        <path d={g.leftTop} fill="none" stroke="#6f6db8" strokeWidth={1.6} opacity={0.35} />
        <path d={g.rock} fill={`url(#${u}rock)`} />
        <path d={g.cracks} fill="none" stroke="#2a2f66" strokeWidth={1.6} opacity={0.6} strokeLinecap="round" />
        <path d={g.rockTop} fill="none" stroke="#8a88d0" strokeWidth={2} opacity={0.45} />
        <path d={g.rockTop} fill="none" stroke="#c9c4ff" strokeWidth={0.8} opacity={0.35} transform="translate(0 -0.6)" />
        {/* лёгкие брызги у подножия скалы */}
        <Glow x={872} y={900} r={160} ry={40} color="#6c6ab0" opacity={0.25} />
      </Plane>
    </>
  )
}
