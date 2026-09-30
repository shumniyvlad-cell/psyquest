import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import {
  BookOpen,
  CalendarX,
  Footprints,
  GraduationCap,
  HandHeart,
  PhoneOff,
  RotateCcw,
  Share2,
  Tag,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { sfx, stinger } from '../../audio/engine'
import { Button } from '../../ui/Button'
import {
  CARD_BY_ID,
  createBalance,
  demonPower,
  greenRange,
  insight,
  MAX_TURNS,
  nextTurn,
  playCard,
  previewCard,
  randomSeed,
  RED_HIGH,
  RED_LIMIT,
  RED_LOW,
  SCALES,
  WIN_TURNS,
  zoneOf,
  zonesOf,
  type BalanceCard,
  type BalanceState,
  type ScaleId,
  type Zone,
} from './balanceLogic'
import { EmberDemon } from './EmberDemon'
import './balance.css'

export interface BurnoutBalanceProps {
  resilience: number
  clients: number
  onFinish: (won: boolean) => void
  /** Зерно для повторяемой партии (необязательно) */
  seed?: number
}

const CARD_ICON: Record<string, LucideIcon> = {
  supervision: BookOpen,
  therapy: HandHeart,
  offline: PhoneOff,
  more: UserPlus,
  referral: Share2,
  price: Tag,
  walk: Footprints,
  course: GraduationCap,
  cancel: CalendarX,
}

const ZONE_LABEL: Record<Zone, string> = {
  green: 'в зелёной зоне',
  yellow: 'на грани',
  red: 'красная зона',
}

const TITLE: Record<ScaleId, string> = { work: 'Работа', recovery: 'Восстановление', growth: 'Развитие' }

const signed = (v: number) => (v > 0 ? `+${Math.round(v)}` : v < 0 ? `−${Math.abs(Math.round(v))}` : '0')
const listRu = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} и ${items[items.length - 1]}`

function useCalm() {
  const os = useReducedMotion()
  const attr = typeof document !== 'undefined' ? document.documentElement.dataset.reducedMotion : undefined
  if (attr === 'true') return true
  if (attr === 'false') return false
  return !!os
}

export function BurnoutBalance({ resilience, clients, onFinish, seed }: BurnoutBalanceProps) {
  const calm = useCalm()
  const uid = useId()
  const baseSeed = useMemo(() => seed ?? randomSeed(), [seed])
  const [attempt, setAttempt] = useState(0)
  const make = (n: number) => createBalance({ resilience, clients, seed: (baseSeed + n * 104729) >>> 0 })
  const [game, setGame] = useState<BalanceState>(() => make(0))
  const [started, setStarted] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [flare, setFlare] = useState(0)
  const announced = useRef('')
  const interacted = useRef(false)
  const finishRef = useRef(onFinish)
  useEffect(() => {
    finishRef.current = onFinish
  })

  const headRef = useCallback(
    (el: HTMLHeadingElement | null) => {
      if (!el || !interacted.current) return
      el.focus({ preventScroll: true })
      el.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' })
    },
    [calm],
  )

  // поражение сообщаем сразу (мягко: экран с выводом и повтором остаётся), победу — по кнопке «Дальше»
  useEffect(() => {
    const key = `${attempt}-${game.phase}`
    if (announced.current === key) return
    if (game.phase === 'lost') {
      announced.current = key
      stinger('defeat')
      finishRef.current(false)
    } else if (game.phase === 'won') {
      announced.current = key
      stinger('victory')
    }
  }, [game.phase, attempt])

  const preview = hover && game.phase === 'play' ? previewCard(game, hover) : null
  const last = game.history[game.history.length - 1]
  const result = game.phase === 'won' || game.phase === 'lost' ? insight(game) : null
  const zones = zonesOf(game)

  const play = (cardId: string) => {
    interacted.current = true
    const next = playCard(game, cardId)
    if (next === game) return
    setGame(next)
    setHover(null)
    const rec = next.history[next.history.length - 1]
    if (rec?.red.length) {
      setFlare((f) => f + 1)
      sfx('hurt')
    } else if (rec?.green) sfx('heal')
    else sfx('select')
  }

  const advance = () => {
    interacted.current = true
    setGame(nextTurn(game))
    sfx('page')
  }

  const restart = () => {
    interacted.current = true
    const n = attempt + 1
    setAttempt(n)
    setGame(make(n))
    setHover(null)
    setStarted(true)
    sfx('page')
  }

  const phaseKey = `${started}-${game.phase}-${game.turn}-${attempt}`

  return (
    <MotionConfig reducedMotion={calm ? 'always' : 'never'}>
      <section className="bl-game" aria-labelledby={`${uid}-title`}>
        <div className="bl-stage panel">
          <EmberDemon power={demonPower(game)} flare={flare} won={game.phase === 'won'} calm={calm} />
          <div className="bl-stage-top">
            <div>
              <p className="bl-kicker">Маяк, финальный босс</p>
              <h2 id={`${uid}-title`} className="display t-25">
                Демон Выгорания
              </h2>
            </div>
            <span className="badge badge-ember">
              {game.phase === 'won' ? 'Рассеян' : `Неделя ${game.turn} из ${MAX_TURNS}`}
            </span>
          </div>
          <div className="bl-progress" role="img" aria-label={`Недели равновесия: ${game.greenTurns} из ${WIN_TURNS}`}>
            {Array.from({ length: WIN_TURNS }, (_, i) => (
              <span key={i} className={i < game.greenTurns ? 'bl-pip is-on' : 'bl-pip'} />
            ))}
            <span className="bl-progress-text">
              Равновесие: {game.greenTurns} из {WIN_TURNS}
            </span>
          </div>
        </div>

        <div className="bl-scales panel panel-pad">
          {SCALES.map((sc) => (
            <Gauge
              key={sc.id}
              id={sc.id}
              value={game.values[sc.id]}
              preview={preview ? preview[sc.id] : null}
              drift={game.phase === 'play' && game.turn > 0 ? game.lastDrift[sc.id] : null}
              zone={zones[sc.id]}
              redStreak={game.redStreak[sc.id]}
              resilience={game.cfg.resilience}
            />
          ))}
        </div>

        <div className="bl-main panel panel-pad">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phaseKey}
              className="bl-phase"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {!started ? (
                <>
                  <h3 ref={headRef} tabIndex={-1} className="display t-25">
                    Три шкалы и одна неделя за ход
                  </h3>
                  <p className="muted">
                    Демон питается перекосом: когда работы слишком много, отдыха слишком мало, а развитие стоит. Держи
                    все три шкалы в зелёной зоне {WIN_TURNS} недель — и он рассеется.
                  </p>
                  <ul className="bl-rules">
                    <li>
                      Каждую неделю шкалы дрейфуют сами: при {clients}{' '}
                      {clients % 10 === 1 && clients % 100 !== 11 ? 'клиенте' : 'клиентах'} нагрузка растёт, а силы и
                      навыки тают.
                    </li>
                    <li>Из трёх карт выбери одну. Наведи на карту или выдели её с клавиатуры, чтобы увидеть, куда сдвинутся шкалы.</li>
                    <li>
                      Любая шкала в красной зоне {RED_LIMIT} недели подряд — и Демон берёт верх. Стойкость {game.cfg.resilience} расширяет
                      зелёную зону.
                    </li>
                  </ul>
                  <div className="bl-actions">
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
                      Начать бой
                    </Button>
                  </div>
                </>
              ) : game.phase === 'play' ? (
                <>
                  <div className="bl-phase-head">
                    <h3 ref={headRef} tabIndex={-1} className="display t-20">
                      Неделя {game.turn}: что выберешь?
                    </h3>
                    <p className="small muted">
                      Неделя прошла сама по себе: работа {signed(game.lastDrift.work)}, восстановление{' '}
                      {signed(game.lastDrift.recovery)}, развитие {signed(game.lastDrift.growth)}.
                      {last && CARD_BY_ID[last.card]?.afterText ? ` ${CARD_BY_ID[last.card].afterText}.` : ''}
                    </p>
                  </div>
                  <div className="bl-hand">
                    {game.hand.map((cid) => (
                      <CardButton
                        key={cid}
                        card={CARD_BY_ID[cid]}
                        onPlay={() => play(cid)}
                        onPreview={(on) => setHover(on ? cid : null)}
                      />
                    ))}
                  </div>
                </>
              ) : game.phase === 'review' && last ? (
                <Review rec={last} game={game} headRef={headRef} onNext={advance} />
              ) : result ? (
                <>
                  <div className="bl-phase-head">
                    <span className={game.phase === 'won' ? 'badge badge-mint' : 'badge badge-ember'}>
                      {game.phase === 'won' ? 'Победа' : 'Мягкое поражение'}
                    </span>
                    <h3 ref={headRef} tabIndex={-1} className="display t-31">
                      {result.title}
                    </h3>
                    <p className="muted">{result.text}</p>
                  </div>
                  <ul className="bl-insights">
                    {result.lines.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                  <p className="bl-moral">{result.moral}</p>
                  <div className="bl-actions">
                    {game.phase === 'won' ? (
                      <Button variant="lit" size="lg" onClick={() => onFinish(true)}>
                        Дальше
                      </Button>
                    ) : (
                      <Button variant="lit" size="lg" icon={<RotateCcw size={18} aria-hidden />} onClick={restart} sound={false}>
                        Попробовать ещё раз
                      </Button>
                    )}
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

function Gauge({
  id,
  value,
  preview,
  drift,
  zone,
  redStreak,
  resilience,
}: {
  id: ScaleId
  value: number
  preview: number | null
  drift: number | null
  zone: Zone
  redStreak: number
  resilience: number
}) {
  const def = SCALES.find((s) => s.id === id)!
  const [lo, hi] = greenRange(id, resilience)
  const pv = preview !== null ? zoneOf(id, preview, resilience) : null
  const pct = (v: number) => `${Math.max(0, Math.min(100, v))}%`
  return (
    <div className={`bl-gauge is-${zone}`}>
      <div className="bl-gauge-head">
        <span className="bl-gauge-title">{def.title}</span>
        <span className="bl-gauge-hint">{def.hint}</span>
        <span className="bl-gauge-meta">
          <span className="bl-gauge-zone">
            {ZONE_LABEL[zone]}
            {zone === 'red' && redStreak >= 1 ? `, неделя ${redStreak} из ${RED_LIMIT}` : ''}
          </span>
          {drift !== null && Math.abs(drift) >= 0.5 ? <span className="bl-drift">за неделю {signed(drift)}</span> : null}
          <span className="bl-gauge-value num">{Math.round(value)}</span>
        </span>
      </div>
      <div
        className="bl-track"
        role="meter"
        aria-label={def.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${Math.round(value)}, ${ZONE_LABEL[zone]}${preview !== null ? `; после карты — ${Math.round(preview)}, ${ZONE_LABEL[pv!]}` : ''}`}
      >
        <span className="bl-band is-red" style={{ left: 0, width: pct(RED_LOW) }} />
        <span className="bl-band is-yellow" style={{ left: pct(RED_LOW), width: pct(lo - RED_LOW) }} />
        <span className="bl-band is-green" style={{ left: pct(lo), width: pct(hi - lo) }} />
        <span className="bl-band is-yellow" style={{ left: pct(hi), width: pct(RED_HIGH - hi) }} />
        <span className="bl-band is-red" style={{ left: pct(RED_HIGH), width: pct(100 - RED_HIGH) }} />
        {preview !== null ? <span className={`bl-ghost is-${pv}`} style={{ left: pct(preview) }} /> : null}
        <span className="bl-marker" style={{ left: pct(value) }} />
      </div>
      <div className="bl-gauge-foot">
        <span>{def.lowText}</span>
        <span>{def.highText}</span>
      </div>
    </div>
  )
}

