import { useId, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Check,
  ChevronDown,
  CircleX,
  Info,
  Plus,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import type { BotConfig, BotQuizQuestion } from '../../game/types'
import { sfx } from '../../audio/engine'
import { Button } from '../../ui/Button'
import { CRISIS_MARKERS } from './crisis'
import {
  BOT_STEPS,
  DEFAULT_CONSENT_TEXT,
  DEFAULT_CRISIS_TEXT,
  LIMITS,
  POLICY_PREFIX,
  checkUrl,
  displayUrl,
  formatPrice,
  getPolicyUrl,
  newQuestionId,
  offerMessage,
  setPolicyUrl,
  type BotIssue,
  type BotStep,
} from './model'
import { plural, useReducedMotionPref } from './util'

interface FloorsProps {
  cfg: BotConfig
  issues: BotIssue[]
  open: BotStep | null
  onToggle: (step: BotStep) => void
  update: (patch: Partial<BotConfig>) => void
  /** Мобильная раскладка: кнопка «Посмотреть в телефоне» */
  onPreview?: (step: BotStep) => void
}

const cp = (s: string) => [...s].length

const pick = (issues: BotIssue[], prefix: string) => issues.filter((i) => i.id === prefix || i.id.startsWith(`${prefix}.`))

function Issues({ items }: { items: BotIssue[] }) {
  if (!items.length) return null
  return (
    <ul className="bb-issues">
      {items.map((i) => (
        <li key={i.id} data-sev={i.severity}>
          {i.severity === 'error' ? <CircleX size={15} aria-hidden="true" /> : <TriangleAlert size={15} aria-hidden="true" />}
          <span>{i.text}</span>
        </li>
      ))}
    </ul>
  )
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className="bb-count num" data-over={value > max || undefined}>
      {value} / {max}
    </span>
  )
}

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  count?: { value: number; max: number }
  issues?: BotIssue[]
  children: (id: string) => ReactNode
}

function F({ label, hint, count, issues, children }: FieldProps) {
  const id = useId()
  return (
    <div className="field bb-field">
      <div className="bb-field-top">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {count ? <Counter value={count.value} max={count.max} /> : null}
      </div>
      {children(id)}
      {hint ? <div className="field-hint">{hint}</div> : null}
      {issues ? <Issues items={issues} /> : null}
    </div>
  )
}

function Note({ children, tone = 'lantern' }: { children: ReactNode; tone?: 'lantern' | 'mint' }) {
  return (
    <div className="bb-note-card" data-tone={tone}>
      {tone === 'mint' ? <ShieldCheck size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}
      <div>{children}</div>
    </div>
  )
}

