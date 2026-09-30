// Долина Сомнений: лилово-серая долина, туман, голые деревья, неподвижное озеро, зеркало на камне.
import { useMemo } from 'react'
import { interp, smooth, useUid, type Pt } from '../geom'
import {
  Fireflies,
  FogPlane,
  Glow,
  Moon,
  Plane,
  RidgeFill,
  Sky,
  Stars,
  Swells,
  VGrad,
  bareTreeD,
  grassD,
  ridge,
  rockD,
} from '../landscape'
import { mulberry32 } from '../rng'

const HZ = 560

export function DoubtScene() {
  const u = useUid()
  const g = useMemo(() => {
    const far = ridge({ seed: 301, base: 470, amp: 62, freq: 2.1, sharp: 0.3 })
    const mid = ridge({ seed: 302, base: 522, amp: 34, freq: 2.8, sharp: 0.15 })
    const shorePts: Pt[] = [
      [-20, 512],
      [110, 532],
      [220, 574],
      [350, 628],
      [540, 676],
      [800, 698],
      [1040, 686],
      [1240, 640],
      [1370, 590],
      [1490, 546],
      [1620, 522],
    ]
    const shoreY = interp(shorePts)
    const ground = smooth([...shorePts, [1620, 912, 0], [-20, 912, 0]], true)
    const shoreTop = smooth(shorePts, false)
    const trees = [
      bareTreeD(311, 372, shoreY(372), 250, { lean: -0.06, spread: 0.6 }),
      bareTreeD(312, 236, shoreY(236), 175, { lean: 0.1, spread: 0.7 }),
      bareTreeD(313, 1238, shoreY(1238), 270, { lean: 0.08, spread: 0.58 }),
      bareTreeD(314, 1396, shoreY(1396), 170, { lean: -0.12, spread: 0.7 }),
    ].join('')
    const farTrees = [
      bareTreeD(315, 640, HZ + 2, 70, { depth: 4, spread: 0.7 }),
      bareTreeD(316, 1012, HZ + 2, 52, { depth: 4, spread: 0.7 }),
    ].join('')
    const bigTree = bareTreeD(317, 62, 912, 700, { lean: 0.1, spread: 0.55, depth: 5 })
    const r = mulberry32(318)
    const stones = [rockD(r, 520, 700, 60, 22), rockD(r, 1110, 690, 48, 18), rockD(r, 1300, 750, 90, 30)].join('')
    const reeds =
      grassD(319, () => 684, 530, 620, 9, 18, 44) + grassD(320, () => 676, 1050, 1150, 9, 16, 40)
    return { far, mid, ground, shoreTop, trees, farTrees, bigTree, stones, reeds }
  }, [])

  return (
    <>
      <Plane>
        <Sky
          stops={[
            [0, '#13142c'],
            [0.45, '#23233f'],
            [0.8, '#3a3757'],
            [1, '#5c5676'],
          ]}
          y1={HZ}
        />
        <Glow x={800} y={HZ} r={950} ry={200} color="#8a84a8" opacity={0.4} />
        <Stars seed={31} count={70} yMax={400} twinkle={14} bright={2} color="#e9e4f5" opacity={0.75} />
        <Moon x={688} y={190} r={24} color="#ddd6ec" halo={1.2} />
      </Plane>
      <FogPlane seed={32} y={210} h={90} color="#8f89ad" opacity={0.18} duration={60} />
      <Plane>
        <RidgeFill geo={g.far} from="#57536f" to="#6b6585" y2={HZ} />
        <RidgeFill geo={g.mid} from="#46425e" to="#58536f" y2={HZ} />
        {/* озеро с отражением */}
        <defs>
          <VGrad
            id={`${u}lake`}
            y1={HZ}
            y2={710}
            stops={[
              [0, '#645e7e'],
              [0.5, '#48445f'],
              [1, '#34314a'],
            ]}
          />
          <clipPath id={`${u}lc`}>
            <rect x={-20} y={HZ} width={1640} height={200} />
          </clipPath>
        </defs>
        <rect x={-20} y={HZ} width={1640} height={200} fill={`url(#${u}lake)`} />
        <g clipPath={`url(#${u}lc)`} opacity={0.42} transform={`matrix(1 0 0 -1 0 ${HZ * 2})`}>
          <path d={g.mid.d} fill="#3f3b56" />
          <path d={g.farTrees} fill="#3f3b56" />
        </g>
        <Glow x={688} y={640} r={60} ry={18} color="#ddd6ec" opacity={0.25} />
        <Swells seed={33} y0={HZ + 3} y1={700} color="#a19bc0" opacity={0.14} count={12} />
        <path d={g.farTrees} fill="#4a4663" />
      </Plane>
      <FogPlane seed={34} y={574} h={56} color="#a7a1c4" opacity={0.3} duration={48} delay={6} reverse />
      <Plane>
        <defs>
          <VGrad
            id={`${u}g`}
            y1={520}
            y2={900}
            stops={[
              [0, '#2b2842'],
              [1, '#141326'],
            ]}
          />
        </defs>
        <path d={g.ground} fill={`url(#${u}g)`} />
        <path d={g.shoreTop} fill="none" stroke="#a9a3cc" strokeWidth={1.2} opacity={0.25} />
        <path d={g.reeds} fill="#231f36" />
        <path d={g.trees} fill="#1d1b30" />
        <path d={g.stones} fill="#1f1c33" />
        <Mirror />
      </Plane>
      <FogPlane seed={35} y={742} h={90} color="#8a84a8" opacity={0.16} duration={42} delay={14} />
      <Plane>
        <path d={g.bigTree} fill="#0e0d1c" />
        <Fireflies seed={36} count={9} x0={420} x1={1200} y0={520} y1={760} color="#cfc9ea" size={0.8} />
      </Plane>
    </>
  )
}

