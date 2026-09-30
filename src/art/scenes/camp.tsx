// Хижина Фонарщика: луг, домик с тёплым окном, забор, светлячки. Старт пути.
import { useMemo, type CSSProperties } from 'react'
import { bell, dotsPath, f, lerp, poly, smooth, smoothstep, useUid } from '../geom'
import {
  Fireflies,
  FogPlane,
  Glow,
  Moon,
  Plane,
  RidgeFill,
  Sky,
  Stars,
  VGrad,
  forestD,
  grassD,
  pineD,
  ridge,
} from '../landscape'
import { mulberry32, rangeRand } from '../rng'

const HZ = 560

function fenceD(x0: number, x1: number, yAt: (x: number) => number, step: number, h: number): string {
  let d = ''
  let rail1 = ''
  let rail2 = ''
  const r = mulberry32(Math.round(x0))
  for (let x = x0, i = 0; x <= x1; x += step, i++) {
    const y = yAt(x)
    const hh = h * rangeRand(r, 0.9, 1.08)
    const lean = rangeRand(r, -2, 2)
    d += poly([
      [x - 3, y + 4],
      [x - 3 + lean, y - hh],
      [x + lean, y - hh - 5],
      [x + 3 + lean, y - hh],
      [x + 3, y + 4],
    ])
    const c1: [number, number] = [x, y - hh * 0.7]
    const c2: [number, number] = [x, y - hh * 0.32]
    rail1 += (i ? 'L' : 'M') + f(c1[0]) + ' ' + f(c1[1])
    rail2 += (i ? 'L' : 'M') + f(c2[0]) + ' ' + f(c2[1])
  }
  return d + '|' + rail1 + '|' + rail2
}

export function CampScene() {
  const u = useUid()
  const g = useMemo(() => {
    const far = ridge({ seed: 201, base: 452, amp: 78, freq: 2.3, sharp: 0.55 })
    const hills = ridge({ seed: 202, base: 528, amp: 26, freq: 3.2 })
    const hillPines = forestD(203, hills.y, -20, 1620, { gap: [9, 30], h: [12, 30], sink: 3 })
    const meadow = ridge({
      seed: 204,
      base: (x) => 646 - 46 * bell(x, 800, 330),
      amp: 7,
      freq: 2.5,
      mod: (x, y) => lerp(y, 603, 1 - smoothstep(70, 150, Math.abs(x - 800))),
    })
    const front = ridge({ seed: 205, base: 826, amp: 16, freq: 2.2 })
    const grass = grassD(206, front.y, -20, 1620, 26, 8, 20)
    const r = mulberry32(207)
    const bigPine = pineD(r, 948, meadow.y(948) + 4, 212, 88)
    const pine2 = pineD(r, 1010, meadow.y(1010) + 6, 150, 60)
    const crown = dotsPath([
      [612, 530, 30],
      [636, 506, 36],
      [668, 498, 38],
      [696, 520, 32],
      [682, 546, 30],
      [646, 548, 32],
      [620, 552, 22],
      [700, 546, 20],
    ])
    const trunk = poly([
      [648, meadow.y(650) + 6],
      [652, 560],
      [646, 540],
      [656, 540],
      [660, 562],
      [662, meadow.y(660) + 6],
    ])
    const fenceL = fenceD(418, 700, (x) => 676 + (x - 560) * (x - 560) * -0.0002 + (700 - x) * 0.04, 34, 34)
    const fenceR = fenceD(904, 1230, (x) => 674 + (x - 1060) * (x - 1060) * -0.0002 + (x - 904) * 0.05, 34, 34)
    const pathD = smooth(
      [
        [796, 604],
        [788, 640],
        [772, 692],
        [744, 762],
        [700, 912, 0],
        [884, 912, 0],
        [852, 780],
        [834, 700],
        [820, 640],
        [811, 604],
      ],
      true,
    )
    return { far, hills, hillPines, meadow, front, grass, bigPine, pine2, crown, trunk, fenceL, fenceR, pathD }
  }, [])
  const [fl, fl1, fl2] = g.fenceL.split('|')
  const [fr, fr1, fr2] = g.fenceR.split('|')

  return (
    <>
      <Plane>
        <Sky
          stops={[
            [0, '#0a0f2e'],
            [0.42, '#181f52'],
            [0.78, '#2c2f6a'],
            [1, '#4b3f82'],
          ]}
          y1={HZ}
        />
        <Glow x={800} y={HZ - 20} r={950} ry={220} color="#76609f" opacity={0.5} />
        <Stars seed={21} count={140} yMax={440} twinkle={26} bright={4} />
        <Moon x={1012} y={128} r={25} />
        <RidgeFill geo={g.far} from="#343a7c" to="#4b4789" y2={HZ} rim="#9c98d8" rimOpacity={0.22} />
      </Plane>
      <FogPlane seed={22} y={515} h={60} color="#9d95cc" opacity={0.26} duration={52} />
      <Plane>
        <RidgeFill geo={g.hills} from="#262b64" to="#32326e" y2={600} />
        <path d={g.hillPines} fill="#232861" />
        <RidgeFill geo={g.meadow} from="#181d4b" to="#12163c" y1={600} y2={760} rim="#6e6cb4" rimOpacity={0.3} />
        {/* дерево слева */}
        <path d={g.trunk} fill="#0f1336" />
        <path d={g.crown} fill="#6f6cb8" opacity={0.3} transform="translate(-2 -2)" />
        <path d={g.crown} fill="#11153b" />
        {/* тропинка к двери */}
        <defs>
          <VGrad
            id={`${u}path`}
            y1={604}
            y2={912}
            stops={[
              [0, '#35305f'],
              [0.35, '#1f2250'],
              [1, '#12153b'],
            ]}
          />
        </defs>
        <path d={g.pathD} fill={`url(#${u}path)`} opacity={0.75} />
        <House />
        <path d={g.pine2} fill="#0f1337" />
        <path d={g.bigPine} fill="#0c1031" />
        <path d={g.bigPine} fill="none" stroke="#ffcf80" strokeWidth={1.2} opacity={0.18} transform="translate(-2 0)" />
      </Plane>
      <FogPlane seed={23} y={700} h={70} color="#7b77b2" opacity={0.14} duration={40} delay={9} reverse />
      <Plane>
        {/* забор */}
        <g fill="#0b0f2e">
          <path d={fl} />
          <path d={fr} />
        </g>
        <g fill="none" stroke="#0b0f2e" strokeWidth={4} strokeLinejoin="round">
          <path d={fl1} />
          <path d={fl2} />
          <path d={fr1} />
          <path d={fr2} />
        </g>
        <g fill="none" stroke="#ffcf80" strokeWidth={1} opacity={0.22}>
          <path d={fl1} transform="translate(0 -2)" />
          <path d={fr1} transform="translate(0 -2)" />
        </g>
        <defs>
          <VGrad
            id={`${u}front`}
            y1={790}
            y2={900}
            stops={[
              [0, '#0d1133'],
              [1, '#070a22'],
            ]}
          />
        </defs>
        <path d={g.front.d} fill={`url(#${u}front)`} />
        <path d={g.grass} fill="#0d1133" />
        <Fireflies seed={24} count={16} x0={380} x1={1240} y0={590} y1={800} color="#ffd68a" />
      </Plane>
    </>
  )
}