function Resolved({ raw }: { raw: string }) {
  const res = checkUrl(raw)
  if (!raw.trim() || !res.ok || !res.url) return null
  const shown = raw.trim().replace(/^https?:\/\//, '')
  const target = displayUrl(res.url)
  return (
    <div className="field-hint bb-resolved">
      <Check size={13} aria-hidden="true" /> Бот откроет: {/^[\x20-\x7e]+$/.test(shown) ? target : `https://${shown}`}
    </div>
  )
}

function summary(step: BotStep, cfg: BotConfig): string {
  switch (step) {
    case 'welcome':
      return cfg.botName.trim() || 'Без имени'
    case 'consent':
      return cfg.consent ? 'Спрашивает до первого вопроса' : 'Выключено'
    case 'magnet':
      return cfg.leadMagnetTitle.trim() || 'Без названия'
    case 'quiz':
      return cfg.quiz.length ? `${cfg.quiz.length} ${plural(cfg.quiz.length, 'вопрос', 'вопроса', 'вопросов')}` : 'Нет вопросов'
    case 'offer':
      return Number.isFinite(cfg.offerPrice) && cfg.offerPrice > 0 ? formatPrice(cfg.offerPrice) : 'Бесплатно'
    case 'booking':
      return cfg.bookingText.trim() || 'Без текста'
    case 'followup':
      return cfg.followUp.trim() ? 'Одно сообщение через 24 часа' : 'Не задано'
    case 'crisis':
      return !cfg.crisisText.trim()
        ? 'Пусто'
        : cfg.crisisText.trim() === DEFAULT_CRISIS_TEXT
          ? 'Стандартный текст с телефонами помощи'
          : 'Свой текст'
  }
}

export function Floors({ cfg, issues, open, onToggle, update, onPreview }: FloorsProps) {
  const reduced = useReducedMotionPref()
  return (
    <div className="bb-tower" role="list" aria-label="Этажи башни">
      {BOT_STEPS.map((s, i) => {
        const own = issues.filter((x) => x.step === s.id)
        const errors = own.filter((x) => x.severity === 'error').length
        const warns = own.length - errors
        const state = errors ? 'error' : warns ? 'warn' : 'ok'
        const isOpen = open === s.id
        const bodyId = `bb-floor-body-${s.id}`
        return (
          <section
            key={s.id}
            role="listitem"
            className="bb-floor"
            id={`bb-floor-${s.id}`}
            data-state={state}
            data-open={isOpen || undefined}
            data-step={s.id}
          >
            <h3 className="bb-floor-h">
              <button
                type="button"
                className="bb-floor-head"
                aria-expanded={isOpen}
                aria-controls={bodyId}
                onClick={() => onToggle(s.id)}
              >
                <span className="bb-window" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="bb-floor-titles">
                  <span className="bb-floor-title">{s.title}</span>
                  <span className="bb-floor-sum">{summary(s.id, cfg)}</span>
                </span>
                <span className="bb-floor-badges">
                  {errors ? (
                    <span className="badge badge-ember">
                      <CircleX size={13} aria-hidden="true" />
                      <span className="num">{errors}</span>
                      <span className="bb-badge-word">{plural(errors, 'ошибка', 'ошибки', 'ошибок')}</span>
                    </span>
                  ) : null}
                  {warns ? (
                    <span className="badge">
                      <TriangleAlert size={13} aria-hidden="true" />
                      <span className="num">{warns}</span>
                      <span className="bb-badge-word">{plural(warns, 'замечание', 'замечания', 'замечаний')}</span>
                    </span>
                  ) : null}
                  {!errors && !warns ? (
                    <span className="badge badge-mint">
                      <Check size={13} aria-hidden="true" />
                      <span className="bb-badge-word">Светится</span>
                    </span>
                  ) : null}
                </span>
                <ChevronDown size={18} className="bb-chev" aria-hidden="true" />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  key="body"
                  id={bodyId}
                  className="bb-floor-wrap"
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.26, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <div className="bb-floor-body">
                    <FloorBody step={s.id} cfg={cfg} issues={own} update={update} />
                    {onPreview ? (
                      <div className="bb-floor-foot">
                        <Button variant="quiet" size="sm" icon={<Smartphone size={16} />} onClick={() => onPreview(s.id)}>
                          Посмотреть в телефоне
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        )
      })}
    </div>
  )
}

interface BodyProps {
  step: BotStep
  cfg: BotConfig
  issues: BotIssue[]
  update: (patch: Partial<BotConfig>) => void
}

function FloorBody({ step, cfg, issues, update }: BodyProps) {
  switch (step) {
    case 'welcome':
      return (
        <>
          <F
            label="Имя бота"
            hint="Так бот подписан в Telegram. Username с окончанием на bot придумаешь в @BotFather."
            count={cp(cfg.botName) > 40 ? { value: cp(cfg.botName), max: LIMITS.botName } : undefined}
            issues={pick(issues, 'welcome.name')}
          >
            {(id) => (
              <input
                id={id}
                className="input"
                value={cfg.botName}
                maxLength={80}
                placeholder="Например, Анна | психолог"
                onChange={(e) => update({ botName: e.target.value })}
              />
            )}
          </F>
          <F
            label="Приветствие"
            hint="Первое, что человек увидит после «Запустить». Скажи, кто ты и чем поможет бот. И честно: бот не ставит диагнозы и не заменяет консультацию."
            count={{ value: cp(cfg.welcome.trim()), max: LIMITS.message }}
            issues={pick(issues, 'welcome.text')}
          >
            {(id) => (
              <textarea
                id={id}
                className="textarea"
                rows={6}
                value={cfg.welcome}
                onChange={(e) => update({ welcome: e.target.value })}
              />
            )}
          </F>
        </>
      )

    case 'consent': {
      const policy = getPolicyUrl(cfg.consentText)
      const baseText = setPolicyUrl(cfg.consentText, '')
      return (
        <>
          <label className="bb-switch">
            <input
              type="checkbox"
              role="switch"
              checked={cfg.consent}
              onChange={(e) => {
                sfx(e.target.checked ? 'unlock' : 'lock')
                update({
                  consent: e.target.checked,
                  consentText: e.target.checked && !cfg.consentText.trim() ? DEFAULT_CONSENT_TEXT : cfg.consentText,
                })
              }}
            />
            <span className="bb-switch-track" aria-hidden="true" />
            <span>Спрашивать согласие перед вопросами</span>
          </label>
          <Issues items={pick(issues, 'consent.off')} />
          {cfg.consent ? (
            <>
              <F
                label="Текст согласия"
                hint="Скажи простыми словами, что сохраняет бот и зачем. Под сообщением будут кнопки «Даю согласие» и «Не сейчас»."
                count={{ value: cp(cfg.consentText.trim()), max: LIMITS.message }}
                issues={pick(issues, 'consent.text')}
              >
                {(id) => (
                  <textarea
                    id={id}
                    className="textarea"
                    rows={6}
                    value={cfg.consentText}
                    onChange={(e) => update({ consentText: e.target.value })}
                  />
                )}
              </F>
              {baseText.trim() !== DEFAULT_CONSENT_TEXT ? (
                <div>
                  <Button
                    variant="quiet"
                    size="sm"
                    icon={<RotateCcw size={15} />}
                    onClick={() => update({ consentText: setPolicyUrl(DEFAULT_CONSENT_TEXT, policy) })}
                  >
                    Вернуть стандартный текст
                  </Button>
                </div>
              ) : null}
              <F
                label="Ссылка на политику конфиденциальности"
                hint={`Если есть — бот добавит строку «${POLICY_PREFIX.trim()} …» в конец сообщения. Если нет, можно оставить пустым.`}
                issues={pick(issues, 'consent.policy')}
              >
                {(id) => (
                  <input
                    id={id}
                    className="input"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="https://site.ru/privacy"
                    value={policy}
                    onChange={(e) => update({ consentText: setPolicyUrl(cfg.consentText, e.target.value.replace(/\n/g, '')) })}
                  />
                )}
              </F>
            </>
          ) : null}
          <Note>
            Согласие — до первого вопроса. Если человек откажется, бот всё равно отдаст материал, один раз покажет запись и больше
            ничего не пришлёт.
          </Note>
        </>
      )
    }

    case 'magnet':
      return (
        <>
          <F label="Название материала" issues={pick(issues, 'magnet.title')}>
            {(id) => (
              <input
                id={id}
                className="input"
                value={cfg.leadMagnetTitle}
                placeholder="Чек-лист «Как понять, что пора к психологу»"
                onChange={(e) => update({ leadMagnetTitle: e.target.value })}
              />
            )}
          </F>
          <F
            label="Ссылка на материал"
            hint="Яндекс Диск, Google Диск, Notion, Telegraph — любая ссылка, которая открывается без входа."
            issues={pick(issues, 'magnet.url')}
          >
            {(id) => (
              <>
                <input
                  id={id}
                  className="input"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://disk.yandex.ru/…"
                  value={cfg.leadMagnetUrl}
                  onChange={(e) => update({ leadMagnetUrl: e.target.value })}
                />
                <Resolved raw={cfg.leadMagnetUrl} />
              </>
            )}
          </F>
          <Note>Материал выдаётся сразу и без условий: до просьбы о записи и без телефона или почты.</Note>
        </>
      )

    case 'quiz':
      return <QuizEditor cfg={cfg} issues={issues} update={update} />

    case 'offer': {
      const full = offerMessage(cfg)
      const price = Number.isFinite(cfg.offerPrice) ? cfg.offerPrice : 0
      return (
        <>
          <F
            label="Текст оффера"
            hint="Что будет на встрече, сколько длится и что человек унесёт с собой. Цена добавится отдельной строкой."
            count={{ value: cp(full), max: LIMITS.message }}
            issues={pick(issues, 'offer.text')}
          >
            {(id) => (
              <textarea
                id={id}
                className="textarea"
                rows={6}
                value={cfg.offerText}
                onChange={(e) => update({ offerText: e.target.value })}
              />
            )}
          </F>
          <F
            label="Цена знакомства или диагностики, ₽"
            hint="0 — бесплатно. Цена показывается честно, сразу под текстом оффера."
            issues={pick(issues, 'offer.price')}
          >
            {(id) => (
              <>
                <input
                  id={id}
                  className="input bb-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  value={String(price)}
                  onChange={(e) => {
                    const v = e.target.value
                    update({ offerPrice: v === '' ? 0 : Number(v) })
                  }}
                />
                <div className="row-wrap bb-chips" style={{ '--gap': '6px' } as CSSProperties}>
                  {[0, 1500, 2500, 3500].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="chip"
                      aria-pressed={price === p}
                      onClick={() => {
                        sfx('select')
                        update({ offerPrice: p })
                      }}
                    >
                      {p === 0 ? 'Бесплатно' : formatPrice(p)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </F>
          <Note>Без «осталось 2 места», таймеров и скидок, которые сгорают. Бот греет, а не давит — и проверит это сам.</Note>
        </>
      )
    }

    case 'booking':
      return (
        <>
          <F
            label="Текст кнопки"
            hint="Кнопка говорит, что произойдёт: «Выбрать время встречи», «Записаться на знакомство»."
            count={{ value: cp(cfg.bookingText.trim()), max: LIMITS.button }}
            issues={pick(issues, 'booking.text')}
          >
            {(id) => (
              <input
                id={id}
                className="input"
                value={cfg.bookingText}
                onChange={(e) => update({ bookingText: e.target.value })}
              />
            )}
          </F>
          <F
            label="Ссылка для записи"
            hint="t.me/username, сайт или календарь — например, Calendly или Яндекс Календарь."
            issues={pick(issues, 'booking.url')}
          >
            {(id) => (
              <>
                <input
                  id={id}
                  className="input"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="t.me/username"
                  value={cfg.bookingUrl}
                  onChange={(e) => update({ bookingUrl: e.target.value })}
                />
                <Resolved raw={cfg.bookingUrl} />
              </>
            )}
          </F>
        </>
      )

    case 'followup':
      return (
        <>
          <F
            label="Текст напоминания"
            hint="Одно сообщение через 24 часа тем, кто нажал «Пока подумаю». Под ним будет кнопка записи. Тёплое напоминание, а не дожим."
            count={{ value: cp(cfg.followUp.trim()), max: LIMITS.message }}
            issues={pick(issues, 'followup.text')}
          >
            {(id) => (
              <textarea
                id={id}
                className="textarea"
                rows={4}
                value={cfg.followUp}
                placeholder="Привет! Удалось заглянуть в материал?"
                onChange={(e) => update({ followUp: e.target.value })}
              />
            )}
          </F>
        </>
      )

    case 'crisis':
      return (
        <>
          <Note tone="mint">
            Срабатывает на любом шаге, если человек пишет о суициде или самоповреждении. Бот сразу отвечает этим текстом,
            останавливает воронку и уведомляет психолога — никаких кнопок и продаж.
          </Note>
          <div className="row-wrap bb-markers" aria-label="Маркеры кризиса">
            {CRISIS_MARKERS.map((m) => (
              <span key={m} className="bb-marker">
                {m}
              </span>
            ))}
          </div>
          <F
            label="Кризисный текст"
            hint="Тёплые слова, честно про ограничения бота и телефоны помощи. Проверь, что номера актуальны для твоего города."
            count={{ value: cp(cfg.crisisText.trim()), max: LIMITS.message }}
            issues={pick(issues, 'crisis.text')}
          >
            {(id) => (
              <textarea
                id={id}
                className="textarea"
                rows={6}
                value={cfg.crisisText}
                onChange={(e) => update({ crisisText: e.target.value })}
              />
            )}
          </F>
          {cfg.crisisText.trim() !== DEFAULT_CRISIS_TEXT ? (
            <div>
              <Button
                variant="quiet"
                size="sm"
                icon={<RotateCcw size={15} />}
                onClick={() => update({ crisisText: DEFAULT_CRISIS_TEXT })}
              >
                Вернуть стандартный текст
              </Button>
            </div>
          ) : null}
        </>
      )
  }
}

function QuizEditor({ cfg, issues, update }: Omit<BodyProps, 'step'>) {
  const setQuiz = (quiz: BotQuizQuestion[]) => update({ quiz })
  const patchQ = (qi: number, patch: Partial<BotQuizQuestion>) =>
    setQuiz(cfg.quiz.map((q, i) => (i === qi ? { ...q, ...patch } : q)))

  return (
    <>
      <p className="small muted">
        Квиз квалифицирует, а не диагностирует: спрашивай о запросе и опыте, а не о симптомах. 1–3 вопроса, в каждом 2–4
        варианта.
      </p>
      <Issues items={issues.filter((i) => i.id === 'quiz.empty' || i.id === 'quiz.many')} />
      <ol className="bb-quiz">
        {cfg.quiz.map((q, qi) => {
          const base = `quiz.q:${q.id}`
          return (
            <li key={q.id} className="bb-q">
              <div className="spread">
                <span className="bb-q-num">Вопрос {qi + 1}</span>
                {cfg.quiz.length > LIMITS.quizMin ? (
                  <Button
                    variant="quiet"
                    size="sm"
                    icon={<Trash2 size={15} />}
                    sound="close"
                    aria-label={`Удалить вопрос ${qi + 1}`}
                    onClick={() => setQuiz(cfg.quiz.filter((_, i) => i !== qi))}
                  />
                ) : null}
              </div>
              <F label="Текст вопроса" issues={pick(issues, `${base}.text`)}>
                {(id) => (
                  <input
                    id={id}
                    className="input"
                    value={q.text}
                    placeholder="Что сейчас беспокоит сильнее всего?"
                    onChange={(e) => patchQ(qi, { text: e.target.value })}
                  />
                )}
              </F>
              <div className="bb-opts" role="group" aria-label={`Варианты ответа на вопрос ${qi + 1}`}>
                {q.options.map((o, oi) => {
                  const over = cp(o.trim()) > LIMITS.button
                  return (
                    <div key={oi} className="bb-opt">
                      <div className="bb-opt-row">
                        <input
                          className="input"
                          value={o}
                          aria-label={`Вариант ${oi + 1}`}
                          placeholder={`Вариант ${oi + 1}`}
                          data-over={over || undefined}
                          onChange={(e) =>
                            patchQ(qi, { options: q.options.map((x, j) => (j === oi ? e.target.value : x)) })
                          }
                        />
                        {over ? <Counter value={cp(o.trim())} max={LIMITS.button} /> : null}
                        {q.options.length > LIMITS.optionsMin ? (
                          <Button
                            variant="quiet"
                            size="sm"
                            icon={<X size={15} />}
                            sound="close"
                            aria-label={`Удалить вариант ${oi + 1}`}
                            onClick={() => patchQ(qi, { options: q.options.filter((_, j) => j !== oi) })}
                          />
                        ) : null}
                      </div>
                      <Issues items={pick(issues, `${base}.opt${oi}`)} />
                    </div>
                  )
                })}
              </div>
              <Issues items={pick(issues, `${base}.options`)} />
              {q.options.length < LIMITS.optionsMax ? (
                <div>
                  <Button
                    variant="quiet"
                    size="sm"
                    icon={<Plus size={15} />}
                    sound="select"
                    onClick={() => patchQ(qi, { options: [...q.options, ''] })}
                  >
                    Добавить вариант
                  </Button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
      {cfg.quiz.length < LIMITS.quizMax ? (
        <div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus size={16} />}
            sound="select"
            onClick={() => setQuiz([...cfg.quiz, { id: newQuestionId(), text: '', options: ['', ''] }])}
          >
            Добавить вопрос
          </Button>
        </div>
      ) : null}
    </>
  )
}
