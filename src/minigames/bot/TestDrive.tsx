import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CircleCheck, CircleX, FastForward, Hourglass, MessageCircle, Play, RotateCcw, SkipForward, TriangleAlert } from 'lucide-react'
import type { BotConfig } from '../../game/types'
import { sfx, stinger } from '../../audio/engine'
import { Bar } from '../../ui/Bar'
import { Button } from '../../ui/Button'
import { Golem, type GolemMood } from './Golem'
import { STEP_TITLE, exportableConfig, type BotIssue, type BotStep } from './model'
import { GOLEM_HURT, GOLEM_IDLE, PERSONAS, simulate, type PersonaRun, type SimResult } from './sim'
import { formatClock, type ChatMessage } from './flow'
import { plural, useReducedMotionPref } from './util'

export interface TestDriveReport {
  personas: number
  passed: number
  issues: BotIssue[]
}

type Phase = 'idle' | 'running' | 'done'
export type PersonaStatus = 'waiting' | 'running' | 'passed' | 'dropped'

interface State {
  phase: Phase
  sim: SimResult | null
  idx: number
  shown: number
  finished: number
  view: number
  key: string
  run: number
}

const configKey = (cfg: BotConfig) => JSON.stringify(exportableConfig(cfg))

const INITIAL: State = { phase: 'idle', sim: null, idx: 0, shown: 0, finished: 0, view: 0, key: '', run: 0 }

export interface TestDrive {
  phase: Phase
  sim: SimResult | null
  /** Что показать в телефоне */
  transcript: ChatMessage[]
  typing: boolean
  clock: string
  /** Чью переписку показывает телефон */
  viewIndex: number
  activeIndex: number
  statuses: PersonaStatus[]
  mood: GolemMood
  line: string
  cracks: number
  stale: boolean
  fast: boolean
  start: () => void
  skip: () => void
  setFast: (v: boolean) => void
  view: (i: number) => void
}

export function useTestDrive(cfg: BotConfig, onPassed: (report: TestDriveReport) => void): TestDrive {
  const [st, setSt] = useState<State>(INITIAL)
  const [fast, setFast] = useState(false)
  const reduced = useReducedMotionPref()
  const onPassedRef = useRef(onPassed)
  useEffect(() => {
    onPassedRef.current = onPassed
  }, [onPassed])
  const reportedRef = useRef(0)
  const key = useMemo(() => configKey(cfg), [cfg])

  const report = (sim: SimResult, run: number) => {
    if (reportedRef.current === run) return
    reportedRef.current = run
    if (sim.passed === sim.runs.length) {
      stinger('victory')
      onPassedRef.current({ personas: sim.runs.length, passed: sim.passed, issues: sim.issues })
    } else {
      stinger('defeat')
    }
  }

  const start = () => {
    const sim = simulate(cfg)
    sfx('magic')
    setSt((s) => ({ phase: 'running', sim, idx: 0, shown: 0, finished: 0, view: 0, key, run: s.run + 1 }))
  }

  const skip = () => {
    if (st.phase !== 'running' || !st.sim) return
    const sim = st.sim
    const n = sim.runs.length
    const firstFail = sim.runs.findIndex((r) => !r.passed)
    setSt((s) => ({
      ...s,
      phase: 'done',
      idx: n - 1,
      shown: sim.runs[n - 1].messages.length,
      finished: n,
      view: firstFail >= 0 ? firstFail : n - 1,
    }))
    report(sim, st.run)
  }

  useEffect(() => {
    if (st.phase !== 'running' || !st.sim) return
    const sim = st.sim
    const cur = sim.runs[st.idx]
    const k = (fast ? 0.35 : 1) * (reduced ? 0.6 : 1)
    if (st.shown < cur.messages.length) {
      const next = cur.messages[st.shown]
      const base = next.from === 'bot' ? 720 : next.from === 'user' ? 540 : next.from === 'divider' ? 720 : 480
      const id = window.setTimeout(() => {
        if (next.from === 'bot') sfx('type')
        setSt((s) => (s.run === st.run ? { ...s, shown: s.shown + 1 } : s))
      }, base * k)
      return () => window.clearTimeout(id)
    }
    if (st.finished <= st.idx) {
      const id = window.setTimeout(() => {
        sfx(cur.passed ? 'success' : 'hurt')
        setSt((s) => (s.run === st.run ? { ...s, finished: s.idx + 1 } : s))
      }, 220 * k)
      return () => window.clearTimeout(id)
    }
    const id = window.setTimeout(
      () => {
        if (st.idx + 1 < sim.runs.length) {
          setSt((s) => (s.run === st.run ? { ...s, idx: s.idx + 1, shown: 0, view: s.idx + 1 } : s))
        } else {
          const firstFail = sim.runs.findIndex((r) => !r.passed)
          setSt((s) => (s.run === st.run ? { ...s, phase: 'done', view: firstFail >= 0 ? firstFail : s.view } : s))
          report(sim, st.run)
        }
      },
      (cur.passed ? 1200 : 2400) * k,
    )
    return () => window.clearTimeout(id)
  }, [st, fast, reduced])

  const sim = st.sim
  const running = st.phase === 'running'
  const viewIndex = running ? st.idx : st.view
  const viewRun = sim?.runs[viewIndex]
  const transcript = viewRun ? (running ? viewRun.messages.slice(0, st.shown) : viewRun.messages) : []
  const nextMsg = running && viewRun ? viewRun.messages[st.shown] : undefined
  const typing = !!nextMsg && nextMsg.from === 'bot'
  const clock = transcript.length
    ? transcript[transcript.length - 1].time
    : formatClock(PERSONAS[viewIndex]?.startAt ?? 0)

  const statuses: PersonaStatus[] = PERSONAS.map((_, i) => {
    if (!sim) return 'waiting'
    if (i < st.finished) return sim.runs[i].passed ? 'passed' : 'dropped'
    if (running && i === st.idx) return 'running'
    return 'waiting'
  })

  let mood: GolemMood = 'idle'
  let line = GOLEM_IDLE
  let cracks = 0
  if (sim) {
    const done = sim.runs.slice(0, st.finished)
    cracks = done.filter((r) => r.passed).length
    const last = done[done.length - 1]
    if (st.phase === 'done') {
      if (sim.passed === sim.runs.length) {
        mood = 'defeated'
        line = ''
      } else {
        const fail = sim.runs.find((r) => !r.passed)
        mood = fail?.dropStep === 'crisis' ? 'grave' : 'gloat'
        line = fail?.taunt ?? ''
      }
    } else if (last) {
      if (last.passed) {
        mood = 'hurt'
        line = GOLEM_HURT
      } else {
        mood = last.dropStep === 'crisis' ? 'grave' : 'gloat'
        line = last.taunt ?? ''
      }
    } else {
      mood = 'watch'
      line = 'Бип. Посмотрим, кому этой ночью ответит тишина.'
    }
  }

  return {
    phase: st.phase,
    sim,
    transcript,
    typing,
    clock,
    viewIndex,
    activeIndex: st.idx,
    statuses,
    mood,
    line,
    cracks,
    stale: st.phase === 'done' && st.key !== key,
    fast,
    start,
    skip,
    setFast,
    view: (i: number) => setSt((s) => (s.phase === 'done' ? { ...s, view: i } : s)),
  }
}

