import { lazy, useEffect, useState } from 'react'
import { fetchLeads, isDemo } from '../api/client'
import { LighthouseArt } from '../art/LighthouseArt'
import { playTheme } from '../audio/engine'
import { heroStats, seasonClients, useGame, useSeasonClients } from '../game/store'
import type { ChapterDef, StepApi } from '../systems/chapterTypes'
import { ClientTracker } from '../systems/ClientTracker'
import { Button } from '../ui/Button'
import { LazyBox } from '../ui/Lazy'
import './lighthouse.css'

const BurnoutBalance = lazy(() => import('../minigames/balance/BurnoutBalance').then((m) => ({ default: m.BurnoutBalance })))

function BotLeads() {
  const bot = useGame((s) => s.artifacts.bot?.deployed)
  const playerId = useGame((s) => s.playerId)
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    if (!bot || isDemo) return
    let alive = true
    fetchLeads(playerId, bot.botId)
      .then((r) => alive && setCount(r.leads.length))
      .catch(() => alive && setCount(null))
    return () => {
      alive = false
    }
  }, [bot, playerId])
  if (!bot || isDemo || count === null) return null
  return (
    <p className="small mint">
      Бот @{bot.username} собрал заявок: {count}. Карточки лидов приходят тебе в Telegram.
    </p>
  )
}

function LighthouseHub({ api }: { api: StepApi }) {
  const goal = useGame((s) => s.goal)
  const season = useGame((s) => s.season)
  const clients = useSeasonClients()
  const burnoutDone = useGame((s) => !!s.flags[`burnout_s${s.season}`])
  const [fight, setFight] = useState(false)
  const [folded, setFolded] = useState(false)
  const target = goal?.clients ?? 10
  const lit = Math.min(1, clients.length / target)
  const half = Math.ceil(target / 2)
  const needBurnout = clients.length >= half && !burnoutDone
  const reached = clients.length >= target

  useEffect(() => {
    playTheme(fight ? 'boss' : 'lighthouse')
  }, [fight])

  if (fight) {
    return (
      <div className="lh-fight">
        <LazyBox>
        <BurnoutBalance
          resilience={heroStats(useGame.getState()).resilience}
          clients={clients.length}
          onFinish={(won) => {
            const st = useGame.getState()
            st.recordBattle(won)
            if (won) {
              st.setFlag(`burnout_s${season}`)
              st.gainXp(260, 'Демон Выгорания рассеян')
              st.grantRelic('lantern_oil')
              st.addCoins(80)
              setFight(false)
            }
          }}
        />
        </LazyBox>
        <div className="lh-fight-leave">
          <Button variant="quiet" size="sm" onClick={() => setFight(false)}>
            Отложить бой
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="lh">
      <LighthouseArt lit={lit} ships={Math.min(12, clients.length)} />
      <aside className={`lh-panel panel scroll ${folded ? 'is-folded' : ''}`}>
        <div className="stack">
          <div className="spread">
            <h2 className="display t-31">Маяк</h2>
            <button className="btn btn-quiet btn-sm lh-fold" onClick={() => setFolded(!folded)} aria-expanded={!folded}>
              {folded ? `Развернуть, ${clients.length} из ${target}` : 'Свернуть'}
            </button>
          </div>
          <p className="muted">
            {reached
              ? 'Все огни горят. Осталось зажечь лампу.'
              : `Каждый клиент — огонь в лампе. До полного света: ${target - clients.length}.`}
          </p>
          <BotLeads />
        </div>

        {needBurnout ? (
          <div className="lh-demon card anim-rise">
            <p className="display t-20">Из тени выходит Демон Выгорания</p>
            <p className="small muted">Он всегда приходит, когда дела идут в гору: клиентов больше, сил столько же. Пока он рядом, Маяк не зажечь.</p>
            <Button variant="lit" onClick={() => setFight(true)}>
              Встретиться с Демоном
            </Button>
          </div>
        ) : null}

        {reached && !needBurnout ? (
          <div className="lh-final card anim-rise">
            <p className="display t-20">Цель достигнута: {clients.length} из {target}</p>
            <Button variant="lit" size="lg" onClick={api.done}>
              Зажечь Маяк
            </Button>
          </div>
        ) : null}

        <ClientTracker />
      </aside>
    </div>
  )
}

export const lighthouseChapter: ChapterDef = {
  id: 'lighthouse',
  reward: { xp: 400, coins: 200 },
  summary: (s) => `${seasonClients(s).length} человек нашли тебя в тумане. Маяк горит.`,
  steps: () => [
    {
      id: 'intro',
      kind: 'dialogue',
      lines: [
        { who: 'narrator', text: 'Утёс. Ветер. Внизу — тёмная вода и огоньки кораблей, которые не видят берега.' },
        { who: 'owl', text: 'Мы пришли, {name}. Это твой Маяк. Пока он тёмный.' },
        { who: 'owl', mood: 'thinking', text: 'Маяк зажигается не кнопкой. Каждый человек, который придёт к тебе в жизни, — это огонь в его лампе.' },
        { who: 'owl', text: 'Твоя цель — {clients}. Заноси сюда каждого клиента, который начал работу. Корабли будут подходить к берегу.' },
        { who: 'owl', mood: 'worried', text: 'И будь внимательнее на полпути. Когда дела идут в гору, из тени выходит Демон Выгорания. Он приходит к тем, кто стал {успешным|успешной}.' },
      ],
    },
    { id: 'hub', kind: 'custom', title: 'Маяк', bare: true, render: (api) => <LighthouseHub api={api} /> },
  ],
}
