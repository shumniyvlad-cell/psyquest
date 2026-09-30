import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Flame, Minus, Plus } from 'lucide-react'
import { HeroFigure } from '../art/HeroFigure'
import { sfx } from '../audio/engine'
import { CONSUMABLES, RELICS } from '../game/items'
import { currentWeek, plural } from '../game/planner'
import { CLASSES, LANTERNS, STAT_INFO, titleForLevel, xpForLevel } from '../game/progression'
import { lanternOf, useGame, useHeroStats } from '../game/store'
import type { QuestDef, StatId } from '../game/types'
import { Bar } from '../ui/Bar'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { RelicIcon } from '../ui/RelicIcon'
import { useInstant } from '../ui/useInstant'
import { ChestPanel } from './ChestPanel'
import { ClientTracker } from './ClientTracker'
import { SettingsPanel } from './SettingsPanel'
import { PaywallPanel, ShopPanel } from './ShopPanels'
import './panels.css'

export function Panels() {
  const panel = useGame((s) => s.panel)
  const close = () => useGame.getState().openPanel(null)
  return (
    <>
      <Modal open={panel === 'quests'} onClose={close} kind="sheet" title="Журнал пути" width={620}>
        <QuestJournal />
      </Modal>
      <Modal open={panel === 'hero'} onClose={close} kind="sheet" title="Герой" width={560}>
        <HeroSheet />
      </Modal>
      <Modal open={panel === 'chest'} onClose={close} kind="sheet" title="Сундук артефактов" width={680}>
        <ChestPanel />
      </Modal>
      <Modal open={panel === 'shop'} onClose={close} kind="sheet" title="Лавка Совы" width={640}>
        <ShopPanel />
      </Modal>
      <Modal open={panel === 'clients'} onClose={close} kind="sheet" title="Клиенты" width={560}>
        <div className="stack">
          <p className="small muted">Каждый реальный клиент зажигает огонь в Маяке и приносит 300 опыта. Отмечай тех, кто начал работу.</p>
          <ClientTracker />
        </div>
      </Modal>
      <Modal open={panel === 'settings'} onClose={close} kind="sheet" title="Настройки" width={520}>
        <SettingsPanel />
      </Modal>
      <Modal open={panel === 'paywall'} onClose={close} width={620}>
        <PaywallPanel />
      </Modal>
      <LevelUp />
      <Toasts />
    </>
  )
}

// ---------- Журнал ----------