function CardButton({ card, onPlay, onPreview }: { card: BalanceCard; onPlay: () => void; onPreview: (on: boolean) => void }) {
  const Icon = CARD_ICON[card.id] ?? BookOpen
  const effects = SCALES.map((s) => ({ id: s.id, title: s.title, v: card.effect[s.id] })).filter((e) => e.v !== 0)
  return (
    <button
      type="button"
      className={`bl-card is-${card.kind}`}
      onClick={onPlay}
      onMouseEnter={() => onPreview(true)}
      onMouseLeave={() => onPreview(false)}
      onFocus={() => onPreview(true)}
      onBlur={() => onPreview(false)}
    >
      <span className="bl-card-top">
        <span className="bl-card-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <span className="bl-card-title">{card.title}</span>
      </span>
      <span className="bl-card-quip">{card.quip}</span>
      <span className="bl-card-fx">
        {effects.map((e) => (
          <span key={e.id} className={`bl-fx is-${e.id}`}>
            {e.title} {signed(e.v)}
          </span>
        ))}
      </span>
      {card.clients ? (
        <span className="bl-card-note">
          {card.clients > 0 ? 'Плюс клиент: нагрузка растёт каждую неделю' : 'Минус клиент: нагрузка ниже каждую неделю'}
        </span>
      ) : null}
      {card.after ? <span className="bl-card-note">Через неделю: {card.afterText?.split(': ').pop()}</span> : null}
    </button>
  )
}

