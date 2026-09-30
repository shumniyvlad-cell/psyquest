// Dev-стенд четырёх мини-игр: /src/minigames/launch/preview.html
import { INSTANT } from './preview-raf'
import '../../styles/global.css'
import '@fontsource/alice'
import '@fontsource-variable/golos-text'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MotionGlobalConfig } from 'motion/react'
import { unlockAudio } from '../../audio/engine'
import type { Channel } from '../../game/types'
import { BurnoutBalance } from '../balance/BurnoutBalance'
import { LaunchPlanner } from './LaunchPlanner'
import { LaunchSim } from './LaunchSim'
import { WarmupPuzzle } from './WarmupPuzzle'

if (INSTANT) MotionGlobalConfig.skipAnimations = true

type Tab = 'warmup' | 'planner' | 'sim' | 'balance'
const TABS: { id: Tab; label: string }[] = [
  { id: 'warmup', label: 'Линия прогрева' },
  { id: 'planner', label: 'План запуска' },
  { id: 'sim', label: 'Буря Хаоса' },
  { id: 'balance', label: 'Демон Выгорания' },
]
const CHANNELS: Channel[] = ['instagram', 'threads', 'telegram', 'vk', 'youtube', 'tiktok', 'offline']

const readTab = (): Tab => {
  const h = location.hash.slice(1) as Tab
  return TABS.some((t) => t.id === h) ? h : 'warmup'
}

function Num({ label, value, set, min, max, step = 1 }: { label: string; value: number; set: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <label className="field" style={{ minWidth: 120 }}>
      <span className="field-label">
        {label}: {value}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} />
    </label>
  )
}

function Stand() {
  const [tab, setTab] = useState<Tab>(readTab)
  const [out, setOut] = useState('')
  const [run, setRun] = useState(0)
  const [calm, setCalm] = useState(false)
  const [channel, setChannel] = useState<Channel>('telegram')
  const [sim, setSim] = useState({ target: 10, charisma: 5, resilience: 5, reputation: 50, planQuality: 0.7, bonusPerDay: 0, days: 7, seed: 0 })
  const [bal, setBal] = useState({ resilience: 5, clients: 10 })

  useEffect(() => {
    const onHash = () => setTab(readTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = calm ? 'true' : 'false'
  }, [calm])

  const log = (label: string, v: unknown) => setOut(`${label}\n${JSON.stringify(v, null, 2)}`)
  const s = (k: keyof typeof sim) => (v: number) => setSim((p) => ({ ...p, [k]: v }))

  return (
    <div style={{ minHeight: '100%', padding: '16px 16px 80px', background: 'radial-gradient(ellipse at 50% -10%, #1e2558, var(--night) 60%)' }}>
      <div className="stack" style={{ maxWidth: 1080, margin: '0 auto', ['--gap' as string]: '16px' }}>
        <nav className="row-wrap" aria-label="Мини-игры">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="chip"
              aria-pressed={tab === t.id}
              onClick={() => {
                location.hash = t.id
                setTab(t.id)
                setOut('')
              }}
            >
              {t.label}
            </button>
          ))}
          <button type="button" className="chip" onClick={() => void unlockAudio()}>
            Включить звук
          </button>
          <button type="button" className="chip" aria-pressed={calm} onClick={() => setCalm((c) => !c)}>
            Меньше движения
          </button>
          <button type="button" className="chip" onClick={() => setRun((r) => r + 1)}>
            Перезапуск
          </button>
        </nav>

        {tab === 'planner' ? (
          <div className="row-wrap">
            {CHANNELS.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={channel === c} onClick={() => setChannel(c)}>
                {c}
              </button>
            ))}
          </div>
        ) : null}
        {tab === 'sim' ? (
          <div className="row-wrap panel panel-pad" style={{ alignItems: 'flex-end' }}>
            <Num label="Цель" value={sim.target} set={s('target')} min={5} max={25} />
            <Num label="Харизма" value={sim.charisma} set={s('charisma')} min={1} max={20} />
            <Num label="Стойкость" value={sim.resilience} set={s('resilience')} min={1} max={20} />
            <Num label="Репутация" value={sim.reputation} set={s('reputation')} min={0} max={100} step={5} />
            <Num label="Качество плана" value={sim.planQuality} set={s('planQuality')} min={0} max={1} step={0.05} />
            <Num label="Реликвии" value={sim.bonusPerDay} set={s('bonusPerDay')} min={0} max={2} step={0.5} />
            <Num label="Дней" value={sim.days} set={s('days')} min={5} max={14} />
            <Num label="Зерно (0 — случайное)" value={sim.seed} set={s('seed')} min={0} max={50} />
          </div>
        ) : null}
        {tab === 'balance' ? (
          <div className="row-wrap panel panel-pad">
            <Num label="Стойкость" value={bal.resilience} set={(v) => setBal((b) => ({ ...b, resilience: v }))} min={1} max={20} />
            <Num label="Клиентов" value={bal.clients} set={(v) => setBal((b) => ({ ...b, clients: v }))} min={0} max={30} />
          </div>
        ) : null}

        <div key={`${tab}-${run}-${JSON.stringify(tab === 'sim' ? sim : tab === 'balance' ? bal : channel)}`}>
          {tab === 'warmup' ? <WarmupPuzzle onSolved={(r) => log('onSolved', r)} /> : null}
          {tab === 'planner' ? <LaunchPlanner channel={channel} onDone={(p) => log('onDone', p)} /> : null}
          {tab === 'sim' ? (
            <LaunchSim
              target={sim.target}
              days={sim.days}
              stats={{ charisma: sim.charisma, resilience: sim.resilience, reputation: sim.reputation }}
              planQuality={sim.planQuality}
              bonusPerDay={sim.bonusPerDay}
              seed={sim.seed || undefined}
              onFinish={(r) => log('onFinish', r)}
            />
          ) : null}
          {tab === 'balance' ? (
            <BurnoutBalance resilience={bal.resilience} clients={bal.clients} onFinish={(won) => log('onFinish', { won })} />
          ) : null}
        </div>

        {out ? (
          <pre className="panel panel-pad small" style={{ whiteSpace: 'pre-wrap', overflowX: 'auto', margin: 0 }} data-testid="callback">
            {out}
          </pre>
        ) : null}
      </div>
    </div>
  )
}

// при горячей перезагрузке стенда корень переиспользуется
const host = window as unknown as { __lsRoot?: Root }
host.__lsRoot ??= createRoot(document.getElementById('root')!)
host.__lsRoot.render(
  <StrictMode>
    <Stand />
  </StrictMode>,
)
