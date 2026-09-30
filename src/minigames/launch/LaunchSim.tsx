import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import {
  BedDouble,
  CloudLightning,
  Flame,
  Newspaper,
  Radio,
  RotateCcw,
  Send,
  Sparkles,
  TriangleAlert,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { sfx, stinger } from '../../audio/engine'
import { Bar } from '../../ui/Bar'
import { Button } from '../../ui/Button'
import type { EventEffect, StormEvent } from './events'
import { plural, randomSeed } from './rng'
import {
  ACTIONS,
  ACTION_BY_ID,
  beginDay,
  chooseOption,
  createSim,
  energyTier,
  grindCost,
  isWon,
  nextDay,
  pendingEvent,
  previewDay,
  stormLevel,
  summarize,
  type ActionId,
  type DayRecord,
  type SimState,
} from './simulation'
import { StormCloud } from './StormCloud'
import { cx, useCalm } from './useCalm'
import './launch.css'

export interface LaunchSimProps {
  target: number
  days?: number
  stats: { charisma: number; resilience: number; reputation: number }
  planQuality: number
  bonusPerDay?: number
  seed?: number
  onFinish: (r: { applications: number; won: boolean; energyLeft: number; log: string[] }) => void
}

const ICON: Record<ActionId, LucideIcon> = {
  case: Newspaper,
  stories: Sparkles,
  live: Radio,
  dm: Send,
  collab: Users,
  rest: BedDouble,
}

const n1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',')
const signed = (v: number) => (v > 0 ? `+${Math.round(v)}` : v < 0 ? `−${Math.abs(Math.round(v))}` : '0')
const appsWord = (n: number) => plural(n, ['заявка', 'заявки', 'заявок'])
/** «≈0,6 заявки», «≈2 заявки», «≈5 заявок»: у дробных — всегда «заявки» */
const approxApps = (v: number) => {
  const r = Math.round(v * 10) / 10
  return `≈${n1(r)} ${Number.isInteger(r) ? plural(r, ['заявка', 'заявки', 'заявок']) : 'заявки'}`
}

function effectHint(e: EventEffect): string | null {
  if (e.cancel) return 'Дела дня отменяются'
  const energy = (e.energy ?? 0) - (e.extraCost ?? 0)
  if (e.mult && e.mult < 1) return `${signed(energy)} энергии, отдача дел ниже`
  if (energy) return `${signed(energy)} энергии`
  return null
}

const TONE: Record<StormEvent['tone'], { label: string; cls: string }> = {
  bad: { label: 'Удар Бури', cls: 'badge badge-ink' },
  good: { label: 'Подарок Бури', cls: 'badge badge-mint' },
  mixed: { label: 'Развилка', cls: 'badge' },
}