function House() {
  const smoke = [0, 1, 2, 3, 4].map((i) => ({
    dl: -i * 2.4,
    sx: 50 + i * 9,
    sy: -200 - i * 12,
  }))
  const u = useUid()
  return (
    <g>
      <defs>
        <radialGradient id={`${u}sm`}>
          <stop offset="0" stopColor="#a6a2cf" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#8e8bb8" stopOpacity="0.4" />
          <stop offset="1" stopColor="#8e8bb8" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* свечение окон на траве и на стенах */}
      <Glow x={800} y={590} r={260} ry={150} color="#ffab4a" opacity={0.28} />
      <Glow x={790} y={640} r={180} ry={30} color="#ffb85c" opacity={0.35} />
      {/* дымоход и дым */}
      <rect x={842} y={466} width={20} height={52} fill="#0e1234" />
      <rect x={838} y={462} width={28} height={7} fill="#0e1234" />
      {smoke.map((s, i) => (
        <g key={i} transform="translate(852 452)" opacity={0.34}>
          <ellipse
            className="art-a art-smoke"
            rx={22}
            ry={15}
            fill={`url(#${u}sm)`}
            style={
              {
                animationDelay: `${s.dl}s`,
                '--sx': `${s.sx}px`,
                '--sy': `${s.sy}px`,
              } as CSSProperties
            }
          />
        </g>
      ))}
      {/* стены */}
      <rect x={722} y={528} width={158} height={76} fill="#10143a" />
      <path d="M722 528h158v8H722z" fill="#0b0f2e" />
      {/* крыша */}
      <path d="M706 536L801 466L896 536L889 541L801 477L713 541Z" fill="#0c1031" />
      <path d="M716 532L801 470L886 532L801 482Z" fill="#0f1336" />
      <path d="M706 536L801 466" stroke="#9a96dc" strokeWidth={1.4} opacity={0.45} />
      <path d="M801 466L896 536" stroke="#ffcf80" strokeWidth={1.2} opacity={0.3} />
      {/* окно слева */}
      <Glow x={758} y={562} r={70} color="#ffb24d" opacity={0.6} hot="#ffe3a8" />
      <rect x={742} y={547} width={32} height={30} rx={2} fill="#ffc673" />
      <g opacity={0.5}>
        <rect x={742} y={547} width={32} height={30} rx={2} fill="#ffe7b0" className="art-flicker" />
      </g>
      <path d="M758 547v30M742 562h32" stroke="#10143a" strokeWidth={3} />
      <rect x={739} y={576} width={38} height={4} fill="#0b0f2e" />
      {/* дверь приоткрыта */}
      <path d="M790 604V566Q803 552 816 566V604Z" fill="#0a0d28" />
      <path d="M806 604V560Q811 562 816 566V604Z" fill="#ffc673" opacity={0.85} />
      <g opacity={0.4}>
        <path d="M806 604V560Q811 562 816 566V604Z" fill="#ffe7b0" className="art-flicker" style={{ animationDelay: '-1.2s' }} />
      </g>
      {/* окно справа */}
      <Glow x={850} y={562} r={60} color="#ffb24d" opacity={0.5} />
      <rect x={836} y={549} width={28} height={26} rx={2} fill="#ffbf66" />
      <path d="M850 549v26M836 562h28" stroke="#10143a" strokeWidth={3} />
      {/* фонарь у двери */}
      <path d="M826 548v8" stroke="#0b0f2e" strokeWidth={1.4} />
      <Glow x={826} y={560} r={26} color="#ffc56a" opacity={0.9} className="art-flicker" style={{ animationDelay: '-0.6s' }} />
      <rect x={823} y={556} width={6} height={8} rx={1.5} fill="#ffe1a0" />
      {/* ступенька */}
      <rect x={784} y={602} width={38} height={5} fill="#0b0f2e" />
    </g>
  )
}
