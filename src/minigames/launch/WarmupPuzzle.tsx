import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import {
  Check,
  Ghost,
  Gift,
  HeartCrack,
  Info,
  MessagesSquare,
  RotateCcw,
  Route,
  ScrollText,
  Tag,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { sfx, stinger } from '../../audio/engine'
import { Button } from '../../ui/Button'
import { randomSeed } from './rng'
import { WARMUP_STAGES } from './stages'
import { useCalm, cx } from './useCalm'
import { createWarmup, isSolved, pick, praise, remaining, type WarmupState } from './warmup'
import './launch.css'

export { WARMUP_STAGES } from './stages'
export type { WarmupStage } from './stages'

export interface WarmupPuzzleProps {
  onSolved: (result: { mistakes: number }) => void
}

const ICONS: Record<string, LucideIcon> = {
  intro: UserRound,
  problem: HeartCrack,
  myths: Ghost,
  cases: ScrollText,
  method: Route,
  value: Gift,
  offer: Tag,
  faq: MessagesSquare,
}

type Feedback =
  | { kind: 'idle' }
  | { kind: 'ok'; stage: number }
  | { kind: 'miss'; stage: number; hint: string; n: number }

const SHAKE: Keyframe[] = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-7px) rotate(-1deg)' },
  { transform: 'translateX(6px) rotate(1deg)' },
  { transform: 'translateX(-4px)' },
  { transform: 'translateX(3px)' },
  { transform: 'translateX(0)' },
]