/** Одинокое зеркало в раме на камне — главный объект долины. */
function Mirror() {
  const u = useUid()
  const cx = 842
  const cy = 598
  return (
    <g>
      <Glow x={cx} y={cy} r={170} color="#b3aee0" opacity={0.42} />
      {/* камень */}
      <path
        d={`M${cx - 88} 720C${cx - 84} 690 ${cx - 50} 664 ${cx - 6} 660C${cx + 44} 657 ${cx + 84} 680 ${cx + 92} 720Z`}
        fill="#211e35"
      />
      <path
        d={`M${cx - 84} 704C${cx - 76} 684 ${cx - 46} 666 ${cx - 6} 663`}
        fill="none"
        stroke="#b9b3de"
        strokeWidth={1.4}
        opacity={0.4}
      />
      {/* ножка */}
      <path d={`M${cx - 16} 664L${cx - 8} 648H${cx + 8}L${cx + 16} 664Z`} fill="#151327" />
      <defs>
        <linearGradient id={`${u}m`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#d9d5f0" />
          <stop offset="0.45" stopColor="#8f89b4" />
          <stop offset="1" stopColor="#4f4a70" />
        </linearGradient>
        <linearGradient id={`${u}f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6e6892" />
          <stop offset="0.5" stopColor="#1e1b33" />
          <stop offset="1" stopColor="#141226" />
        </linearGradient>
      </defs>
      {/* рама */}
      <ellipse cx={cx} cy={cy} rx={42} ry={58} fill={`url(#${u}f)`} />
      <ellipse cx={cx} cy={cy} rx={42} ry={58} fill="none" stroke="#c9c3ea" strokeWidth={1} opacity={0.45} />
      <path
        d={`M${cx - 10} ${cy - 58}Q${cx} ${cy - 76} ${cx + 10} ${cy - 58}M${cx - 6} ${cy + 57}Q${cx} ${cy + 66} ${cx + 6} ${cy + 57}`}
        fill="#1e1b33"
        stroke="#c9c3ea"
        strokeWidth={0.8}
        strokeOpacity={0.4}
      />
      <circle cx={cx} cy={cy - 70} r={3.4} fill="#1e1b33" />
      {/* стекло */}
      <ellipse cx={cx} cy={cy} rx={33} ry={48} fill={`url(#${u}m)`} />
      <path
        d={`M${cx - 20} ${cy - 30}Q${cx - 6} ${cy - 44} ${cx + 12} ${cy - 40}L${cx - 22} ${cy + 6}Q${cx - 28} ${cy - 12} ${cx - 20} ${cy - 30}Z`}
        fill="#ffffff"
        opacity={0.28}
      />
      {/* в отражении — тёплая точка, которой нет в долине */}
      <Glow x={cx + 6} y={cy + 10} r={16} color="#ffc977" opacity={0.85} className="art-flicker" />
      <circle cx={cx + 6} cy={cy + 10} r={2.2} fill="#fff0cc" />
    </g>
  )
}
