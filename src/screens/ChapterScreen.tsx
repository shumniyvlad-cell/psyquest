import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import confetti from 'canvas-confetti'
import { HeroFigure } from '../art/HeroFigure'
import { Scene } from '../art/Scene'
import { playTheme, sfx } from '../audio/engine'
import { CHAPTERS } from '../chapters'
import { CHAPTER_META, ROUTE_ORDER } from '../game/chapterMeta'
import { CONSUMABLES, RELICS } from '../game/items'
import { lanternOf, useGame } from '../game/store'
import { Battle } from '../systems/Battle'
import type { StepApi, StepDef } from '../systems/chapterTypes'
import { Dialogue } from '../systems/Dialogue'
import { RelicIcon } from '../ui/RelicIcon'
import { Button } from '../ui/Button'
import './chapter.css'

export function ChapterScreen() {
  const id = useGame((s) => s.currentChapter)
  if (!id) return null
  return <ChapterRun key={id} id={id} />
}

function ChapterRun({ id }: { id: NonNullable<ReturnType<typeof useGame.getState>['currentChapter']> }) {
  const def = CHAPTERS[id]
  const meta = CHAPTER_META[id]
  const setChapterStep = useGame((s) => s.setChapterStep)
  const leaveChapter = useGame((s) => s.leaveChapter)
  const gainXp = useGame((s) => s.gainXp)
  const addCoins = useGame((s) => s.addCoins)
  const replay = useGame.getState().chapters[id].status === 'done'
  const mode = useGame.getState().plan?.route.find((r) => r.chapter === id)?.mode ?? 'full'

  const steps = useMemo(() => def.steps(mode, useGame.getState()), [def, mode])
  const [idx, setIdx] = useState(() => {
    const saved = useGame.getState().chapters[id].step
    return replay ? 0 : Math.min(saved, steps.length - 1)
  })
  const [finished, setFinished] = useState(false)
  const [card, setCard] = useState(true)

  useEffect(() => {
    playTheme(meta.theme)
    const t = setTimeout(() => setCard(false), 2300)
    return () => clearTimeout(t)
  }, [meta.theme])

  const advance = () => {
    if (idx + 1 >= steps.length) {
      setFinished(true)
      return
    }
    setIdx(idx + 1)
    if (!replay) setChapterStep(id, idx + 1)
  }

  const api: StepApi = { done: advance, leave: leaveChapter, replay }
  const step = steps[idx]

  return (
    <div className="screen ch">
      <Scene id={meta.scene} dim={step?.kind === 'custom' ? 0.55 : step?.kind === 'battle' ? 0.35 : 0.1} />
      {!finished ? (
        <header className="ch-top">
          <Button variant="quiet" size="sm" icon={<ChevronLeft size={18} />} onClick={leaveChapter}>
            Карта
          </Button>
          <div className="ch-title">
            <span className="display">{meta.name}</span>
            <ol className="ch-steps" aria-label="Прогресс главы">
              {steps.map((s, i) => (
                <li key={s.id} className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''} />
              ))}
            </ol>
          </div>
          <span className="ch-top-pad" />
        </header>
      ) : null}

      {card && !finished ? (
        <button className="ch-card" onClick={() => setCard(false)} aria-label="Начать главу">
          <span className="small ch-card-num">Глава {ROUTE_ORDER.indexOf(id) + 1}</span>
          <span className="display ch-card-name">{meta.name}</span>
          <span className="small muted">{meta.short}</span>
        </button>
      ) : finished ? (
        <ChapterComplete id={id} replay={replay} />
      ) : step ? (
        <StepView
          key={step.id}
          step={step}
          api={api}
          npc={meta.npc}
          onBattleWin={(xp, coins) => {
            const k = replay ? 0.3 : 1
            gainXp(Math.round(xp * k), 'победа над тенью')
            addCoins(Math.round(coins * k))
            playTheme(meta.theme)
            advance()
          }}
          onBattleLeave={() => {
            playTheme(meta.theme)
            leaveChapter()
          }}
        />
      ) : null}
    </div>
  )
}

