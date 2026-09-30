// Кузница Продукта: скалы, кузница с трубой и дымом, зарево двери и горна, искры, наковальня.
import { useMemo, type CSSProperties } from 'react'
import { lerp, smooth, smoothstep, useUid } from '../geom'
import { FogPlane, Glow, Plane, RidgeFill, Sky, Stars, VGrad, ridge } from '../landscape'
import { mulberry32, rangeRand } from '../rng'

const HZ = 560

export function ForgeScene() {
  const u = useUid()
  const g = useMemo(() => {
    const l1 = ridge({ seed: 501, base: 432, amp: 112, freq: 2.2, sharp: 0.82, rough: 0.22 })
    const l2 = ridge({ seed: 502, base: 516, amp: 54, freq: 3.4, sharp: 0.72, rough: 0.3 })
    const ground = ridge({
      seed: 503,
      base: (x) => lerp(622, 506, Math.max(smoothstep(470, 180, x), smoothstep(1130, 1420, x))),
      amp: 22,
      freq: 3,
      sharp: 0.6,
      rough: 0.18,
      mod: (x, y) => lerp(y, 624, 1 - smoothstep(170, 300, Math.abs(x - 800))),
    })
    const r = mulberry32(504)
    const sparks = Array.from({ length: 24 }, (_, i) => {
      const fromDoor = i % 3 === 0
      return {
        x: fromDoor ? rangeRand(r, 770, 830) : rangeRand(r, 894, 912),
        y: fromDoor ? rangeRand(r, 560, 600) : 330,
        sx: rangeRand(r, -60, 90),
        sy: -rangeRand(r, 140, 300),
        d: rangeRand(r, 2.2, 4.4),
        dl: -rangeRand(r, 0, 5),
        s: rangeRand(r, 1, 2.3),
      }
    })
    const smoke = Array.from({ length: 6 }, (_, i) => ({
      dl: -i * 2,
      sx: rangeRand(r, 40, 120),
      sy: -rangeRand(r, 200, 280),
      rx: rangeRand(r, 22, 34),
    }))
    const rocksL = smooth(
      [
        [-30, 912, 0],
        [-30, 760],
        [60, 740],
        [150, 768],
        [240, 812],
        [330, 870],
        [380, 912, 0],
      ],
      true,
    )
    const rocksR = smooth(
      [
        [1240, 912, 0],
        [1300, 850],
        [1400, 800],
        [1500, 770],
        [1630, 756],
        [1630, 912, 0],
      ],
      true,
    )
    return { l1, l2, ground, sparks, smoke, rocksL, rocksR }
  }, [])

  return (
    <>
      <Plane>
        <Sky
          stops={[
            [0, '#0e0a21'],
            [0.42, '#1b1333'],
            [0.78, '#2f1d3d'],
            [1, '#522538'],
          ]}
          y1={HZ}
        />
        <Glow x={800} y={HZ} r={950} ry={230} color="#b24c3c" opacity={0.36} />
        <Stars seed={51} count={100} yMax={420} twinkle={18} bright={3} color="#fff1e0" />
        <RidgeFill geo={g.l1} from="#392a4b" to="#4d2f4d" y2={HZ} rim="#ff9a6a" rimOpacity={0.12} />
      </Plane>
      <FogPlane seed={52} y={530} h={64} color="#b8787c" opacity={0.18} duration={46} />
      <Plane>
        <RidgeFill geo={g.l2} from="#281c39" to="#3a2442" y2={HZ + 30} rim="#ff9a6a" rimOpacity={0.16} />
        <Glow x={800} y={590} r={420} ry={280} color="#ff7a2a" opacity={0.42} />
        <RidgeFill geo={g.ground} from="#1a1229" to="#120c20" y1={600} y2={900} rim="#ffae6a" rimOpacity={0.2} />
        <Forge sparks={g.sparks} smoke={g.smoke} uid={u} />
      </Plane>
      <Plane>
        <path d={g.rocksL} fill="#0a0716" />
        <path d={g.rocksR} fill="#0a0716" />
        <Anvil />
      </Plane>
    </>
  )
}

interface Spark {
  x: number
  y: number
  sx: number
  sy: number
  d: number
  dl: number
  s: number
}