export function LaunchSim({ target, days = 7, stats, planQuality, bonusPerDay = 0, seed, onFinish }: LaunchSimProps) {
  const calm = useCalm()
  const uid = useId()
  const [attempt, setAttempt] = useState(0)
  const baseSeed = useMemo(() => seed ?? randomSeed(), [seed])
  const make = (n: number) =>
    createSim({
      target,
      days,
      charisma: stats.charisma,
      resilience: stats.resilience,
      reputation: stats.reputation,
      planQuality,
      bonusPerDay,
      seed: (baseSeed + n * 7919) >>> 0,
    })
  const [sim, setSim] = useState<SimState>(() => make(0))
  const [started, setStarted] = useState(false)
  const [picks, setPicks] = useState<ActionId[]>([])
  const [flash, setFlash] = useState(0)
  const interacted = useRef(false)
  // новая фаза — фокус на её заголовок, чтобы клавиатура и экранный диктор не терялись
  const headRef = useCallback(
    (el: HTMLHeadingElement | null) => {
      if (!el || !interacted.current) return
      el.focus({ preventScroll: true })
      el.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' })
    },
    [calm],
  )

  const storm = stormLevel(sim)
  const ev = pendingEvent(sim)
  const lastDay: DayRecord | undefined = sim.history[sim.history.length - 1]
  const summary = sim.phase === 'final' ? summarize(sim) : null
  const tier = energyTier(sim.energy / sim.maxEnergy)
  const preview = previewDay(sim, picks)
  const won = isWon(sim)

  useEffect(() => {
    if (sim.phase === 'final') stinger(won ? 'victory' : 'defeat')
  }, [sim.phase, won])

  /** Прогноз для карточки: как если бы это дело встало следующим (или уже стоит в плане) */
  const cardOutcome = (id: ActionId) => {
    const at = id === 'rest' ? picks.lastIndexOf('rest') : picks.indexOf(id)
    if (picks.length >= 2) {
      if (at >= 0) return previewDay(sim, picks).outcomes[at]
      return previewDay(sim, [id]).outcomes[0]
    }
    if (at >= 0 && id !== 'rest') return previewDay(sim, picks).outcomes[at]
    const pv = previewDay(sim, [...picks, id])
    return pv.outcomes[pv.outcomes.length - 1]
  }

  const addPick = (id: ActionId) => {
    interacted.current = true
    if (sim.phase !== 'plan') return
    if (id !== 'rest' && picks.includes(id)) {
      setPicks(picks.filter((p) => p !== id))
      sfx('close')
      return
    }
    if (picks.length >= 2) {
      if (id === 'rest' && picks.includes('rest')) {
        const i = picks.lastIndexOf('rest')
        setPicks(picks.filter((_, k) => k !== i))
        sfx('close')
      } else sfx('error')
      return
    }
    setPicks([...picks, id])
    sfx('select')
  }

  const removePick = (index: number) => {
    setPicks(picks.filter((_, k) => k !== index))
    sfx('close')
  }

  const live = () => {
    interacted.current = true
    const next = beginDay(sim, picks)
    if (next === sim) return
    setSim(next)
    setPicks([])
    const e = pendingEvent(next)
    // молния бьёт только на удары Бури, подарки приходят тихо
    if (e?.tone !== 'good') setFlash((f) => f + 1)
    sfx(e?.tone === 'good' ? 'magic' : e?.tone === 'bad' ? 'lock' : 'open')
  }

  const answer = (i: number) => {
    interacted.current = true
    const next = chooseOption(sim, i)
    setSim(next)
    const rec = next.history[next.history.length - 1]
    if (rec?.burnout) sfx('hurt')
    else if (rec && rec.apps > 0) sfx('coin')
    else sfx('page')
  }

  const advance = () => {
    interacted.current = true
    const next = nextDay(sim)
    setSim(next)
    sfx(next.phase === 'lost' ? 'hurt' : 'step')
  }

  const restart = () => {
    interacted.current = true
    const n = attempt + 1
    setAttempt(n)
    setSim(make(n))
    setPicks([])
    setStarted(true)
    sfx('page')
  }

  const finish = () =>
    onFinish({
      applications: sim.applications,
      won: isWon(sim),
      energyLeft: Math.round(sim.energy),
      log: sim.log.slice(),
    })

  const dayLabel = sim.phase === 'final' ? 'Итоги запуска' : `День ${sim.day} из ${sim.cfg.days}`

  return (
    <MotionConfig reducedMotion={calm ? 'always' : 'never'}>
      <section className="ls-game ls-sim" aria-labelledby={`${uid}-title`}>
        <div className="ls-scene panel">
          <StormCloud level={storm} progress={sim.applications / sim.cfg.target} flash={flash} calm={calm} />
          <div className="ls-scene-top">
            <div>
              <p className="ls-kicker">Площадь Запуска, босс главы</p>
              <h2 id={`${uid}-title`} className="display t-25">
                Буря Хаоса
              </h2>
            </div>
            <span className="badge badge-ink">{dayLabel}</span>
          </div>

          <div className="ls-hud">
            <Meter
              label="Энергия"
              value={`${Math.round(sim.energy)} из ${sim.maxEnergy}`}
              note={tier.label}
              bar={<Bar value={sim.energy} max={sim.maxEnergy} variant={tier.tier === 'tired' || tier.tier === 'empty' ? 'ember' : 'gold'} label="Энергия" />}
            />
            <Meter
              label="Интерес аудитории"
              value={`${Math.round(sim.interest)} из 100`}
              bar={<Bar value={sim.interest} max={100} variant="mint" label="Интерес аудитории" />}
            />
            <Meter
              label="Заявки"
              value={`${sim.applications} из ${sim.cfg.target}`}
              note={isWon(sim) ? 'Цель есть' : undefined}
              bar={<Bar value={sim.applications} max={sim.cfg.target} className="ls-bar-apps" label="Заявки" />}
            />
          </div>
          <StatusChips sim={sim} />
        </div>

        <ol className="ls-ribbon" aria-label="Лента дней">
          {Array.from({ length: sim.cfg.days }, (_, i) => {
            const d = i + 1
            const rec = sim.history.find((h) => h.day === d)
            const current = sim.phase !== 'final' && d === sim.day && !rec
            const state = rec ? (rec.lost ? 'lost' : 'done') : current ? 'now' : 'next'
            return (
              <li key={d} className={cx('ls-tile', `is-${state}`)} aria-current={current ? 'step' : undefined}>
                <span className="ls-tile-d">
                  <span className="ls-tile-word">День </span>
                  {d}
                </span>
                <span className="ls-tile-v">
                  {rec ? (rec.lost ? <Flame size={15} aria-label="выгорание" /> : `+${rec.apps}`) : current ? 'сейчас' : ''}
                </span>
              </li>
            )
          })}
        </ol>

        <div className="ls-main panel panel-pad">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${started}-${sim.phase}-${sim.day}-${attempt}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="stack ls-phase"
              style={{ '--gap': '16px' } as CSSProperties}
            >
              {!started ? (
                <>
                  <h3 ref={headRef} tabIndex={-1} className="display t-25">
                    {sim.cfg.days} {plural(sim.cfg.days, ['день', 'дня', 'дней'])} до закрытия набора
                  </h3>
                  <p className="muted">
                    Буря Хаоса проверяет любой запуск: сбои, сомнения, хейтеры и собственная усталость. Цель —{' '}
                    <strong className="gold">
                      {sim.cfg.target} {appsWord(sim.cfg.target)}
                    </strong>{' '}
                    за {sim.cfg.days} {plural(sim.cfg.days, ['день', 'дня', 'дней'])}.
                  </p>
                  <ul className="ls-rules">
                    <li>
                      <Zap size={18} aria-hidden />
                      <span>
                        Каждый день — два дела. Энергии {sim.maxEnergy}: со свежей головой дела дают больше, на
                        усталости — меньше.
                      </span>
                    </li>
                    <li>
                      <BedDouble size={18} aria-hidden />
                      <span>
                        Отдых можно взять дважды — это полный выходной. Энергия на нуле забирает следующий день целиком.
                      </span>
                    </li>
                    <li>
                      <CloudLightning size={18} aria-hidden />
                      <span>Каждый вечер Буря подбрасывает событие. Бережные решения окупаются в долгую.</span>
                    </li>
                  </ul>
                  <div className="ls-actions">
                    <Button
                      variant="lit"
                      size="lg"
                      onClick={() => {
                        interacted.current = true
                        setStarted(true)
                        sfx('open')
                      }}
                      sound={false}
                    >
                      Начать запуск
                    </Button>
                  </div>
                </>
              ) : sim.phase === 'plan' ? (
                <>
                  <div className="ls-phase-head">
                    <h3 ref={headRef} tabIndex={-1} className="display t-20">
                      День {sim.day}: что в плане?
                    </h3>
                    <p className="small muted">Выбери два дела. Отдых можно взять дважды.</p>
                  </div>

                  <div className="ls-slots" aria-label="Выбранные дела">
                    {[0, 1].map((i) => {
                      const id = picks[i]
                      if (!id)
                        return (
                          <div key={i} className="ls-slot-pick is-empty">
                            {i === 0 ? 'Первое дело' : 'Второе дело'}
                          </div>
                        )
                      const Icon = ICON[id]
                      return (
                        <button
                          key={i}
                          type="button"
                          className="ls-slot-pick"
                          onClick={() => removePick(i)}
                          aria-label={`Убрать: ${ACTION_BY_ID[id].title}`}
                        >
                          <Icon size={18} aria-hidden />
                          <span className="grow">{ACTION_BY_ID[id].title}</span>
                          <X size={16} aria-hidden className="faint" />
                        </button>
                      )
                    })}
                  </div>

                  <div className="ls-actions-grid">
                    {ACTIONS.map((a) => {
                      const chosen = picks.filter((p) => p === a.id).length
                      const full = picks.length >= 2
                      const o = cardOutcome(a.id)
                      const Icon = ICON[a.id]
                      const repeat = a.id !== 'rest' && sim.streak[a.id] > 0
                      const blocked = full && !chosen
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className={cx('ls-action', a.id === 'rest' && 'is-rest')}
                          aria-pressed={chosen > 0}
                          aria-disabled={blocked || undefined}
                          onClick={() => (blocked ? sfx('error') : addPick(a.id))}
                        >
                          <span className="ls-action-top">
                            <span className="ls-action-icon" aria-hidden="true">
                              <Icon size={20} />
                            </span>
                            <span className="ls-action-title">{a.title}</span>
                            {chosen > 1 ? <span className="badge badge-mint">×2</span> : null}
                          </span>
                          <span className="ls-action-blurb">{a.blurb}</span>
                          <span className="ls-action-stats">
                            {a.id === 'rest' ? (
                              (o?.energy ?? a.restore) >= 1 ? (
                                <span className="ls-stat is-plus">+{Math.round(o?.energy ?? a.restore)} энергии</span>
                              ) : (
                                <span className="ls-stat is-dim">Энергия и так полная</span>
                              )
                            ) : (
                              <>
                                <span className="ls-stat is-minus">{signed(-a.cost * grindCost(sim))} энергии</span>
                                <span className="ls-stat is-mint">+{Math.round(o?.interest ?? a.interest)} интереса</span>
                                <span className="ls-stat is-gold">{approxApps(o?.expected ?? 0)}</span>
                              </>
                            )}
                          </span>
                          {repeat || o?.fatigue || (a.id !== 'rest' && sim.grind > 0) ? (
                            <span className="ls-action-warn">
                              {repeat
                                ? `Вчера уже было: отдача ×${n1(o?.repeatMult ?? 1)}`
                                : o?.fatigue
                                  ? 'На усталости отдача ниже'
                                  : `Без отдыха: дороже ×${n1(grindCost(sim))}`}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>

                  <div className="ls-plan-summary">
                    <p className="small">
                      Энергия к вечеру:{' '}
                      <strong className={cx('num', preview.energyAfter / sim.maxEnergy < 0.35 && 'ember')}>
                        {Math.round(preview.energyAfter)} из {sim.maxEnergy}
                      </strong>
                      .{picks.length ? <> Ожидаемо {approxApps(preview.expectedApps)}.</> : null}
                    </p>
                    {preview.burnout ? (
                      <p className="small ember ls-warn">
                        <TriangleAlert size={16} aria-hidden /> Энергия закончится — завтрашний день заберёт выгорание.
                      </p>
                    ) : null}
                    <Button variant="lit" size="lg" onClick={live} disabled={picks.length < 2} sound={false}>
                      Прожить день
                    </Button>
                  </div>
                </>
              ) : sim.phase === 'event' && ev ? (
                <>
                  <div className="ls-phase-head">
                    <span className={TONE[ev.tone].cls}>{TONE[ev.tone].label}</span>
                    <h3 ref={headRef} tabIndex={-1} className="display t-25">
                      {ev.title}
                    </h3>
                    <p className="muted">{ev.text}</p>
                  </div>
                  <div className="stack ls-options">
                    {ev.options.map((o, i) => {
                      const hint = effectHint(o.effect)
                      return (
                        <button key={i} type="button" className="choice ls-option" onClick={() => answer(i)}>
                          <span className="ls-option-label">{o.label}</span>
                          {hint ? <span className="ls-option-hint">{hint}</span> : null}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : sim.phase === 'report' && lastDay ? (
                <DayReport rec={lastDay} sim={sim} headRef={headRef} onNext={advance} />
              ) : sim.phase === 'lost' ? (
                <>
                  <div className="ls-phase-head">
                    <span className="badge badge-ember">Выгорание</span>
                    <h3 ref={headRef} tabIndex={-1} className="display t-25">
                      День {sim.day} потерян
                    </h3>
                    <p className="muted">
                      Энергия закончилась, и организм взял выходной без спроса: ни контента, ни заявок. Интерес остыл,
                      ритм сбился, а доверие немного просело — люди заметили тишину.
                    </p>
                  </div>
                  <div className="ls-actions">
                    <Button variant="ghost" onClick={advance} sound={false}>
                      {sim.day >= sim.cfg.days ? 'К итогам' : 'Дальше'}
                    </Button>
                  </div>
                </>
              ) : summary ? (
                <>
                  <div className="ls-phase-head">
                    <span className={summary.won ? 'badge badge-mint' : 'badge badge-ember'}>
                      {summary.won ? 'Победа' : 'Поражение'}
                    </span>
                    <h3 ref={headRef} tabIndex={-1} className="display t-31">
                      {summary.headline}
                    </h3>
                    <p className="ls-score">
                      <span className="num gold">{summary.applications}</span>
                      <span className="muted">
                        {' '}
                        из {summary.target} {appsWord(summary.target)}
                      </span>
                    </p>
                    <p className="muted">
                      {summary.won
                        ? 'Цель запуска достигнута. Заявки — это люди, которые решились; дальше их ждёт бережная диагностика.'
                        : `До цели не хватило ${summary.target - summary.applications} ${appsWord(summary.target - summary.applications)}. Это не приговор, а разведка: теперь видно, где запуск теряет силы.`}
                    </p>
                  </div>
                  <div className="ls-breakdown">
                    <h4 className="ls-sub">Что сработало</h4>
                    <ul className="ls-insights">
                      {summary.insights.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                    <ActionTable summary={summary} />
                    <p className="ls-verdict">{summary.verdict}</p>
                  </div>
                  <div className="ls-actions">
                    <Button variant="lit" size="lg" onClick={finish}>
                      Дальше
                    </Button>
                    {!summary.won ? (
                      <Button variant="ghost" icon={<RotateCcw size={16} aria-hidden />} onClick={restart} sound={false}>
                        Сыграть ещё раз
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </MotionConfig>
  )
}

function Meter({ label, value, note, bar }: { label: string; value: string; note?: string; bar: ReactNode }) {
  return (
    <div className="ls-meter">
      <div className="ls-meter-row">
        <span className="ls-meter-label">{label}</span>
        <span className="ls-meter-value num">{value}</span>
      </div>
      {bar}
      {note ? <span className="ls-meter-note">{note}</span> : <span className="ls-meter-note" aria-hidden="true" />}
    </div>
  )
}

function StatusChips({ sim }: { sim: SimState }) {
  const chips: { text: string; cls: string }[] = []
  // после расчёта дня модификаторы относятся уже к завтрашнему дню
  const when = sim.phase === 'report' || sim.phase === 'lost' ? 'Завтра' : 'Сегодня'
  if (sim.trust > 0) chips.push({ text: `Доверие +${sim.trust}: отклик выше на ${Math.round(sim.trust * 7)}%`, cls: 'badge badge-mint' })
  if (sim.trust < 0) chips.push({ text: `Доверие −${-sim.trust}: отклик ниже на ${Math.round(-sim.trust * 7)}%`, cls: 'badge badge-ember' })
  if (sim.rhythm > 0) chips.push({ text: `Ритм: ${sim.rhythm} ${plural(sim.rhythm, ['день', 'дня', 'дней'])} с контентом`, cls: 'badge' })
  if (sim.grind > 0)
    chips.push({
      text: `Без отдыха ${sim.grind} ${plural(sim.grind, ['день', 'дня', 'дней'])}: дела дороже на ${Math.round((grindCost(sim) - 1) * 100)}%`,
      cls: 'badge badge-ember',
    })
  if (sim.phase === 'final') return null
  if (sim.mods.dm > 1) chips.push({ text: `${when} личные сообщения сильнее на ${Math.round((sim.mods.dm - 1) * 100)}%`, cls: 'badge badge-mint' })
  if (sim.mods.interest > 1) chips.push({ text: `${when} контент заходит лучше на ${Math.round((sim.mods.interest - 1) * 100)}%`, cls: 'badge badge-mint' })
  if (sim.mods.apps > 1) chips.push({ text: `${when} записываться проще на ${Math.round((sim.mods.apps - 1) * 100)}%`, cls: 'badge badge-mint' })
  if (!chips.length) return null
  return (
    <div className="ls-chips" aria-label="Состояние запуска">
      {chips.map((c) => (
        <span key={c.text} className={c.cls}>
          {c.text}
        </span>
      ))}
    </div>
  )
}

function DayReport({
  rec,
  sim,
  headRef,
  onNext,
}: {
  rec: DayRecord
  sim: SimState
  headRef: (el: HTMLHeadingElement | null) => void
  onNext: () => void
}) {
  const last = rec.day >= sim.cfg.days
  const energyDelta = rec.energyEnd - rec.energyStart
  const interestDelta = rec.interestEnd - rec.interestStart
  return (
    <>
      <div className="ls-phase-head">
        <h3 ref={headRef} tabIndex={-1} className="display t-25">
          Итоги дня {rec.day}
        </h3>
        <p className="muted">
          {rec.apps > 0
            ? `+${rec.apps} ${appsWord(rec.apps)} за день. Всего ${sim.applications} из ${sim.cfg.target}.`
            : `Сегодня без заявок. Всего ${sim.applications} из ${sim.cfg.target} — ничего, семена прорастают не сразу.`}
        </p>
      </div>
      <ul className="ls-report">
        {rec.cancelled ? (
          <li className="ls-report-row">
            <BedDouble size={18} aria-hidden />
            <span className="grow">Дела отменены — день ушёл на восстановление</span>
          </li>
        ) : null}
        {rec.outcomes.map((o, i) => {
          const Icon = ICON[o.id]
          return (
            <li key={i} className="ls-report-row">
              <Icon size={18} aria-hidden />
              <span className="grow">{ACTION_BY_ID[o.id].title}</span>
              {o.id === 'rest' ? (
                <span className="ls-stat is-plus">+{Math.round(o.energy)} энергии</span>
              ) : (
                <>
                  <span className={cx('ls-stat', o.apps ? 'is-gold' : 'is-dim')}>
                    +{o.apps} {appsWord(o.apps)}
                  </span>
                  <span className="ls-stat is-mint">+{Math.round(o.interest)} интереса</span>
                </>
              )}
            </li>
          )
        })}
        {rec.bonusApps > 0 ? (
          <li className="ls-report-row">
            <Sparkles size={18} aria-hidden />
            <span className="grow">Реликвии помогли</span>
            <span className="ls-stat is-gold">
              +{rec.bonusApps} {appsWord(rec.bonusApps)}
            </span>
          </li>
        ) : null}
      </ul>
      {rec.eventId && rec.result ? (
        <blockquote className="ls-result">
          <p>{rec.result}</p>
          <div className="row-wrap">
            {rec.eventApps > 0 ? (
              <span className="badge">
                +{rec.eventApps} {appsWord(rec.eventApps)}
              </span>
            ) : null}
            {rec.trustDelta > 0 ? <span className="badge badge-mint">Доверие +{rec.trustDelta}</span> : null}
            {rec.trustDelta < 0 ? <span className="badge badge-ember">Доверие −{-rec.trustDelta}</span> : null}
          </div>
        </blockquote>
      ) : null}
      <p className="small muted">
        За день: энергия {signed(energyDelta)}, интерес {signed(interestDelta)} (к вечеру интерес немного остывает).
      </p>
      {rec.burnout ? (
        <p className="small ember ls-warn">
          <TriangleAlert size={16} aria-hidden /> Энергия на нуле. {last ? 'Хорошо, что это последний день.' : 'Завтра организм возьмёт выходной сам.'}
        </p>
      ) : null}
      <div className="ls-actions">
        <Button variant="lit" onClick={onNext} sound={false}>
          {last ? 'К итогам' : 'Следующий день'}
        </Button>
      </div>
    </>
  )
}

function ActionTable({ summary }: { summary: ReturnType<typeof summarize> }) {
  const rows = ACTIONS.filter((a) => summary.byAction[a.id].uses > 0)
  if (!rows.length) return null
  return (
    <table className="ls-table">
      <caption className="sr-only">Сколько заявок принесло каждое дело</caption>
      <thead>
        <tr>
          <th scope="col">Дело</th>
          <th scope="col">Раз</th>
          <th scope="col">Заявки</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <th scope="row">{a.title}</th>
            <td className="num">{summary.byAction[a.id].uses}</td>
            <td className="num">{a.id === 'rest' ? 'силы' : summary.byAction[a.id].apps}</td>
          </tr>
        ))}
        {summary.eventApps > 0 ? (
          <tr>
            <th scope="row">События Бури</th>
            <td className="num">—</td>
            <td className="num">{summary.eventApps}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  )
}

export default LaunchSim
