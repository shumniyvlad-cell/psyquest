// Dev-стенд арта: npx vite → /src/art/gallery.html
// ?s=scenes|portraits|hero|bosses|lighthouse|icons — раздел; ?scene=id — одна сцена на весь экран.
import '../styles/global.css'
import '@fontsource/alice'
import '@fontsource-variable/golos-text'
import { useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { HeroFigure } from './HeroFigure'
import { BOSS_LOOKS, Inkblot, type BossLookId, type InkState } from './Inkblot'
import { LighthouseArt } from './LighthouseArt'
import { PlaceIcon, type PlaceId } from './icons'
import { Portrait, type Mood, type NpcId } from './Portrait'
import { Scene, type SceneId } from './Scene'

const SCENE_IDS: SceneId[] = ['title', 'camp', 'doubt', 'forest', 'forge', 'tower', 'studio', 'launch', 'arena', 'lighthouse']
const NPCS: NpcId[] = ['owl', 'bear', 'robot', 'fox', 'raven', 'lion']
const MOODS: Mood[] = ['neutral', 'happy', 'thinking', 'worried', 'proud']
const LANTERNS = ['#ffb547', '#6fe3c8', '#ff8fb1', '#b9a6ff', '#5fe08a', '#8ff0ff', '#ff5a6a']
const q = new URLSearchParams(location.search)

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <h2 className="display t-31">{title}</h2>
      {children}
    </section>
  )
}

function Scenes() {
  return (
    <Section title="Сцены (16:9 и телефон 9:19)">
      {SCENE_IDS.map((id) => (
        <div key={id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 640, aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden' }}>
            <Scene id={id} />
          </div>
          <div style={{ position: 'relative', width: 170, aspectRatio: '9 / 19', borderRadius: 12, overflow: 'hidden' }}>
            <Scene id={id} dim={0.6} />
          </div>
          <div className="small muted">{id}</div>
        </div>
      ))}
    </Section>
  )
}

function Portraits() {
  const [talk, setTalk] = useState(false)
  const size = Number(q.get('size') ?? 220)
  return (
    <Section title="Портреты">
      <label className="row small">
        <input type="checkbox" checked={talk} onChange={(e) => setTalk(e.target.checked)} /> talking
      </label>
      {NPCS.filter((n) => !q.get('who') || q.get('who') === n).map((who) => (
        <div key={who} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {MOODS.map((mood) => (
            <div key={mood} style={{ display: 'grid', justifyItems: 'center', background: 'var(--night-2)', borderRadius: 12, padding: '8px 6px 0' }}>
              <Portrait who={who} mood={mood} size={size} talking={talk} />
              <div className="tiny faint" style={{ padding: 4 }}>
                {who} · {mood}
              </div>
            </div>
          ))}
        </div>
      ))}
    </Section>
  )
}

function Hero() {
  const one = q.get('pose') as 'idle' | 'walk' | 'raise' | null
  if (one) {
    return (
      <div style={{ display: 'flex', gap: 30, padding: 30, background: 'var(--night-2)', borderRadius: 12, alignItems: 'flex-end' }}>
        {[1, 5, 12, 20].map((lv) => (
          <HeroFigure key={lv} light="#ffb547" level={lv} pose={one} size={300} />
        ))}
      </div>
    )
  }
  return (
    <Section title="Герой">
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--night-2)', borderRadius: 12, padding: 20 }}>
        {(['idle', 'walk', 'raise'] as const).map((pose) =>
          [1, 5, 12].map((lv) => (
            <div key={pose + lv} style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
              <HeroFigure light={LANTERNS[lv % LANTERNS.length]} level={lv} pose={pose} size={220} />
              <div className="tiny faint">
                {pose} · ур. {lv}
              </div>
            </div>
          )),
        )}
        <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
          <HeroFigure light="#ffb547" level={20} pose="idle" facing="left" size={220} />
          <div className="tiny faint">left · ур. 20</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end', background: '#1a2050', borderRadius: 12, padding: 20 }}>
        {LANTERNS.map((c, i) => (
          <HeroFigure key={c} light={c} level={1 + i * 3} size={48} facing={i % 2 ? 'left' : 'right'} pose={i === 3 ? 'walk' : 'idle'} />
        ))}
        <HeroFigure light="#ffb547" level={8} size={300} />
      </div>
    </Section>
  )
}

