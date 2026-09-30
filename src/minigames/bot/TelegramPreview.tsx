import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import {
  ArrowUpRight,
  BatteryFull,
  CheckCheck,
  ChevronLeft,
  EllipsisVertical,
  Mic,
  Paperclip,
  SendHorizontal,
  ShieldCheck,
  Signal,
  Wifi,
} from 'lucide-react'
import { sfx } from '../../audio/engine'
import type { ChatButton, ChatMessage } from './flow'
import { STEP_TITLE, displayUrl, type BotStep } from './model'
import { useReducedMotionPref } from './util'

export interface TelegramPreviewProps {
  botName: string
  messages: ChatMessage[]
  typing?: boolean
  /** false — пустой чат с кнопкой «Запустить» */
  started: boolean
  clock: string
  /** Ручной режим: кнопки и поле ввода работают */
  interactive: boolean
  onStart?: () => void
  onPress?: (btn: ChatButton, msg: ChatMessage) => void
  /** Человек подтвердил переход по ссылке-кнопке */
  onLink?: (btn: ChatButton, msg: ChatMessage) => void
  onSend?: (text: string) => void
  /** Открыть этаж, где сломана ссылка */
  onFix?: (step: BotStep) => void
  /** Подпись поля ввода, когда оно выключено */
  lockedHint?: string
  className?: string
}

function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  )
}

interface PendingLink {
  btn: ChatButton
  msg: ChatMessage
}