export function WarmupPuzzle({ onSolved }: WarmupPuzzleProps) {
  const calm = useCalm()
  const uid = useId()
  const [game, setGame] = useState<WarmupState>(() => createWarmup(randomSeed()))
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' })
  const [missId, setMissId] = useState<number | null>(null)
  const cards = useRef(new Map<number, HTMLButtonElement>())
  const focusAfter = useRef<number | null>(null)
  const missTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const done = isSolved(game)
  const left = remaining(game)

  useEffect(() => () => {
    if (missTimer.current) clearTimeout(missTimer.current)
  }, [])

  // после удачного хода фокус переходит на соседнюю карточку — чтобы с клавиатуры играть без мыши
  useEffect(() => {
    if (focusAfter.current === null || isSolved(game)) return
    const rest = remaining(game)
    const idx = Math.min(focusAfter.current, rest.length - 1)
    focusAfter.current = null
    cards.current.get(rest[idx])?.focus({ preventScroll: true })
  }, [game])

  const choose = (stage: number) => {
    if (done) return
    const res = pick(game, stage)
    if (res.ok) {
      focusAfter.current = Math.max(0, left.indexOf(stage))
      setGame(res.state)
      setFeedback({ kind: 'ok', stage })
      setMissId(null)
      if (res.done) {
        sfx('unlock')
        stinger('quest')
      } else {
        sfx('whoosh')
      }
      return
    }
    setGame(res.state)
    setFeedback((f) => ({ kind: 'miss', stage, hint: res.hint, n: f.kind === 'miss' ? f.n + 1 : 1 }))
    setMissId(stage)
    sfx('error')
    const el = cards.current.get(stage)
    if (el && !calm) el.animate(SHAKE, { duration: 380, easing: 'ease-out' })
    if (missTimer.current) clearTimeout(missTimer.current)
    missTimer.current = setTimeout(() => setMissId(null), 900)
  }

  const restart = () => {
    setGame(createWarmup(randomSeed()))
    setFeedback({ kind: 'idle' })
    setMissId(null)
    sfx('page')
  }

  const verdict = praise(game.mistakes)

  return (
    <MotionConfig reducedMotion={calm ? 'always' : 'never'}>
      <section className="ls-game ls-warmup" aria-labelledby={`${uid}-title`}>
        <header className="ls-head">
          <p className="ls-kicker">Площадь Запуска</p>
          <h2 id={`${uid}-title`} className="display t-31">
            Линия прогрева
          </h2>
          <p className="lead">
            Разложи восемь этапов в том порядке, в каком аудитория проходит путь от «кто это?» до «хочу записаться».
          </p>
        </header>

        <div className="ls-toolbar">
          <span className="badge">
            На линии: {game.placed} из {WARMUP_STAGES.length}
          </span>
          <span className={cx('badge', game.mistakes ? 'badge-ember' : 'badge-mint')}>Ошибок: {game.mistakes}</span>
          <Button variant="quiet" size="sm" icon={<RotateCcw size={16} aria-hidden />} onClick={restart} sound={false}>
            Начать заново
          </Button>
        </div>

        <LayoutGroup>
          <ol className="ls-line" aria-label="Линия прогрева">
            {WARMUP_STAGES.map((st, i) => {
              const filled = i < game.placed
              const next = i === game.placed && !done
              return (
                <li key={st.id} className={cx('ls-slot', filled && 'is-filled', next && 'is-next')}>
                  <span className="ls-bulb" aria-hidden="true">
                    {i + 1}
                  </span>
                  {filled ? (
                    <motion.span
                      layoutId={`${uid}-stage-${st.id}`}
                      className="ls-slot-title"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    >
                      {st.title}
                    </motion.span>
                  ) : (
                    <span className="ls-slot-empty">
                      <span className="sr-only">Шаг {i + 1}: </span>
                      {next ? 'Следующий шаг' : 'Пусто'}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>

          <div className={cx('ls-feedback', `is-${feedback.kind}`)} aria-live="polite" id={`${uid}-feedback`}>
            {feedback.kind === 'idle' ? (
              <>
                <Info size={18} aria-hidden className="ls-feedback-icon" />
                <p>
                  Какой шаг нужен аудитории первым? Выбирай карточки по одной — мышью, пальцем или клавишами Tab и
                  Enter.
                </p>
              </>
            ) : feedback.kind === 'ok' ? (
              <>
                <Check size={18} aria-hidden className="ls-feedback-icon" />
                <p>
                  <strong>Верно: «{WARMUP_STAGES[feedback.stage].title}».</strong> {WARMUP_STAGES[feedback.stage].why}
                </p>
              </>
            ) : (
              <>
                <TriangleAlert size={18} aria-hidden className="ls-feedback-icon" />
                <p key={feedback.n}>{feedback.hint}</p>
              </>
            )}
          </div>

          {!done ? (
            <div className="ls-deck">
              <AnimatePresence initial={false} mode="popLayout">
                {left.map((i) => {
                  const st = WARMUP_STAGES[i]
                  const Icon = ICONS[st.id] ?? Info
                  return (
                    <motion.button
                      key={st.id}
                      layout
                      type="button"
                      ref={(el: HTMLButtonElement | null) => {
                        if (el) cards.current.set(i, el)
                        else cards.current.delete(i)
                      }}
                      className={cx('ls-card', missId === i && 'is-miss')}
                      onClick={() => choose(i)}
                      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      aria-describedby={missId === i ? `${uid}-feedback` : undefined}
                    >
                      <span className="ls-card-icon" aria-hidden="true">
                        <Icon size={20} />
                      </span>
                      <motion.span
                        layoutId={`${uid}-stage-${st.id}`}
                        className="ls-card-title"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      >
                        {st.title}
                      </motion.span>
                    </motion.button>
                  )
                })}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              className="ls-done panel panel-pad"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="stack">
                <h3 className="display t-25 gold">{verdict.title}</h3>
                <p className="muted">{verdict.text}</p>
              </div>
              <details className="ls-recap">
                <summary>Почему именно такой порядок</summary>
                <ol>
                  {WARMUP_STAGES.map((st) => (
                    <li key={st.id}>
                      <strong>{st.title}.</strong> <span className="muted">{st.why}</span>
                      <span className="ls-recap-example">
                        <span className="faint">Пример: </span>
                        {st.content}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
              <div className="ls-actions">
                <Button variant="lit" size="lg" autoFocus onClick={() => onSolved({ mistakes: game.mistakes })}>
                  Дальше
                </Button>
                <Button variant="quiet" onClick={restart} sound={false}>
                  Пройти ещё раз
                </Button>
              </div>
            </motion.div>
          )}
        </LayoutGroup>
      </section>
    </MotionConfig>
  )
}

export default WarmupPuzzle