// ---------- Панель ----------

interface TestDrivePanelProps {
  td: TestDrive
  /** Телефон внутри панели (мобильная раскладка) */
  phone?: ReactNode
  onStart: () => void
  onFix: (step: BotStep) => void
  onViewPersona: (i: number) => void
  errorCount: number
}

export function TestDrivePanel({ td, phone, onStart, onFix, onViewPersona, errorCount }: TestDrivePanelProps) {
  const sim = td.sim
  const running = td.phase === 'running'
  const won = td.phase === 'done' && !!sim && sim.passed === sim.runs.length
  const warns = sim && td.phase === 'done' ? sim.issues.filter((i) => i.severity === 'warn') : []

  return (
    <section className="panel bb-sec bb-td" aria-labelledby="bb-td-title">
      <div className="bb-sec-head">
        <div className="stack" style={{ '--gap': '4px' } as CSSProperties}>
          <h3 className="display t-20" id="bb-td-title">
            Тест-драйв
          </h3>
          <p className="small muted">
            Три виртуальных клиента пройдут воронку. Дойдут все — Голем Молчания рассыплется.
          </p>
        </div>
      </div>

      <div className="bb-arena" data-mood={td.mood}>
        <Golem key={td.mood === 'gloat' ? td.line : 'golem'} mood={td.mood} cracks={td.cracks} />
        <div className="bb-arena-say">
          {won ? (
            <div className="bb-victory" role="status">
              <div className="display t-20 mint">Голем Молчания повержен</div>
              <p className="small">Все трое дошли до цели, а бот ответил даже в три часа ночи. Можно запускать.</p>
            </div>
          ) : td.line ? (
            <div className="bb-speech" key={td.line} data-mood={td.mood} role="status">
              {td.line}
            </div>
          ) : null}
        </div>
        <div className="bb-arena-act">
          <div className="row-wrap">
            {running ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<FastForward size={16} />}
                  aria-pressed={td.fast}
                  onClick={() => td.setFast(!td.fast)}
                >
                  {td.fast ? 'Обычная скорость' : 'Быстрее'}
                </Button>
                <Button variant="quiet" size="sm" icon={<SkipForward size={16} />} onClick={td.skip}>
                  Показать итог
                </Button>
              </>
            ) : (
              <Button
                variant={td.phase === 'done' && !td.stale && won ? 'ghost' : 'lit'}
                icon={td.phase === 'done' ? <RotateCcw size={18} /> : <Play size={18} />}
                onClick={onStart}
                sound={false}
              >
                {td.phase === 'done' ? 'Прогнать ещё раз' : 'Запустить тест-драйв'}
              </Button>
            )}
          </div>
          {td.phase === 'idle' && errorCount > 0 ? (
            <p className="tiny faint">
              На этажах {errorCount} {plural(errorCount, 'ошибка', 'ошибки', 'ошибок')} — Голем уже потирает каменные руки.
            </p>
          ) : null}
        </div>
      </div>

      {phone ? <div className="bb-td-phone">{phone}</div> : null}

      <ul className="bb-personas" aria-label="Виртуальные клиенты">
        {PERSONAS.map((p, i) => (
          <PersonaCard
            key={p.id}
            index={i}
            status={td.statuses[i]}
            run={sim?.runs[i]}
            selected={td.phase !== 'idle' && td.viewIndex === i}
            canView={td.phase === 'done'}
            onView={() => onViewPersona(i)}
            onFix={onFix}
          />
        ))}
      </ul>

      {td.phase === 'done' && sim ? (
        <div className="bb-td-sum">
          <div className="spread">
            <span className="small muted">Оценка воронки</span>
            <span className="num gold">
              {sim.score} из 100
            </span>
          </div>
          <Bar value={sim.score} max={100} variant={won ? 'mint' : 'ember'} label="Оценка воронки" />
          <p className="small">
            {won
              ? warns.length
                ? `Дошли все трое. ${warns.length} ${plural(warns.length, 'замечание снижает', 'замечания снижают', 'замечаний снижают')} оценку — поправь, если есть минутка.`
                : 'Дошли все трое и без единого замечания. Чистая работа.'
              : `Дошли ${sim.passed} из ${sim.runs.length}. Исправь этажи, подсвеченные красным, и прогони ещё раз.`}
          </p>
          {warns.length ? (
            <ul className="bb-issues">
              {warns.map((w) => (
                <li key={w.id} data-sev="warn">
                  <TriangleAlert size={15} aria-hidden="true" />
                  <span>
                    {w.text}{' '}
                    <button type="button" className="bb-linkbtn" onClick={() => onFix(w.step)}>
                      Этаж «{STEP_TITLE[w.step]}»
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {td.stale ? (
            <p className="tiny bb-stale" role="status">
              Сценарий поменялся после теста — результаты устарели. Прогони ещё раз.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

interface PersonaCardProps {
  index: number
  status: PersonaStatus
  run?: PersonaRun
  selected: boolean
  canView: boolean
  onView: () => void
  onFix: (step: BotStep) => void
}

function PersonaCard({ index, status, run, selected, canView, onView, onFix }: PersonaCardProps) {
  const p = PERSONAS[index]
  const icon =
    status === 'passed' ? (
      <CircleCheck size={15} aria-hidden="true" />
    ) : status === 'dropped' ? (
      <CircleX size={15} aria-hidden="true" />
    ) : status === 'running' ? (
      <MessageCircle size={15} aria-hidden="true" />
    ) : (
      <Hourglass size={15} aria-hidden="true" />
    )
  const text =
    status === 'waiting'
      ? 'Ждёт своей очереди'
      : status === 'running'
        ? `Пишет боту в ${formatClock(p.startAt)}`
        : (run?.status ?? '')
  const detail = status === 'passed' || status === 'dropped' ? run?.detail : undefined
  const dropStep = status === 'dropped' ? run?.dropStep : undefined
  return (
    <li className="bb-persona" data-status={status} data-selected={selected || undefined}>
      <span className="bb-persona-ava" data-p={p.id} aria-hidden="true">
        {p.name[0]}
      </span>
      <div className="bb-persona-main">
        <div className="bb-persona-name">
          {p.name}, {p.age}
        </div>
        <div className="bb-persona-about">{p.about}</div>
        <div className="bb-persona-status" aria-live="polite">
          {icon}
          <span>{text}</span>
        </div>
        {detail ? <div className="bb-persona-detail">{detail}</div> : null}
        {canView ? (
          <div className="bb-persona-actions">
            <button type="button" className="bb-linkbtn" onClick={onView} aria-pressed={selected}>
              {selected ? 'Переписка в телефоне' : 'Показать переписку'}
            </button>
            {dropStep ? (
              <button type="button" className="bb-linkbtn bb-linkbtn-ember" onClick={() => onFix(dropStep)}>
                Открыть этаж «{STEP_TITLE[dropStep]}»
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}