const BOSSES = Object.keys(BOSS_LOOKS) as BossLookId[]
const STATES: InkState[] = ['idle', 'hit', 'attack', 'dying', 'dead']
const HEADS = [
  { label: 'Дорого', alive: true },
  { label: 'Нет времени', alive: false },
  { label: 'Подумаю', alive: true },
  { label: 'Посоветуюсь с мужем', alive: true },
  { label: 'А гарантии?', alive: false },
]

function Bosses() {
  const [tick, setTick] = useState(0)
  const [hp, setHp] = useState(1)
  const size = Number(q.get('size') ?? 230)
  const only = q.get('boss') as BossLookId | null
  return (
    <Section title="Боссы-кляксы">
      <div className="row small">
        <button className="btn btn-ghost btn-sm" onClick={() => setTick((t) => t + 1)}>
          Повторить анимации
        </button>
        <label className="row">
          hp {hp.toFixed(2)}
          <input type="range" min={0} max={1} step={0.05} value={hp} onChange={(e) => setHp(Number(e.target.value))} style={{ width: 160 }} />
        </label>
      </div>
      {BOSSES.filter((b) => !only || b === only).map((id) => (
        <div key={id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {STATES.map((st) => (
            <div key={st + tick} style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
              <Inkblot {...BOSS_LOOKS[id]} state={st} hp={st === 'idle' ? hp : 1} size={size} heads={id === 'hydra' ? HEADS : undefined} />
              <div className="tiny faint">
                {id} · {st}
              </div>
            </div>
          ))}
          <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
            <Inkblot {...BOSS_LOOKS[id]} state="idle" hp={0.2} size={size} heads={id === 'hydra' ? HEADS : undefined} />
            <div className="tiny faint">{id} · hp 0.2</div>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[11, 23, 37, 41, 58, 64].map((sd) => (
          <div key={sd} style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
            <Inkblot seed={sd} size={180} spiky={(sd % 5) / 5} eyes={((sd % 4) + 1) as 1 | 2 | 3 | 4} />
            <div className="tiny faint">seed {sd}</div>
          </div>
        ))}
        <div style={{ display: 'grid', gap: 4, justifyItems: 'center', background: 'var(--night-2)', padding: 8, borderRadius: 12 }}>
          <Inkblot {...BOSS_LOOKS.impostor} card={false} size={180} />
          <div className="tiny faint">card=false</div>
        </div>
      </div>
    </Section>
  )
}

const PLACES: PlaceId[] = ['camp', 'doubt', 'forest', 'forge', 'tower', 'studio', 'launch', 'arena', 'lighthouse', 'gate']

function Lighthouses() {
  const [lit, setLit] = useState(0.5)
  const [ships, setShips] = useState(5)
  return (
    <Section title="Маяк крупным планом">
      <div className="row small">
        <label className="row">
          lit {lit.toFixed(2)}
          <input type="range" min={0} max={1} step={0.05} value={lit} onChange={(e) => setLit(Number(e.target.value))} style={{ width: 160 }} />
        </label>
        <label className="row">
          ships {ships}
          <input type="range" min={0} max={12} step={1} value={ships} onChange={(e) => setShips(Number(e.target.value))} style={{ width: 160 }} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {([
          [0, 0],
          [0.5, 3],
          [1, 12],
        ] as const).map(([l, sh]) => (
          <div key={l} style={{ display: 'grid', gap: 4 }}>
            <div style={{ position: 'relative', width: 420, aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden' }}>
              <LighthouseArt lit={l} ships={sh} />
            </div>
            <div className="tiny faint">
              lit {l} · ships {sh}
            </div>
          </div>
        ))}
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ position: 'relative', width: 420, aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden' }}>
            <LighthouseArt lit={lit} ships={ships} />
          </div>
          <div className="tiny faint">интерактивный</div>
        </div>
        <div style={{ position: 'relative', width: 180, aspectRatio: '9 / 19', borderRadius: 12, overflow: 'hidden' }}>
          <LighthouseArt lit={lit} ships={ships} />
        </div>
      </div>
    </Section>
  )
}

function Icons() {
  const big = Number(q.get('isize') ?? 64)
  return (
    <Section title="Иконки карты">
      {[true, false].map((lit) => (
        <div key={String(lit)} style={{ display: 'flex', gap: 18, flexWrap: 'wrap', background: 'var(--night-2)', padding: 16, borderRadius: 12 }}>
          {PLACES.map((id) => (
            <div key={id} style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
              <PlaceIcon id={id} lit={lit} size={big} />
              <div className="tiny faint">{id}</div>
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {PLACES.map((id) => (
          <PlaceIcon key={id} id={id} lit size={40} />
        ))}
        {PLACES.map((id) => (
          <PlaceIcon key={id + 'x'} id={id} lit={false} size={40} />
        ))}
      </div>
    </Section>
  )
}

function Compose() {
  return (
    <Section title="Композиция: сцена + dim + герой + портрет">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 760, aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden' }}>
          <Scene id="title">
            <div style={{ position: 'absolute', right: '16%', bottom: '11%' }}>
              <HeroFigure light="#ffb547" level={4} size={170} facing="left" />
            </div>
          </Scene>
        </div>
        <div style={{ position: 'relative', width: 760, aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden' }}>
          <Scene id="forest" dim={0.55}>
            <div style={{ position: 'absolute', left: '6%', bottom: 0 }}>
              <Portrait who="owl" mood="happy" size={260} talking />
            </div>
            <div style={{ position: 'absolute', right: '10%', bottom: '4%' }}>
              <HeroFigure light="#6fe3c8" level={9} size={200} facing="left" pose="walk" />
            </div>
            <div className="panel panel-pad" style={{ position: 'absolute', left: '28%', right: '24%', bottom: 16 }}>
              <p className="small">Сова: «Страх — это проекция. Посвети на него — и увидишь кляксу.»</p>
            </div>
          </Scene>
        </div>
        <div style={{ position: 'relative', width: 180, aspectRatio: '9 / 19', borderRadius: 12, overflow: 'hidden' }}>
          <Scene id="forge" dim={0.35}>
            <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)' }}>
              <Portrait who="bear" mood="proud" size={200} />
            </div>
          </Scene>
        </div>
      </div>
    </Section>
  )
}

function Gallery() {
  const one = q.get('scene') as SceneId | null
  if (one) {
    return (
      <div style={{ position: 'fixed', inset: 0 }}>
        <Scene id={one} dim={Number(q.get('dim') ?? 0)} />
      </div>
    )
  }
  const s = q.get('s')
  return (
    <div style={{ padding: 16, display: 'grid', gap: 28 }}>
      {(!s || s === 'compose') && <Compose />}
      {(!s || s === 'icons') && <Icons />}
      {(!s || s === 'lighthouse') && <Lighthouses />}
      {(!s || s === 'bosses') && <Bosses />}
      {(!s || s === 'portraits') && <Portraits />}
      {(!s || s === 'hero') && <Hero />}
      {(!s || s === 'scenes') && <Scenes />}
    </div>
  )
}

// HMR перезапускает модуль — переиспользуем корень
const w = window as unknown as { __artRoot?: Root }
w.__artRoot ??= createRoot(document.getElementById('root')!)
w.__artRoot.render(<Gallery />)
