// Лес Смыслов: многослойный сине-зелёный ельник, светящиеся грибы, туман между стволами, тропинка.
import { useMemo } from 'react'
import { f, poly, smooth, useUid, type Pt } from '../geom'
import {
  Aurora,
  Fireflies,
  FogPlane,
  Glow,
  GlowGrad,
  Plane,
  RidgeFill,
  Sky,
  Stars,
  VGrad,
  forestD,
  pineD,
  ridge,
} from '../landscape'
import { mulberry32, rangeRand } from '../rng'

const HZ = 520

interface Shroom {
  x: number
  y: number
  s: number
}

const SHROOMS: Shroom[] = [
  { x: 706, y: 706, s: 1 },
  { x: 926, y: 690, s: 0.9 },
  { x: 640, y: 812, s: 1.3 },
  { x: 1000, y: 826, s: 1.2 },
  { x: 770, y: 626, s: 0.6 },
  { x: 868, y: 640, s: 0.65 },
  { x: 470, y: 700, s: 0.9 },
  { x: 1150, y: 712, s: 0.9 },
]

function shroomD(r: () => number, x: number, y: number, s: number): { stems: string; caps: string } {
  let stems = ''
  let caps = ''
  const n = 3 + Math.floor(r() * 3)
  for (let i = 0; i < n; i++) {
    const sx = x + rangeRand(r, -16, 16) * s
    const h = rangeRand(r, 6, 17) * s
    const w = rangeRand(r, 1.4, 2.6) * s
    const cw = rangeRand(r, 5, 11) * s
    const lean = rangeRand(r, -2, 2) * s
    stems += poly([
      [sx - w, y],
      [sx - w * 0.7 + lean, y - h],
      [sx + w * 0.7 + lean, y - h],
      [sx + w, y],
    ])
    caps += `M${f(sx + lean - cw)} ${f(y - h + 1)}Q${f(sx + lean - cw * 0.9)} ${f(y - h - cw * 0.9)} ${f(sx + lean)} ${f(y - h - cw * 0.85)}Q${f(sx + lean + cw * 0.9)} ${f(y - h - cw * 0.9)} ${f(sx + lean + cw)} ${f(y - h + 1)}Z`
  }
  return { stems, caps }
}