function StepView({
  step,
  api,
  npc,
  onBattleWin,
  onBattleLeave,
}: {
  step: StepDef
  api: StepApi
  npc: (typeof CHAPTER_META)[keyof typeof CHAPTER_META]['npc']
  onBattleWin: (xp: number, coins: number) => void
  onBattleLeave: () => void
}) {
  const lines = useMemo(
    () => (step.kind === 'dialogue' ? (typeof step.lines === 'function' ? step.lines(useGame.getState()) : step.lines) : []),
    [step],
  )
  const boss = useMemo(
    () => (step.kind === 'battle' ? (typeof step.boss === 'function' ? step.boss(useGame.getState()) : step.boss) : null),
    [step],
  )

  if (step.kind === 'dialogue') return <Dialogue lines={lines} onDone={api.done} npc={step.npc ?? npc} />
  if (step.kind === 'battle' && boss) {
    return <Battle boss={boss} onWin={() => onBattleWin(step.xp, step.coins)} onLeave={onBattleLeave} />
  }
  if (step.kind === 'custom') {
    if (step.bare) return <>{step.render(api)}</>
    return (
      <div className="ch-work scroll">
        <div className={`ch-work-inner ${step.wide ? 'is-wide' : ''}`}>
          {step.headless ? null : (
            <header className="ch-work-head anim-rise">
              <h2 className="display t-31">{step.title}</h2>
              {step.lead ? <p className="lead">{step.lead}</p> : null}
            </header>
          )}
          {step.render(api)}
        </div>
      </div>
    )
  }
  return null
}

function ChapterComplete({ id, replay }: { id: keyof typeof CHAPTERS; replay: boolean }) {
  const def = CHAPTERS[id]
  const meta = CHAPTER_META[id]
  const level = useGame((st) => st.level)
  const light = useGame((st) => lanternOf(st).color)
  const applied = useRef(false)
  const [summary] = useState(() => def.summary(useGame.getState()))
  const k = replay ? 0.3 : 1
  const xp = Math.round(def.reward.xp * k)
  const coins = Math.round(def.reward.coins * k)
  const relic = !replay && def.reward.relic ? RELICS[def.reward.relic] : null
  const item = !replay && def.reward.item ? def.reward.item : null

  useEffect(() => {
    if (applied.current) return
    applied.current = true
    const st = useGame.getState()
    st.completeChapter(id)
    st.gainXp(xp, 'глава пройдена')
    st.addCoins(coins)
    if (relic && def.reward.relic) st.grantRelic(def.reward.relic)
    if (item) st.addConsumable(item.id, item.n)
    sfx('unlock')
    if (!st.settings.reducedMotion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#ffb547', '#ffd68a', '#6fe3c8', '#f2e8d5'] })
    }
  }, [id, xp, coins, relic, item, def.reward.relic])

  return (
    <div className="ch-done">
      <div className="ch-done-hero">
        <HeroFigure light={light} level={level} pose="raise" size={280} />
      </div>
      <div className="ch-done-card panel panel-pad anim-rise">
        <p className="faint small">{replay ? 'Глава пройдена ещё раз' : 'Глава пройдена'}</p>
        <h2 className="display t-39">{meta.name}</h2>
        <p className="lead">{summary}</p>
        <div className="ch-loot">
          <div className="ch-loot-item">
            <span className="ch-loot-num gold num">+{xp}</span>
            <span className="small muted">опыта</span>
          </div>
          <div className="ch-loot-item">
            <span className="ch-loot-num gold num">+{coins}</span>
            <span className="small muted">монет</span>
          </div>
          {relic && def.reward.relic ? (
            <div className="ch-loot-item is-relic">
              <RelicIcon id={def.reward.relic} size={30} />
              <span className="small">
                <b>{relic.name}</b>
                <br />
                <span className="muted">{relic.desc}</span>
              </span>
            </div>
          ) : null}
          {item ? (
            <div className="ch-loot-item">
              <span className="ch-loot-num mint num">+{item.n}</span>
              <span className="small muted">{CONSUMABLES[item.id].name}</span>
            </div>
          ) : null}
        </div>
        <p className="small faint">Артефакт главы сохранён в Сундуке. Реальные квесты этой главы ждут в Журнале.</p>
        {id === 'lighthouse' ? (
          <Button variant="lit" size="lg" onClick={() => useGame.getState().go('ending')}>
            Зажечь Маяк
          </Button>
        ) : (
          <Button variant="lit" size="lg" onClick={() => useGame.getState().leaveChapter()}>
            Вернуться на карту
          </Button>
        )}
      </div>
    </div>
  )
}