export function TelegramPreview({
  botName,
  messages,
  typing = false,
  started,
  clock,
  interactive,
  onStart,
  onPress,
  onLink,
  onSend,
  onFix,
  lockedHint = 'Сообщение',
  className,
}: TelegramPreviewProps) {
  const reduced = useReducedMotionPref()
  const chatRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<PendingLink | null>(null)
  const titleId = useId()
  const name = botName.trim() || 'Бот без имени'
  const letter = (botName.trim()[0] ?? 'Б').toUpperCase()
  const lastKey = messages.length ? messages[messages.length - 1].key : ''

  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }, [messages.length, lastKey, typing, reduced, started])

  useEffect(() => {
    if (!pending) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPending(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending])

  useEffect(() => {
    if (!interactive) setPending(null)
  }, [interactive])

  const press = (btn: ChatButton, msg: ChatMessage) => {
    if (!interactive) return
    if (btn.kind === 'url') {
      sfx('open')
      setPending({ btn, msg })
      return
    }
    sfx('click')
    onPress?.(btn, msg)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !interactive) return
    sfx('whoosh')
    onSend?.(text)
    setDraft('')
  }

  const pendingStep: BotStep = pending?.btn.id === 'book' ? 'booking' : 'magnet'
  const pendingBroken = !!pending && (pending.btn.broken || !pending.btn.url)

  return (
    <div className={['bb-phone', className].filter(Boolean).join(' ')} data-mode={interactive ? 'live' : 'playback'}>
      <div className="bb-screen">
        <div className="bb-island" aria-hidden="true" />
        <div className="bb-status" aria-hidden="true">
          <span className="num">{clock}</span>
          <span className="bb-status-icons">
            <Signal size={13} />
            <Wifi size={13} />
            <BatteryFull size={17} />
          </span>
        </div>

        <header className="bb-tg-head">
          <ChevronLeft size={22} className="bb-tg-back" aria-hidden="true" />
          <div className="bb-avatar" aria-hidden="true">
            {letter}
          </div>
          <div className="bb-tg-title">
            <div className="bb-tg-name">{name}</div>
            <div className="bb-tg-sub" data-typing={typing || undefined}>
              {typing ? 'печатает…' : 'бот'}
            </div>
          </div>
          <EllipsisVertical size={20} className="bb-tg-menu" aria-hidden="true" />
        </header>

        <div className="bb-chat" ref={chatRef} role="log" aria-live="polite" aria-label={`Переписка с ботом «${name}»`}>
          {!started ? (
            <div className="bb-intro">
              <div className="bb-intro-card">
                <div className="bb-avatar bb-avatar-lg" aria-hidden="true">
                  {letter}
                </div>
                <div className="bb-intro-title">Что умеет этот бот?</div>
                <p>Бесплатный материал, пара вопросов и запись на встречу к психологу.</p>
                <p className="bb-intro-hint">
                  {interactive
                    ? 'Нажми «Запустить» и пройди воронку глазами клиента.'
                    : 'Здесь появится переписка тест-драйва.'}
                </p>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <MessageView
                key={m.key}
                m={m}
                interactive={interactive}
                reduced={reduced}
                onPress={press}
              />
            ))
          )}
          {started && typing ? (
            <div className="bb-msg" data-from="bot" aria-hidden="true">
              <div className="bb-bubble bb-typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          ) : null}
        </div>

        {!started && interactive ? (
          <div className="bb-startbar">
            <button
              type="button"
              className="bb-start-btn"
              onClick={() => {
                sfx('select')
                onStart?.()
              }}
            >
              Запустить
            </button>
          </div>
        ) : (
          <form className="bb-composer" onSubmit={submit}>
            <Paperclip size={20} className="bb-comp-icon" aria-hidden="true" />
            <input
              className="bb-comp-input"
              value={interactive ? draft : ''}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={interactive ? 'Сообщение' : lockedHint}
              disabled={!interactive}
              aria-label="Написать боту"
              autoComplete="off"
              enterKeyHint="send"
              maxLength={500}
            />
            <button
              type="submit"
              className="bb-comp-send"
              disabled={!interactive || !draft.trim()}
              aria-label="Отправить"
              data-ready={(interactive && !!draft.trim()) || undefined}
            >
              {interactive && draft.trim() ? <SendHorizontal size={20} /> : <Mic size={20} />}
            </button>
          </form>
        )}

        {pending ? (
          <div className="bb-linkdlg" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="bb-linkdlg-backdrop" onClick={() => setPending(null)} />
            <div className="bb-linkdlg-box">
              {pendingBroken ? (
                <>
                  <div className="bb-linkdlg-title" id={titleId}>
                    Ссылка не работает
                  </div>
                  <p>
                    {pending.btn.id === 'book'
                      ? 'Кнопка записи ведёт в никуда.'
                      : 'Ссылка на материал не задана или с ошибкой.'}{' '}
                    Поправь её на этаже «{STEP_TITLE[pendingStep]}».
                  </p>
                  <div className="bb-linkdlg-actions">
                    <button type="button" onClick={() => setPending(null)} ref={onFix ? undefined : confirmRef}>
                      Закрыть
                    </button>
                    {onFix ? (
                      <button
                        type="button"
                        ref={confirmRef}
                        onClick={() => {
                          setPending(null)
                          onFix(pendingStep)
                        }}
                      >
                        Открыть этаж
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="bb-linkdlg-title" id={titleId}>
                    Открыть ссылку?
                  </div>
                  <p className="bb-linkdlg-url">{displayUrl(pending.btn.url ?? '')}</p>
                  <div className="bb-linkdlg-actions">
                    <button type="button" onClick={() => setPending(null)}>
                      Отмена
                    </button>
                    <button
                      type="button"
                      ref={confirmRef}
                      onClick={() => {
                        const { btn, msg } = pending
                        setPending(null)
                        if (btn.url) window.open(btn.url, '_blank', 'noopener,noreferrer')
                        onLink?.(btn, msg)
                      }}
                    >
                      Открыть
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface MessageViewProps {
  m: ChatMessage
  interactive: boolean
  reduced: boolean
  onPress: (btn: ChatButton, msg: ChatMessage) => void
}

function MessageView({ m, interactive, reduced, onPress }: MessageViewProps) {
  const enter = reduced ? false : { opacity: 0, y: 8, scale: 0.985 }
  const shown = { opacity: 1, y: 0, scale: 1 }
  const tr = { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] as const }

  if (m.from === 'divider') {
    return (
      <motion.div className="bb-divider" initial={enter} animate={shown} transition={tr}>
        <span>{m.text}</span>
      </motion.div>
    )
  }
  if (m.from === 'system') {
    return (
      <motion.div className="bb-note" data-tone={m.tone} initial={enter} animate={shown} transition={tr}>
        {m.text}
      </motion.div>
    )
  }

  const empty = m.broken && (m.text === 'Пустое сообщение' || !m.text.trim())
  return (
    <motion.div
      className="bb-msg"
      data-from={m.from}
      data-broken={m.broken || undefined}
      data-tone={m.tone}
      data-kb={m.buttons?.length ? true : undefined}
      initial={enter}
      animate={shown}
      transition={tr}
    >
      <div className="bb-bubble">
        {m.tone === 'crisis' ? (
          <div className="bb-caption bb-caption-crisis">
            <ShieldCheck size={12} aria-hidden="true" /> Кризисный протокол
          </div>
        ) : m.caption ? (
          <div className="bb-caption">{m.caption}</div>
        ) : null}
        <span className={empty ? 'bb-text bb-text-empty' : 'bb-text'}>{empty ? 'Пустое сообщение' : linkify(m.text)}</span>
        <span className="bb-meta">
          <span className="num">{m.time}</span>
          {m.from === 'user' ? <CheckCheck size={14} aria-hidden="true" /> : null}
        </span>
      </div>
      {m.buttons?.length ? (
        <div className="bb-kb" data-active={m.active || undefined}>
          {m.buttons.map((row, ri) => (
            <div className="bb-kb-row" key={ri}>
              {row.map((b) => {
                const live = interactive && (b.kind === 'url' || !!m.active)
                return (
                  <button
                    key={b.id}
                    type="button"
                    className="bb-kb-btn"
                    data-kind={b.kind}
                    data-broken={b.broken || undefined}
                    disabled={!live}
                    tabIndex={live ? 0 : -1}
                    onClick={() => onPress(b, m)}
                  >
                    <span>{b.text}</span>
                    {b.kind === 'url' ? <ArrowUpRight size={12} className="bb-kb-arrow" aria-hidden="true" /> : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      ) : null}
    </motion.div>
  )
}
