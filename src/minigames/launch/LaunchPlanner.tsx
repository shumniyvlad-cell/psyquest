import { useId, useMemo, useState } from 'react'
import { CalendarDays, Save, Undo2 } from 'lucide-react'
import { sfx } from '../../audio/engine'
import type { Channel, LaunchDay } from '../../game/types'
import { Button } from '../../ui/Button'
import {
  buildPlan,
  CHANNEL_LABEL,
  FORMAT_TIP,
  isValidISO,
  parseISO,
  PLAN_LENGTHS,
  snapLength,
  toLaunchDays,
  todayISO,
  tomorrowISO,
  type PlanLength,
} from './planner'
import { plural } from './rng'
import { FAMILY_LABEL, type StageFamily } from './stages'
import { cx } from './useCalm'
import './launch.css'

export interface LaunchPlannerProps {
  startDate?: string
  days?: number
  channel: Channel
  onDone: (plan: { startDate: string; days: LaunchDay[] }) => void
}

const FAMILY_BADGE: Record<StageFamily, string> = {
  contact: 'badge',
  trust: 'badge badge-mint',
  sale: 'badge ls-badge-rose',
}

const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })
const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const longDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })

const fmt = (f: Intl.DateTimeFormat, iso: string) => {
  const d = parseISO(iso)
  return d ? f.format(d) : iso
}

const daysWord = (n: number) => plural(n, ['день', 'дня', 'дней'])