function Forge({
  sparks,
  smoke,
  uid,
}: {
  sparks: Spark[]
  smoke: { dl: number; sx: number; sy: number; rx: number }[]
  uid: string
}) {
  return (
    <g>
      <defs>
        <VGrad
          id={`${uid}spill`}
          y1={622}
          y2={800}
          stops={[
            [0, '#ffb35a', 0.5],
            [0.5, '#ff8a3a', 0.14],
            [1, '#ff8a3a', 0],
          ]}
        />
        <radialGradient id={`${uid}door`} cx="0.5" cy="0.8" r="0.8">
          <stop offset="0" stopColor="#fff2c4" />
          <stop offset="0.35" stopColor="#ffc15a" />
          <stop offset="0.8" stopColor="#f07a28" />
          <stop offset="1" stopColor="#a8401e" />
        </radialGradient>
      </defs>
      <radialGradient id={`${uid}sm`}>
        <stop offset="0" stopColor="#8a7090" stopOpacity="0.9" />
        <stop offset="0.55" stopColor="#6e5a74" stopOpacity="0.45" />
        <stop offset="1" stopColor="#6e5a74" stopOpacity="0" />
      </radialGradient>
      {/* дым из трубы */}
      {smoke.map((s, i) => (
        <g key={i} transform="translate(903 318)" opacity={0.5}>
          <ellipse
            className="art-a art-smoke"
            rx={s.rx * 1.3}
            ry={s.rx}
            fill={`url(#${uid}sm)`}
            style={
              {
                animationDelay: `${s.dl}s`,
                animationDuration: '12s',
                '--sx': `${s.sx.toFixed(0)}px`,
                '--sy': `${s.sy.toFixed(0)}px`,
              } as CSSProperties
            }
          />
        </g>
      ))}
      {/* труба */}
      <path d="M884 522V336H922V522Z" fill="#150e22" />
      <path d="M878 338H928V324H878Z" fill="#110b1d" />
      <path d="M884 520V338" stroke="#ff9a5a" strokeWidth={1.3} opacity={0.3} />
      <Glow x={903} y={322} r={40} ry={24} color="#ff8a3a" opacity={0.55} />
      {/* дом кузницы */}
      <path d="M688 624V512H930V624Z" fill="#170f25" />
      <path d="M670 518L760 452H858L948 518L940 524H678Z" fill="#110b1c" />
      <path d="M670 518L760 452H858" fill="none" stroke="#b49ad0" strokeWidth={1.3} opacity={0.3} />
      <path d="M858 452L948 518" stroke="#ff9a5a" strokeWidth={1.2} opacity={0.35} />
      {/* каменная кладка */}
      <path
        d="M688 548H752M842 548H930M688 584H742M850 584H930M716 512V548M902 512V548M704 548V584M914 548V584M722 584V624M896 584V624"
        stroke="#2a1d38"
        strokeWidth={1.4}
        opacity={0.9}
      />
      {/* дверь-горн */}
      <Glow x={796} y={590} r={200} ry={150} color="#ff9a3c" opacity={0.6} hot="#ffd98a" />
      <path d="M756 624V566Q796 516 836 566V624Z" fill={`url(#${uid}door)`} />
      <g opacity={0.3}>
        <path d="M756 624V566Q796 516 836 566V624Z" fill="#fff3cf" className="art-flicker" />
      </g>
      {/* наковальня внутри — силуэт */}
      <path d="M774 624V610H786L780 600H814L808 610H820V624Z" fill="#3a1c14" opacity={0.75} />
      <path d="M760 624L740 800H852L832 624Z" fill={`url(#${uid}spill)`} />
      <path d="M752 626H840" stroke="#1a1026" strokeWidth={4} />
      {/* окошко */}
      <Glow x={880} y={560} r={48} color="#ff9a3c" opacity={0.55} />
      <rect x={866} y={548} width={28} height={24} rx={3} fill="#ffb454" />
      <path d="M880 548V572M866 560H894" stroke="#170f25" strokeWidth={3} />
      {/* бочка и поленница слева */}
      <path d="M704 624V588Q716 582 728 588V624Z" fill="#120b1e" />
      <path d="M640 624V604H690V624Z" fill="#110a1c" />
      <path d="M646 604A6 6 0 1 1 658 604M662 604A6 6 0 1 1 674 604M678 604A6 6 0 1 1 690 604" fill="#1a1027" />
      {/* искры */}
      {sparks.map((s, i) => (
        <g key={i} transform={`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`}>
          <circle
            className="art-a art-spark"
            r={s.s}
            fill="#ffd27a"
            style={
              {
                animationDuration: `${s.d.toFixed(2)}s`,
                animationDelay: `${s.dl.toFixed(2)}s`,
                '--sx': `${s.sx.toFixed(0)}px`,
                '--sy': `${s.sy.toFixed(0)}px`,
              } as CSSProperties
            }
          />
        </g>
      ))}
    </g>
  )
}

function Anvil() {
  const body = smooth(
    [
      [512, 775, 0],
      [548, 768],
      [582, 765, 0],
      [706, 765, 0],
      [713, 771, 0],
      [713, 785, 0],
      [690, 789, 0],
      [673, 798],
      [668, 812, 0],
      [688, 822, 0],
      [702, 832, 0],
      [588, 832, 0],
      [602, 822, 0],
      [622, 812, 0],
      [617, 798],
      [598, 789, 0],
      [572, 787],
      [540, 782],
    ],
    true,
  )
  const stump = smooth(
    [
      [592, 832, 0],
      [698, 832, 0],
      [706, 912, 0],
      [584, 912, 0],
    ],
    true,
  )
  return (
    <g>
      <Glow x={660} y={800} r={140} ry={70} color="#ff8a3a" opacity={0.2} />
      <path d={stump} fill="#0c0816" />
      <path d="M612 846v50M640 842v62M672 848v48" stroke="#1d1328" strokeWidth={1.6} opacity={0.8} />
      <path d={body} fill="#ffb46a" opacity={0.6} transform="translate(1.8 -0.8)" />
      <path d={body} fill="#0e0918" />
      <path d="M582 765H706" stroke="#ffd9a0" strokeWidth={1.2} opacity={0.45} />
      {/* молот, прислонённый к пню */}
      <path d="M718 910L744 824" stroke="#0c0816" strokeWidth={6} strokeLinecap="round" />
      <path d="M728 816L762 828L754 846L720 834Z" fill="#0c0816" />
      <path d="M762 828L754 846" stroke="#ffb46a" strokeWidth={1.4} opacity={0.5} />
    </g>
  )
}
