// Башня Ботов — конструктор Telegram-бота-воронки для психолога.
// Слева этажи-шаги, справа живой телефон, ниже тест-драйв, экспорт и запуск.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent } from 'react'
import { ArrowLeft, Castle, CircleCheck, FlaskConical, RotateCcw, SlidersHorizontal, Smartphone } from 'lucide-react'
import type { BotConfig } from '../../game/types'
import { sfx } from '../../audio/engine'
import { Bar } from '../../ui/Bar'
import { Button } from '../../ui/Button'
import { Floors } from './Floors'
import { minutesNow, pathTo, runFlow, type ChatAction } from './flow'
import { DeployPanel, ExportPanel } from './Launch'
import { PresetLibrary } from './Library'
import { BOT_STEPS, normalizeConfig, validateBot, type BotIssue, type BotStep } from './model'
import { applyPreset, type BotPreset } from './presets'
import { PERSONAS } from './sim'
import { TelegramPreview } from './TelegramPreview'
import { TestDrivePanel, useTestDrive } from './TestDrive'
import { plural, useClock, useReducedMotionPref, useWide } from './util'
import './bot.css'

export interface DeployResult {
  botId: string
  username: string
  adminCode: string
}

export interface BotBuilderProps {
  value: BotConfig
  onChange: (cfg: BotConfig) => void
  /** Вызывается, когда тест-драйв пройден без единой ошибки */
  onTestPassed: (report: { personas: number; passed: number; issues: BotIssue[] }) => void
  /** undefined — демо без сервера */
  deploy?: (token: string, cfg: BotConfig) => Promise<DeployResult>
  /** PRO: библиотека готовых сценариев под ниши */
  pro: boolean
  onNeedPro?: () => void
}

type Tab = 'config' | 'preview' | 'test'

const TABS: { id: Tab; label: string }[] = [
  { id: 'config', label: 'Настройка' },
  { id: 'preview', label: 'Превью' },
  { id: 'test', label: 'Тест' },
]

// ---------- Ручная переписка в превью ----------

function useManualChat(cfg: BotConfig, reduced: boolean) {
  const [actions, setActions] = useState<ChatAction[]>([])
  const flow = useMemo(() => runFlow(cfg, actions), [cfg, actions])
  const [reveal, setReveal] = useState<number | null>(null)
  const total = flow.messages.length
  const shown = reveal === null ? total : Math.min(reveal, total)
  const live = useRef({ accepted: 0, shown: 0 })
  useLayoutEffect(() => {
    live.current = { accepted: flow.accepted, shown }
  })

  useEffect(() => {
    if (reveal === null) return
    if (reveal >= total) {
      setReveal(null)
      return
    }
    const next = flow.messages[reveal]
    const base = next.from === 'bot' ? 720 : next.from === 'user' ? 60 : next.from === 'divider' ? 520 : 320
    const id = window.setTimeout(
      () => {
        if (next.from === 'bot') sfx('type')
        setReveal((r) => (r === null ? null : r + 1))
      },
      reduced ? Math.min(base, 160) : base,
    )
    return () => window.clearTimeout(id)
  }, [reveal, total, flow.messages, reduced])

  const push = useCallback((a: ChatAction) => {
    const { accepted, shown: visible } = live.current
    setActions((prev) => [...prev.slice(0, accepted), { ...a, at: minutesNow() }])
    setReveal((r) => r ?? visible)
  }, [])

  return {
    started: flow.accepted > 0,
    messages: flow.messages.slice(0, shown),
    typing: reveal !== null && flow.messages[shown]?.from === 'bot',
    start: () => push({ t: 'start' }),
    press: (id: string) => push({ t: 'press', id }),
    send: (text: string) => push({ t: 'text', text }),
    reset: () => {
      setActions([])
      setReveal(null)
    },
    jumpTo: (step: BotStep) => {
      setActions(pathTo(cfg, step))
      setReveal(null)
    },
  }
}

// ---------- Компонент ----------