export function LaunchPlanner({ startDate, days, channel, onDone }: LaunchPlannerProps) {
  const uid = useId()
  const initialStart = startDate && isValidISO(startDate) ? startDate : tomorrowISO()
  const [start, setStart] = useState(initialStart)
  const [dateInput, setDateInput] = useState(initialStart)
  const [len, setLen] = useState<PlanLength>(() => snapLength(days ?? 7))
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const rows = useMemo(() => buildPlan(start, len, channel, edits), [start, len, channel, edits])
  const empty = rows.filter((r) => !r.content.trim()).map((r) => r.day)
  const dateOk = isValidISO(dateInput)
  const inPast = dateOk && dateInput < todayISO()
  const finish = rows[rows.length - 1]?.date ?? start

  const onDate = (value: string) => {
    setDateInput(value)
    if (isValidISO(value)) setStart(value)
    setSaved(false)
  }

  const edit = (key: string, value: string) => {
    setEdits((e) => ({ ...e, [key]: value }))
    setSaved(false)
  }

  const resetText = (key: string) => {
    setEdits((e) => {
      const next = { ...e }
      delete next[key]
      return next
    })
    sfx('page')
    setSaved(false)
  }

  const save = () => {
    if (empty.length || !dateOk) {
      sfx('error')
      return
    }
    sfx('success')
    setSaved(true)
    onDone({ startDate: start, days: toLaunchDays(rows) })
  }

  return (
    <section className="ls-game ls-planner" aria-labelledby={`${uid}-title`}>
      <header className="ls-head">
        <p className="ls-kicker">Площадь Запуска</p>
        <h2 id={`${uid}-title`} className="display t-31">
          План запуска
        </h2>
        <p className="lead">
          Прогрев по дням: дата, этап и черновик контента под твой канал. Черновики — отправная точка, перепиши их
          своими словами.
        </p>
      </header>

      <div className="panel panel-pad ls-plan-controls">
        <div className="field">
          <label className="field-label" htmlFor={`${uid}-date`}>
            Старт прогрева
          </label>
          <div className="ls-date">
            <CalendarDays size={18} aria-hidden className="ls-date-icon" />
            <input
              id={`${uid}-date`}
              type="date"
              className="input"
              value={dateInput}
              min={todayISO()}
              onChange={(e) => onDate(e.target.value)}
              aria-describedby={`${uid}-date-hint`}
              aria-invalid={!dateOk}
            />
          </div>
          <div className="field-hint" id={`${uid}-date-hint`}>
            {!dateOk
              ? 'Укажи дату старта — без неё план не собрать.'
              : inPast
                ? 'Эта дата уже прошла. План сохранится, но честнее начать с завтрашнего дня.'
                : `Финал запуска — ${fmt(longDate, finish)}.`}
          </div>
        </div>

        <div className="field">
          <span className="field-label" id={`${uid}-len`}>
            Длительность
          </span>
          <div className="row-wrap" role="group" aria-labelledby={`${uid}-len`}>
            {PLAN_LENGTHS.map((n) => (
              <button
                key={n}
                type="button"
                className="chip"
                aria-pressed={len === n}
                onClick={() => {
                  setLen(n)
                  setSaved(false)
                  sfx('select')
                }}
              >
                {n} {daysWord(n)}
              </button>
            ))}
          </div>
          <div className="field-hint">
            {len === 7
              ? 'Плотный прогрев: метод и полезность идут одним днём.'
              : len === 10
                ? 'Спокойный темп: кейсам и закрытию набора — по два дня.'
                : 'Бережный темп: важным этапам — по два дня, без спешки.'}
          </div>
        </div>

        <div className="ls-plan-meta">
          <span className="badge">Канал: {CHANNEL_LABEL[channel] ?? channel}</span>
          <span className="badge">
            {rows.length} {daysWord(rows.length)}
          </span>
        </div>
      </div>

      <ol className="ls-days" aria-label="Дни запуска">
        {rows.map((r) => {
          const edited = r.content !== r.defaultText
          const textId = `${uid}-text-${r.day}`
          return (
            <li key={r.key} className={cx('ls-day', `ls-fam-${r.family}`)}>
              <div className="ls-day-date" aria-hidden="true">
                <span className="ls-day-n">День {r.day}</span>
                <span className="ls-day-dm">{fmt(dayMonth, r.date)}</span>
                <span className="ls-day-wd">{fmt(weekday, r.date)}</span>
              </div>
              <div className="ls-day-body">
                <div className="ls-day-head">
                  <span className={FAMILY_BADGE[r.family]}>{FAMILY_LABEL[r.family]}</span>
                  <h3 className="ls-day-stage">{r.stage}</h3>
                </div>
                <label className="sr-only" htmlFor={textId}>
                  День {r.day}, {fmt(longDate, r.date)}: контент для этапа «{r.stage}»
                </label>
                <textarea
                  id={textId}
                  className={cx('textarea ls-day-text', !r.content.trim() && 'is-empty')}
                  value={r.content}
                  rows={3}
                  onChange={(e) => edit(r.key, e.target.value)}
                />
                <div className="ls-day-foot">
                  <span className="field-hint">
                    <strong className="ls-format">{r.format}.</strong> {FORMAT_TIP[r.format] ?? ''}
                  </span>
                  {edited ? (
                    <Button
                      variant="quiet"
                      size="sm"
                      icon={<Undo2 size={15} aria-hidden />}
                      onClick={() => resetText(r.key)}
                      sound={false}
                    >
                      Вернуть черновик
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="ls-plan-foot panel panel-pad">
        <p className={cx('small', empty.length ? 'ember' : 'muted', !empty.length && !saved && 'ls-plan-note')} aria-live="polite">
          {empty.length
            ? `Не хватает текста для ${empty.length === 1 ? 'дня' : 'дней'}: ${empty.join(', ')}.`
            : saved
              ? 'План сохранён. Его можно поправить в любой момент — это черновик, а не контракт.'
              : 'Один день — одно понятное действие. Если день выпал, план сдвигается, а не рушится.'}
        </p>
        <Button
          variant="lit"
          size="lg"
          icon={<Save size={18} aria-hidden />}
          onClick={save}
          disabled={!!empty.length || !dateOk}
          sound={false}
        >
          Сохранить план
        </Button>
      </div>
    </section>
  )
}

export default LaunchPlanner