function QuestJournal() {
  const plan = useGame((s) => s.plan)
  const goal = useGame((s) => s.goal)
  const streak = useGame((s) => s.counters.streak)
  const journal = useGame((s) => s.journal)
  const quests = useGame((s) => s.quests)
  const now = goal ? currentWeek(goal) : 1
  const [openWeek, setOpenWeek] = useState(now)
  if (!plan || !goal) return <p className="muted">Маршрут появится после клятвы.</p>
  return (
    <div className="stack qj">
      <div className="card qj-head">
        <div className="stack" style={{ gap: 2 }}>
          <b>
            Неделя {now} из {goal.weeks}
          </b>
          <p className="small">Реальные шаги дают больше всего опыта. Отмечай честно — игра верит тебе на слово.</p>
        </div>
        {streak > 0 ? (
          <span className="badge">
            <Flame size={14} /> {streak} {plural(streak, 'день', 'дня', 'дней')} подряд
          </span>
        ) : null}
      </div>
      {plan.weeks.map((w) => {
        const done = w.quests.filter((q) => quests[q.id]?.done).length
        const isOpen = openWeek === w.index
        return (
          <section key={w.index} className={`qj-week ${w.index === now ? 'is-now' : ''}`}>
            <button className="qj-week-head" onClick={() => setOpenWeek(isOpen ? 0 : w.index)} aria-expanded={isOpen}>
              <span className="display t-20">{w.title}</span>
              <span className="small muted num">
                {done}/{w.quests.length}
              </span>
            </button>
            {isOpen ? (
              <ul className="qj-list">
                {w.quests.map((q) => (
                  <QuestRow key={q.id} q={q} />
                ))}
              </ul>
            ) : null}
          </section>
        )
      })}
      {journal.length ? (
        <section className="qj-log">
          <h3 className="display t-20">Летопись</h3>
          <ul>
            {[...journal]
              .reverse()
              .slice(0, 30)
              .map((j) => (
                <li key={j.t + j.text} className="small">
                  <span className="faint num">{new Date(j.t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span> {j.text}
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function QuestRow({ q }: { q: QuestDef }) {
  const st = useGame((s) => s.quests[q.id])
  const setProgress = useGame((s) => s.setQuestProgress)
  const completeQuest = useGame((s) => s.completeQuest)
  const [confirm, setConfirm] = useState(false)
  const done = !!st?.done
  const progress = st?.progress ?? 0

  const bump = (d: number) => {
    const v = Math.max(0, Math.min(q.target ?? 1, progress + d))
    sfx(d > 0 ? 'select' : 'click')
    setProgress(q.id, v)
    if (q.target && v >= q.target) completeQuest(q.id)
  }

  return (
    <li className={`qj-quest ${done ? 'is-done' : ''} ${q.kind === 'selfcare' ? 'is-care' : ''}`}>
      <span className="qj-check" aria-hidden="true">
        {done ? <Check size={16} /> : null}
      </span>
      <div className="grow stack" style={{ gap: 4 }}>
        <p className="qj-title">{q.title}</p>
        <p className="small muted">{q.desc}</p>
        <p className="tiny faint">
          +{q.xp} опыта, +{q.coins} монет{q.kind === 'selfcare' ? '. Забота о себе' : ''}
        </p>
        {!done && q.target ? (
          <div className="row qj-counter">
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => bump(-1)} aria-label="Меньше" disabled={progress <= 0}>
              <Minus size={14} />
            </button>
            <span className="num small">
              {progress} из {q.target} {q.unit}
            </span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => bump(1)} aria-label="Больше">
              <Plus size={14} />
            </button>
          </div>
        ) : null}
        {!done && !q.target ? (
          confirm ? (
            <div className="row-wrap">
              <Button
                variant="aurora"
                size="sm"
                sound={false}
                onClick={() => {
                  completeQuest(q.id)
                  setConfirm(false)
                }}
              >
                Да, сделано в жизни
              </Button>
              <Button variant="quiet" size="sm" onClick={() => setConfirm(false)}>
                Ещё нет
              </Button>
            </div>
          ) : (
            <div>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
                Отметить выполненным
              </Button>
            </div>
          )
        ) : null}
        {done && st?.doneAt ? (
          <p className="tiny mint">Сделано {new Date(st.doneAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p>
        ) : null}
      </div>
    </li>
  )
}

// ---------- Герой ----------

function HeroSheet() {
  const hero = useGame((s) => s.hero)
  const level = useGame((s) => s.level)
  const xp = useGame((s) => s.xp)
  const skillPoints = useGame((s) => s.skillPoints)
  const reputation = useGame((s) => s.reputation)
  const relics = useGame((s) => s.relics)
  const consumables = useGame((s) => s.consumables)
  const owned = useGame((s) => s.owned)
  const light = useGame((s) => lanternOf(s).color)
  const counters = useGame((s) => s.counters)
  const stats = useHeroStats()
  const allocate = useGame((s) => s.allocate)
  const setLantern = useGame((s) => s.setLantern)
  if (!hero) return null
  const cls = CLASSES[hero.classId]
  return (
    <div className="stack hs">
      <div className="hs-top">
        <HeroFigure light={light} level={level} size={170} />
        <div className="stack" style={{ gap: 6 }}>
          <h3 className="display t-31">{hero.name}</h3>
          <p className="small muted">
            {cls.name}. {titleForLevel(level)}, уровень {level}
          </p>
          <Bar value={xp} max={xpForLevel(level)} label="Опыт" />
          <p className="tiny faint num">
            {xp} / {xpForLevel(level)} опыта до следующего уровня
          </p>
          <p className="tiny mint">{cls.bonus}</p>
        </div>
      </div>

      <section className="card stack">
        <div className="spread">
          <h4 className="display t-20">Характеристики</h4>
          {skillPoints > 0 ? <span className="badge badge-mint">Свободных очков: {skillPoints}</span> : null}
        </div>
        {(Object.keys(STAT_INFO) as StatId[]).map((id) => (
          <div key={id} className="hs-stat">
            <div className="grow">
              <div className="spread">
                <b>{STAT_INFO[id].name}</b>
                <span className="num gold">{stats[id]}</span>
              </div>
              <p className="tiny faint">{STAT_INFO[id].desc}</p>
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" disabled={skillPoints <= 0} onClick={() => allocate(id)} aria-label={`Вложить очко в «${STAT_INFO[id].name}»`}>
              <Plus size={16} />
            </button>
          </div>
        ))}
        <div className="hs-stat">
          <div className="grow">
            <div className="spread">
              <b>Репутация</b>
              <span className="num">{reputation}</span>
            </div>
            <Bar value={reputation} max={100} variant="mint" label="Репутация" height={6} />
            <p className="tiny faint">Растёт от этичных решений, падает от манипуляций. Влияет на заявки в запуске.</p>
          </div>
        </div>
      </section>

      <section className="card stack">
        <h4 className="display t-20">Реликвии</h4>
        {relics.length === 0 ? <p className="small faint">Пока пусто. Каждая пройденная глава дарит реликвию.</p> : null}
        {relics.map((r) => (
          <div key={r} className="row">
            <RelicIcon id={r} size={18} />
            <div>
              <b className="small">{RELICS[r].name}</b>
              <p className="tiny faint">{RELICS[r].desc}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="card stack">
        <h4 className="display t-20">Сумка</h4>
        <div className="row-wrap">
          {(Object.keys(CONSUMABLES) as (keyof typeof CONSUMABLES)[]).map((c) => (
            <span key={c} className="chip">
              {CONSUMABLES[c].name}: <b className="num">{consumables[c] ?? 0}</b>
            </span>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h4 className="display t-20">Свет фонаря</h4>
        <div className="row-wrap">
          {(Object.keys(LANTERNS) as (keyof typeof LANTERNS)[])
            .filter((l) => LANTERNS[l].free || owned.includes(`lantern_${l}`))
            .map((l) => (
              <button
                key={l}
                className="chip"
                aria-pressed={hero.lantern === l}
                onClick={() => {
                  sfx('select')
                  setLantern(l)
                }}
              >
                <span className="hs-swatch" style={{ background: LANTERNS[l].color }} /> {LANTERNS[l].name}
              </button>
            ))}
        </div>
        <p className="tiny faint">Другие цвета — в Лавке, во вкладке «Облик».</p>
      </section>

      <p className="tiny faint">
        Побед над тенями: {counters.battlesWon}. Реальных шагов: {counters.questsDone}. Событий в пути: {counters.eventsSeen}.
      </p>
    </div>
  )
}

// ---------- Новый уровень ----------

function LevelUp() {
  const next = useGame((s) => s.levelUps[0])
  const shift = useGame((s) => s.shiftLevelUp)
  const light = useGame((s) => lanternOf(s).color)
  return (
    <Modal open={next !== undefined} onClose={shift} width={440}>
      {next !== undefined ? (
        <div className="lu">
          <HeroFigure light={light} level={next} pose="raise" size={200} />
          <p className="tiny faint">Новый уровень</p>
          <p className="lu-num">{next}</p>
          <p className="display t-25">{titleForLevel(next)}</p>
          <p className="small muted">Фонарь стал ярче. +2 очка характеристик.</p>
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Button
              variant="lit"
              onClick={() => {
                shift()
                useGame.getState().openPanel('hero')
              }}
            >
              Распределить очки
            </Button>
            <Button variant="quiet" onClick={shift}>
              Позже
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

// ---------- Тосты ----------

function Toasts() {
  const toasts = useGame((s) => s.toasts)
  const instant = useInstant()
  if (instant) {
    return (
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast is-${t.kind}`} onClick={() => useGame.getState().dismissToast(t.id)}>
            <span className="toast-text">{t.text}</span>
            {t.sub ? <span className="toast-sub">{t.sub}</span> : null}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast is-${t.kind}`}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            onClick={() => useGame.getState().dismissToast(t.id)}
          >
            <span className="toast-text">{t.text}</span>
            {t.sub ? <span className="toast-sub">{t.sub}</span> : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