export function ForestScene() {
  const u = useUid()
  const g = useMemo(() => {
    const l1 = ridge({ seed: 401, base: 468, amp: 20, freq: 3 })
    const l1t = forestD(402, l1.y, -30, 1630, { gap: [10, 20], h: [36, 66], sink: 6 })
    const l2 = ridge({ seed: 403, base: 540, amp: 16, freq: 3 })
    const l2t = forestD(404, l2.y, -30, 1630, { gap: [16, 34], h: [72, 128], sink: 8 })
    const l3 = ridge({ seed: 405, base: 612, amp: 12, freq: 2.5 })
    const l3t = forestD(406, l3.y, -60, 1660, {
      gap: [44, 86],
      h: [170, 270],
      sink: 10,
      skip: (x) => x > 690 && x < 910,
    })
    const r = mulberry32(407)
    // ближние стволы-рамка: сужаются кверху, у земли — корни, пара обломанных сучьев
    const trunks: string[] = []
    for (const [x, w, lean] of [
      [104, 64, -18],
      [282, 32, 10],
      [1318, 36, -12],
      [1500, 70, 16],
    ] as const) {
      const top = -40
      const yb = 920
      const L: Pt[] = [
        [x - w * 0.95, yb, 0],
        [x - w * 0.52, yb - 40],
        [x - w * 0.46 + lean * 0.3, 600],
        [x - w * 0.36 + lean * 0.7, 250],
        [x - w * 0.3 + lean, top, 0],
      ]
      const R: Pt[] = [
        [x + w * 0.3 + lean, top, 0],
        [x + w * 0.36 + lean * 0.7, 250],
        [x + w * 0.46 + lean * 0.3, 600],
        [x + w * 0.52, yb - 40],
        [x + w * 0.95, yb, 0],
      ]
      trunks.push(smooth([...L, ...R], true))
      for (let k = 0; k < 2; k++) {
        const by = rangeRand(r, 180, 560)
        const dir = k === 0 ? -1 : 1
        const t = (by - top) / (yb - top)
        const bx = x + lean * (1 - t) + dir * w * (0.3 + 0.16 * t)
        const len = rangeRand(r, 26, 48) * (w / 40)
        trunks.push(
          poly([
            [bx, by - 5],
            [bx + dir * len, by - len * 0.55],
            [bx + dir * len * 0.92, by - len * 0.42],
            [bx, by + 5],
          ]),
        )
      }
    }
    const nearPines = [pineD(r, 440, 930, 520, 220), pineD(r, 1180, 940, 480, 200)].join('')
    const pathD = smooth(
      [
        [809, 590],
        [801, 620],
        [783, 662],
        [752, 722],
        [716, 802],
        [680, 912, 0],
        [944, 912, 0],
        [902, 810],
        [874, 732],
        [846, 668],
        [826, 622],
        [816, 590],
      ],
      true,
    )
    const sh = SHROOMS.map((s) => shroomD(r, s.x, s.y, s.s))
    const shafts: Pt[][] = [
      [
        [300, -20],
        [390, -20],
        [900, 920],
        [760, 920],
      ],
      [
        [520, -20],
        [580, -20],
        [1080, 920],
        [990, 920],
      ],
      [
        [140, -20],
        [190, -20],
        [560, 920],
        [470, 920],
      ],
    ]
    return { l1, l1t, l2, l2t, l3, l3t, trunks: trunks.join(''), nearPines, pathD, sh, shafts: shafts.map((p) => poly(p)) }
  }, [])

  return (
    <>
      <Plane>
        <Sky
          stops={[
            [0, '#051019'],
            [0.4, '#0a1e2b'],
            [0.75, '#113240'],
            [1, '#1d4b50'],
          ]}
          y1={HZ}
        />
        <Aurora seed={41} y={250} h={150} x0={260} x1={1340} color="#6fe3c8" color2="#3f7fb0" opacity={0.36} bands={3} />
        <Stars seed={42} count={90} yMax={400} twinkle={18} bright={3} color="#eafff8" />
        <Glow x={800} y={HZ} r={900} ry={180} color="#3f8f88" opacity={0.35} />
        <RidgeFill geo={g.l1} from="#28525f" to="#346570" y2={HZ + 20} />
        <path d={g.l1t} fill="#28525f" />
      </Plane>
      <FogPlane seed={43} y={506} h={62} color="#7fb4b0" opacity={0.28} duration={50} />
      <Plane>
        <RidgeFill geo={g.l2} from="#1a3e4b" to="#22505a" y2={600} />
        <path d={g.l2t} fill="#1a3e4b" />
      </Plane>
      <FogPlane seed={44} y={580} h={70} color="#6c9ea0" opacity={0.3} duration={42} delay={10} reverse />
      <Plane>
        <RidgeFill geo={g.l3} from="#0f2d38" to="#0b232c" y1={600} y2={900} />
        <path d={g.l3t} fill="#0f2d38" />
        <defs>
          <VGrad
            id={`${u}path`}
            y1={588}
            y2={912}
            stops={[
              [0, '#2a5c5e'],
              [0.4, '#163c44'],
              [1, '#0b242c'],
            ]}
          />
          <VGrad
            id={`${u}shaft`}
            y1={0}
            y2={900}
            stops={[
              [0, '#bff3ea', 0.16],
              [0.6, '#9fe3da', 0.05],
              [1, '#9fe3da', 0],
            ]}
          />
        </defs>
        <path d={g.pathD} fill={`url(#${u}path)`} />
        {g.shafts.map((d, i) => (
          <path key={i} d={d} fill={`url(#${u}shaft)`} opacity={[1, 0.7, 0.55][i]} />
        ))}
      </Plane>
      <FogPlane seed={45} y={690} h={90} color="#6c9ea0" opacity={0.16} duration={36} delay={4} />
      <Plane>
        <GlowGrad id={`${u}sg`} color="#5fe8c6" />
        {SHROOMS.map((s, i) => (
          <Glow key={i} x={s.x} y={s.y - 8 * s.s} r={70 * s.s} ry={44 * s.s} color="#5fe8c6" opacity={0.55} gid={`${u}sg`} className="art-glowpulse" style={{ animationDelay: `${-i * 0.8}s` }} />
        ))}
        {g.sh.map((s, i) => (
          <g key={i}>
            <path d={s.stems} fill="#bdf5e6" opacity={0.75} />
            <path d={s.caps} fill="#7ff0d4" />
          </g>
        ))}
        <path d={g.nearPines} fill="#061419" />
        <path d={g.trunks} fill="#050f14" />
        <path d={g.trunks} fill="none" stroke="#6fe3c8" strokeWidth={1.2} opacity={0.12} transform="translate(1.5 0)" />
        <Fireflies seed={46} count={16} x0={380} x1={1220} y0={420} y1={820} color="#8ff5da" size={0.9} />
      </Plane>
    </>
  )
}