function Review({
  rec,
  game,
  headRef,
  onNext,
}: {
  rec: BalanceState['history'][number]
  game: BalanceState
  headRef: (el: HTMLHeadingElement | null) => void
  onNext: () => void
}) {
  const card = CARD_BY_ID[rec.card]
  const yellow = SCALES.filter((s) => rec.zones[s.id] === 'yellow').map((s) => TITLE[s.id].toLowerCase())
  const red = rec.red.map((id) => TITLE[id].toLowerCase())
  const danger = rec.red.some((id) => game.redStreak[id] >= 1)
  return (
    <>
      <div className="bl-phase-head">
        <span className="badge">{card?.title}</span>
        <h3 ref={headRef} tabIndex={-1} className="display t-25">
          {rec.green ? 'Равновесие держится' : red.length ? 'Демон вспыхнул' : 'Почти'}
        </h3>
        <p className={rec.green ? 'mint' : red.length ? 'ember' : 'muted'}>
          {rec.green
            ? `Все три шкалы в зелёной зоне. Демон тускнеет: ${game.greenTurns} из ${WIN_TURNS}.`
            : red.length
              ? `Красная зона: ${listRu(red)}. ${danger ? 'Ещё неделя в красном — и Демон возьмёт верх.' : ''}`
              : `Равновесие не собрано: ${listRu(yellow)} на грани. Демон ждёт.`}
        </p>
        <p className="small faint">{card?.quip}</p>
      </div>
      <div className="bl-actions">
        <Button variant="lit" onClick={onNext} sound={false}>
          Следующая неделя
        </Button>
      </div>
    </>
  )
}

export default BurnoutBalance