export function BotBuilder({ value, onChange, onTestPassed, deploy, pro, onNeedPro }: BotBuilderProps): JSX.Element {
  const cfg = useMemo(() => normalizeConfig(value), [value])
  const cfgRef = useRef(cfg)
  useEffect(() => {
    cfgRef.current = cfg
  }, [cfg])

  const issues = useMemo(() => validateBot(cfg), [cfg])
  const errors = issues.filter((i) => i.severity === 'error').length
  const warns = issues.length - errors
  const lit = BOT_STEPS.filter((s) => !issues.some((i) => i.step === s.id && i.severity === 'error')).length

  const rootRef = useRef<HTMLDivElement>(null)
  const testRef = useRef<HTMLDivElement>(null)
  const wide = useWide(rootRef, 900)
  const reduced = useReducedMotionPref()
  const clock = useClock()
  const [tab, setTab] = useState<Tab>('config')
  const [open, setOpen] = useState<BotStep | null>('welcome')
  const [phoneMode, setPhoneMode] = useState<'manual' | 'test'>('manual')
  const chat = useManualChat(cfg, reduced)
  const td = useTestDrive(cfg, onTestPassed)

  const update = useCallback(
    (patch: Partial<BotConfig>) => {
      const next = { ...cfgRef.current, ...patch }
      cfgRef.current = next
      onChange(next)
    },
    [onChange],
  )

  const scrollToEl = (el: Element | null | undefined) =>
    el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })

  const toggleFloor = (step: BotStep) => {
    if (open === step) {
      sfx('close')
      setOpen(null)
      return
    }
    sfx('page')
    setOpen(step)
    chat.jumpTo(step)
    setPhoneMode('manual')
  }

  const focusStep = (step: BotStep) => {
    setOpen(step)
    chat.jumpTo(step)
    setPhoneMode('manual')
    if (!wide) setTab('config')
    window.setTimeout(() => scrollToEl(rootRef.current?.querySelector(`[data-step="${step}"]`)), 60)
  }

  const previewStep = (step: BotStep) => {
    chat.jumpTo(step)
    switchTab('preview')
  }

  const startTest = () => {
    td.start()
    setPhoneMode('test')
    window.setTimeout(() => {
      if (wide) scrollToEl(testRef.current)
      else
        rootRef.current
          ?.querySelector('.bb-td-phone')
          ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    }, 40)
  }

  const switchTab = (next: Tab) => {
    if (next === tab) return
    sfx('select')
    setTab(next)
    const layout = rootRef.current?.querySelector('.bb-layout')
    if (layout && layout.getBoundingClientRect().top < 0) layout.scrollIntoView({ block: 'start' })
  }

  const viewPersona = (i: number) => {
    td.view(i)
    setPhoneMode('test')
    sfx('select')
  }

  const applyLibrary = (preset: BotPreset) => {
    update(applyPreset(cfgRef.current, preset))
    chat.reset()
    setPhoneMode('manual')
  }

  const onDeployed = (res: DeployResult) => {
    const next: BotConfig = { ...cfgRef.current, deployed: { ...res, deployedAt: Date.now() } }
    cfgRef.current = next
    onChange(next)
  }

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const i = TABS.findIndex((t) => t.id === tab)
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    switchTab(next.id)
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus()
  }

  // ---------- Телефон ----------

  const mode: 'manual' | 'test' = wide ? (td.phase === 'idle' ? 'manual' : phoneMode) : tab === 'test' ? 'test' : 'manual'
  const persona = PERSONAS[td.viewIndex]

  const phone =
    mode === 'test' ? (
      <TelegramPreview
        botName={cfg.botName}
        messages={td.transcript}
        typing={td.typing}
        started={td.phase !== 'idle'}
        clock={td.clock}
        interactive={false}
        lockedHint={td.phase === 'running' ? 'Идёт тест-драйв' : 'Переписка тест-драйва'}
      />
    ) : (
      <TelegramPreview
        botName={cfg.botName}
        messages={chat.messages}
        typing={chat.typing}
        started={chat.started}
        clock={clock}
        interactive
        onStart={chat.start}
        onPress={(b) => chat.press(b.id)}
        onLink={(b) => {
          if (b.id === 'book') chat.press('book')
        }}
        onSend={chat.send}
        onFix={focusStep}
      />
    )

  const phoneCaption =
    mode === 'test' ? (
      td.phase === 'idle' ? (
        <span>Здесь появится переписка тест-драйва</span>
      ) : (
        <span>
          Тест-драйв: {persona.name}, {persona.age}
          {td.phase === 'running' ? ' — в чате прямо сейчас' : ''}
        </span>
      )
    ) : (
      <span>Живое превью: нажимай кнопки, как клиент</span>
    )

  const phoneBlock = (
    <div className="bb-phone-block">
      <div className="bb-phone-cap small">
        {mode === 'test' ? <FlaskConical size={15} aria-hidden="true" /> : <Smartphone size={15} aria-hidden="true" />}
        {phoneCaption}
      </div>
      {phone}
      <div className="bb-phone-ctrl">
        {mode === 'manual' ? (
          <>
            <Button variant="quiet" size="sm" icon={<RotateCcw size={15} />} sound="close" onClick={chat.reset}>
              Начать заново
            </Button>
            <p className="tiny faint">Можно печатать: на кризисное сообщение бот ответит кризисным текстом.</p>
          </>
        ) : wide ? (
          <Button variant="quiet" size="sm" icon={<ArrowLeft size={15} />} onClick={() => setPhoneMode('manual')}>
            Вернуться к ручному превью
          </Button>
        ) : null}
      </div>
    </div>
  )

  const showConfig = wide || tab === 'config'
  const showTest = wide || tab === 'test'
  const testPassed = td.phase === 'done' && !!td.sim && td.sim.passed === td.sim.runs.length && !td.stale

  return (
    <div className="bb" ref={rootRef} data-wide={wide || undefined}>
      <header className="bb-head">
        <div className="bb-head-text">
          <div className="bb-kicker">
            <Castle size={16} aria-hidden="true" />
            Башня Ботов
          </div>
          <h2 className="display t-25">Бот-воронка для Telegram</h2>
          <p className="small muted">
            Бот не лечит и не ставит диагнозы: он отдаёт пользу, узнаёт запрос и помогает записаться. Собери этажи, проверь на
            трёх клиентах и запусти.
          </p>
        </div>
        <div className="bb-health" aria-label="Состояние башни">
          <div className="spread small">
            <span className="muted">Светится этажей</span>
            <span className="num gold">
              {lit} из {BOT_STEPS.length}
            </span>
          </div>
          <Bar value={lit} max={BOT_STEPS.length} variant={errors ? 'gold' : 'mint'} label="Этажи без ошибок" />
          <div className="row-wrap" style={{ gap: 6 }}>
            {errors ? (
              <span className="badge badge-ember">
                {errors} {plural(errors, 'ошибка', 'ошибки', 'ошибок')}
              </span>
            ) : null}
            {warns ? (
              <span className="badge">
                {warns} {plural(warns, 'замечание', 'замечания', 'замечаний')}
              </span>
            ) : null}
            {!errors && !warns ? <span className="badge badge-mint">Все этажи в порядке</span> : null}
            {testPassed ? (
              <span className="badge badge-mint">
                <CircleCheck size={13} aria-hidden="true" />
                Тест-драйв пройден
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {!wide ? (
        <div className="bb-tabs" role="tablist" aria-label="Разделы башни" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              data-tab={t.id}
              id={`bb-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="bb-tabpanel"
              tabIndex={tab === t.id ? 0 : -1}
              className="bb-tab"
              onClick={() => switchTab(t.id)}
            >
              {t.id === 'config' ? (
                <SlidersHorizontal size={16} aria-hidden="true" />
              ) : t.id === 'preview' ? (
                <Smartphone size={16} aria-hidden="true" />
              ) : (
                <FlaskConical size={16} aria-hidden="true" />
              )}
              <span>{t.label}</span>
              {t.id === 'config' && errors ? (
                <span className="bb-tab-dot num" aria-label={`${errors} ${plural(errors, 'ошибка', 'ошибки', 'ошибок')}`}>
                  {errors}
                </span>
              ) : null}
              {t.id === 'test' && testPassed ? <CircleCheck size={14} className="mint" aria-label="пройден" /> : null}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="bb-layout"
        id={wide ? undefined : 'bb-tabpanel'}
        role={wide ? undefined : 'tabpanel'}
        aria-labelledby={wide ? undefined : `bb-tab-${tab}`}
      >
        <div className="bb-main">
          {showConfig ? (
            <>
              <PresetLibrary pro={pro} onNeedPro={onNeedPro} onApply={applyLibrary} />
              <section className="panel bb-sec bb-floors" aria-labelledby="bb-floors-title">
                <div className="bb-sec-head">
                  <div>
                    <h3 className="display t-20" id="bb-floors-title">
                      Этажи воронки
                    </h3>
                    <p className="small muted">
                      Этаж за этажом: приветствие, согласие, польза, вопросы, предложение и запись. Фундамент — кризисный
                      ответ: он срабатывает на любом шаге.
                    </p>
                  </div>
                </div>
                <Floors
                  cfg={cfg}
                  issues={issues}
                  open={open}
                  onToggle={toggleFloor}
                  update={update}
                  onPreview={wide ? undefined : previewStep}
                />
              </section>
            </>
          ) : null}

          {showTest ? (
            <div ref={testRef} className="bb-scroll-anchor">
              <TestDrivePanel
                td={td}
                phone={wide ? undefined : phoneBlock}
                onStart={startTest}
                onFix={focusStep}
                onViewPersona={viewPersona}
                errorCount={errors}
              />
            </div>
          ) : null}

          {showConfig ? (
            <>
              <ExportPanel cfg={cfg} />
              <DeployPanel cfg={cfg} deploy={deploy} errorCount={errors} onDeployed={onDeployed} />
            </>
          ) : null}

          {!wide && tab === 'preview' ? phoneBlock : null}
        </div>

        {wide ? <aside className="bb-side">{phoneBlock}</aside> : null}
      </div>
    </div>
  )
}
