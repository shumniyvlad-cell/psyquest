import { lazy, useState } from 'react'
import { heroStats, useGame } from '../game/store'
import type { GameState } from '../game/store'
import type { ChapterDef, StepApi } from '../systems/chapterTypes'
import { Button } from '../ui/Button'
import { LazyBox } from '../ui/Lazy'

const WarmupPuzzle = lazy(() => import('../minigames/launch/WarmupPuzzle').then((m) => ({ default: m.WarmupPuzzle })))
const LaunchPlanner = lazy(() => import('../minigames/launch/LaunchPlanner').then((m) => ({ default: m.LaunchPlanner })))
const LaunchSim = lazy(() => import('../minigames/launch/LaunchSim').then((m) => ({ default: m.LaunchSim })))

const QUALITY_K = { S: 1, A: 0.85, B: 0.7, C: 0.5 } as const

function planQuality(s: GameState) {
  const a = s.artifacts
  let q = 0.1
  q += ((a.positioning?.score ?? 50) / 100) * 0.25
  q += (a.product ? QUALITY_K[a.product.quality] : 0.4) * 0.2
  q += a.bot ? 0.15 : 0.03
  q += (a.content?.scripts.length ?? 0) >= 3 ? 0.12 : 0.06
  q += s.flags.warmup_clean ? 0.12 : 0.07
  q += a.launch?.days.length ? 0.06 : 0
  return Math.max(0.2, Math.min(1, q))
}

function Puzzle({ api }: { api: StepApi }) {
  const gainXp = useGame((s) => s.gainXp)
  const setFlag = useGame((s) => s.setFlag)
  return (
    <WarmupPuzzle
      onSolved={({ mistakes }) => {
        setFlag('warmup_clean', mistakes <= 1)
        if (!api.replay) gainXp(Math.max(40, 120 - mistakes * 15), 'прогрев собран')
        api.done()
      }}
    />
  )
}

function Planner({ api }: { api: StepApi }) {
  const channel = useGame((s) => s.goal?.channel ?? 'instagram')
  const saved = useGame((s) => s.artifacts.launch)
  const setArtifact = useGame((s) => s.setArtifact)
  const gainXp = useGame((s) => s.gainXp)
  return (
    <LaunchPlanner
      channel={channel}
      startDate={saved?.startDate}
      days={saved?.days.length || undefined}
      onDone={(plan) => {
        setArtifact('launch', { ...plan, simApplications: saved?.simApplications ?? 0 })
        if (!api.replay) gainXp(90, 'план запуска')
        api.done()
      }}
    />
  )
}

function Storm({ api }: { api: StepApi }) {
  const [result, setResult] = useState<{ won: boolean; applications: number } | null>(null)
  const [seed] = useState(() => Math.floor(Math.random() * 1e6))
  const [params] = useState(() => {
    const s = useGame.getState()
    const st = heroStats(s)
    return {
      // цель Бури растёт со сложностью маршрута: 10 клиентов в «честном вызове» — около 9 заявок
      target: Math.max(5, Math.min(16, Math.round(8 + ((s.plan?.bossScale ?? 1) - 1) * 10 + ((s.goal?.clients ?? 10) - 10) * 0.25))),
      stats: { charisma: st.charisma, resilience: st.resilience, reputation: s.reputation },
      planQuality: planQuality(s),
      bonus: s.relics.includes('gear') ? 1 : 0,
    }
  })

  if (result) {
    return (
      <div className="panel panel-pad workbench-card anim-rise">
        <p className="display t-25">{result.won ? 'Буря отступила' : 'Буря потрепала, но ты на ногах'}</p>
        <p className="lead">
          {result.won
            ? `Собрано заявок: ${result.applications}. Теперь то же самое — в жизни, по твоему плану.`
            : `Заявок: ${result.applications}. В реальном запуске цифры будут другими — важен ритм, а не идеальность.`}
        </p>
        <Button variant="lit" onClick={api.done}>
          Дальше
        </Button>
      </div>
    )
  }

  return (
    <LaunchSim
      target={params.target}
      stats={params.stats}
      planQuality={params.planQuality}
      bonusPerDay={params.bonus}
      seed={seed}
      onFinish={(r) => {
        const st = useGame.getState()
        const cur = st.artifacts.launch
        if (cur) st.setArtifact('launch', { ...cur, simApplications: Math.max(cur.simApplications, r.applications) })
        st.recordBattle(r.won)
        if (!api.replay) st.gainXp(r.won ? 220 : 90, r.won ? 'Буря Хаоса побеждена' : 'опыт запуска')
        if (r.won && !api.replay) st.addCoins(50)
        setResult({ won: r.won, applications: r.applications })
      }}
    />
  )
}

export const launchChapter: ChapterDef = {
  id: 'launch',
  reward: { xp: 180, coins: 80, relic: 'horn', item: { id: 'supervision', n: 1 } },
  summary: (s) => {
    const l = s.artifacts.launch
    return l ? `План запуска на ${l.days.length} дней со стартом ${new Date(l.startDate + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}.` : 'План запуска готов.'
  },
  steps: () => [
    {
      id: 'intro',
      kind: 'dialogue',
      lines: [
        { who: 'narrator', text: 'Площадь гудит. Гирлянды раскачиваются, где-то хлопает фейерверк.' },
        { who: 'raven', text: 'Кар! Карл. Глашатай. Хочешь, чтобы о тебе узнали? Надо, чтобы о тебе рассказывали. Кар!' },
        { who: 'raven', mood: 'thinking', text: 'Запуск — это не «выложил пост и жду». Это история на несколько дней: знакомство, проблема, мифы, кейсы, метод, польза, приглашение.' },
        { who: 'owl', text: 'Порядок важен. Позовёшь сразу — люди не готовы. Будешь греть слишком долго — остынут. Соберём прогрев правильно.' },
      ],
    },
    { id: 'order', kind: 'custom', headless: true, title: 'Линия прогрева', lead: 'Разложи этапы в том порядке, в котором человек готов их услышать.', wide: true, render: (api) => <LazyBox><Puzzle api={api} /></LazyBox> },
    { id: 'planner', kind: 'custom', headless: true, title: 'План запуска', lead: 'Каждый день — один шаг. Тексты можно поправить под себя.', wide: true, render: (api) => <LazyBox><Planner api={api} /></LazyBox> },
    {
      id: 'storm-intro',
      kind: 'dialogue',
      lines: [
        { who: 'narrator', text: 'Небо над площадью темнеет. Тучи сворачиваются в воронку.' },
        { who: 'raven', mood: 'worried', text: 'Буря Хаоса. Она приходит в каждый запуск: то интернет упадёт, то охваты, то силы. Пройди неделю и собери заявки.' },
        { who: 'owl', text: 'И помни: отдых — не слабость. Это стратегия.' },
      ],
    },
    { id: 'storm', kind: 'custom', headless: true, title: 'Буря Хаоса', lead: 'Семь дней запуска. Два действия в день. Энергия не бесконечна.', wide: true, render: (api) => <LazyBox><Storm api={api} /></LazyBox> },
    {
      id: 'outro',
      kind: 'dialogue',
      lines: [
        { who: 'raven', mood: 'proud', text: 'Кар! Вот это запуск. Теперь сделай так же в жизни — план у тебя уже есть.' },
        { who: 'raven', text: 'Держи рупор. Не для крика — для ясности.' },
      ],
    },
  ],
}
