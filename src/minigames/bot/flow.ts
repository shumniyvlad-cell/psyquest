// Движок переписки: из конфига и списка действий человека собирает ленту сообщений.
// Одна и та же функция кормит живое превью и тест-драйв, поэтому превью всегда
// перестраивается при правках — лента не хранится, а выводится заново.

import type { BotConfig } from '../../game/types'
import { isCrisisMessage } from './crisis'
import { FLOW_TEXT, checkUrl, magnetMessage, offerMessage, type BotStep } from './model'

export type ChatAction =
  | { t: 'start'; at?: number }
  | { t: 'press'; id: string; at?: number }
  | { t: 'text'; text: string; at?: number }

export interface ChatButton {
  id: string
  text: string
  kind: 'callback' | 'url'
  url?: string
  /** Кнопка сломана: нет ссылки или текста */
  broken?: boolean
}

export interface ChatMessage {
  key: string
  from: 'bot' | 'user' | 'system' | 'divider'
  text: string
  step: BotStep
  /** id вопроса квиза */
  ref?: string
  /** Мелкая подпись над текстом («Вопрос 1 из 3») */
  caption?: string
  buttons?: ChatButton[][]
  /** Колбэк-кнопки этого сообщения ещё можно нажать */
  active?: boolean
  broken?: boolean
  tone?: 'info' | 'warn' | 'ok' | 'crisis'
  time: string
}

export type FlowStage = 'idle' | 'consent' | 'magnet' | 'quiz' | 'offer' | 'later' | 'declined' | 'booked' | 'crisis'

export interface FlowState {
  messages: ChatMessage[]
  stage: FlowStage
  /** Сколько действий принято (остальные не подошли к текущему состоянию) */
  accepted: number
  booked: boolean
  crisisAnswered: boolean
}

export const CRISIS_DEMO_TEXT = 'Иногда кажется, что нет смысла жить'

const DAY = 24 * 60

export function minutesNow(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export function formatClock(min: number): string {
  const m = ((Math.round(min) % DAY) + DAY) % DAY
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

const STAGE_STEP: Record<FlowStage, BotStep> = {
  idle: 'welcome',
  consent: 'consent',
  magnet: 'magnet',
  quiz: 'quiz',
  offer: 'offer',
  later: 'followup',
  declined: 'offer',
  booked: 'booking',
  crisis: 'crisis',
}

const cb = (id: string, text: string, broken = false): ChatButton => ({ id, text, kind: 'callback', broken })

export function runFlow(cfg: BotConfig, actions: ChatAction[]): FlowState {
  const msgs: ChatMessage[] = []
  let stage: FlowStage = 'idle'
  let qIndex = 0
  let kb = -1
  let now = minutesNow()
  let dayShift = 0
  let booked = false
  let crisisAnswered = false
  let bookShown = false
  let accepted = 0
  let act = 0
  let seq = 0

  const push = (m: Omit<ChatMessage, 'key' | 'time'>): number => {
    msgs.push({ ...m, key: `a${act}-${seq++}`, time: formatClock(now + dayShift) })
    return msgs.length - 1
  }

  const bookButton = (): ChatButton => {
    const res = checkUrl(cfg.bookingUrl)
    const text = cfg.bookingText.trim()
    bookShown = true
    return { id: 'book', kind: 'url', text: text || 'Кнопка без текста', url: res.url ?? undefined, broken: !res.ok || !text }
  }

  const sendMagnet = (withQuiz: boolean, declined = false) => {
    const res = checkUrl(cfg.leadMagnetUrl)
    const rows: ChatButton[][] = [
      [{ id: 'magnet', kind: 'url', text: FLOW_TEXT.magnetOpen, url: res.url ?? undefined, broken: !res.ok }],
    ]
    if (withQuiz) {
      rows.push([cfg.quiz.length ? cb('quiz_start', FLOW_TEXT.quizStart) : cb('skip_quiz', FLOW_TEXT.skipQuiz)])
    }
    const i = push({
      from: 'bot',
      text: magnetMessage(cfg, withQuiz, declined),
      step: 'magnet',
      buttons: rows,
      broken: !cfg.leadMagnetTitle.trim(),
    })
    if (withQuiz) kb = i
    stage = 'magnet'
  }

  const ask = (i: number) => {
    const q = cfg.quiz[i]
    const rows = q.options.map((o, j) => [cb(`q:${q.id}:${j}`, o.trim() || 'Пустой вариант', !o.trim())])
    kb = push({
      from: 'bot',
      text: q.text.trim() ? q.text : 'Пустое сообщение',
      caption: `Вопрос ${i + 1} из ${cfg.quiz.length}`,
      step: 'quiz',
      ref: q.id,
      buttons: rows,
      broken: !q.text.trim() || q.options.length < 2 || q.options.some((o) => !o.trim()),
    })
    qIndex = i
    stage = 'quiz'
  }

  const sendOffer = () => {
    kb = push({
      from: 'bot',
      text: offerMessage(cfg),
      step: 'offer',
      buttons: [[bookButton()], [cb('later', FLOW_TEXT.later)]],
      broken: !cfg.offerText.trim() || !Number.isFinite(cfg.offerPrice) || cfg.offerPrice < 0,
    })
    stage = 'offer'
  }

  const doStart = () => {
    kb = -1
    qIndex = 0
    booked = false
    crisisAnswered = false
    push({ from: 'user', text: '/start', step: 'welcome' })
    if (cfg.welcome.trim()) push({ from: 'bot', text: cfg.welcome, step: 'welcome' })
    else push({ from: 'system', text: 'Приветствие пустое — бот промолчал.', step: 'welcome', tone: 'warn', broken: true })
    if (cfg.consent) {
      kb = push({
        from: 'bot',
        text: cfg.consentText.trim() ? cfg.consentText : 'Пустое сообщение',
        step: 'consent',
        buttons: [[cb('consent_yes', FLOW_TEXT.consentYes)], [cb('consent_no', FLOW_TEXT.consentNo)]],
        broken: !cfg.consentText.trim(),
      })
      stage = 'consent'
    } else {
      push({
        from: 'system',
        text: 'Согласие выключено: бот собирает ответы, не спросив разрешения.',
        step: 'consent',
        tone: 'warn',
        broken: true,
      })
      sendMagnet(true)
    }
  }

  const doPress = (id: string): boolean => {
    if (stage === 'idle' || stage === 'crisis') return false
    if (id === 'book') {
      if (!bookShown) return false
      if (booked) return true
      const res = checkUrl(cfg.bookingUrl)
      if (!res.ok || !res.url || !cfg.bookingText.trim()) {
        push({ from: 'system', text: 'Ссылка записи не открылась.', step: 'booking', tone: 'warn', broken: true })
        return true
      }
      kb = -1
      booked = true
      stage = 'booked'
      push({ from: 'system', text: 'Человек перешёл к записи. Психолог получит уведомление.', step: 'booking', tone: 'ok' })
      return true
    }
    const owner = kb >= 0 ? msgs[kb] : undefined
    const btn = owner?.buttons?.flat().find((b) => b.kind === 'callback' && b.id === id)
    if (!owner || !btn) return false

    if (id.startsWith('q:')) {
      const [, qid, idxRaw] = id.split(':')
      const q = cfg.quiz[qIndex]
      const opt = Number(idxRaw)
      if (stage !== 'quiz' || !q || q.id !== qid || !(opt >= 0 && opt < q.options.length)) return false
      kb = -1
      push({ from: 'user', text: q.options[opt].trim() || '…', step: 'quiz', ref: q.id })
      if (qIndex + 1 < cfg.quiz.length) ask(qIndex + 1)
      else sendOffer()
      return true
    }

    kb = -1
    switch (id) {
      case 'consent_yes':
        push({ from: 'user', text: btn.text, step: 'consent' })
        sendMagnet(true)
        return true
      case 'consent_no':
        push({ from: 'user', text: btn.text, step: 'consent' })
        sendMagnet(false, true)
        push({ from: 'bot', text: FLOW_TEXT.declinedOffer, step: 'offer', buttons: [[bookButton()]] })
        stage = 'declined'
        return true
      case 'quiz_start':
        push({ from: 'user', text: btn.text, step: 'quiz' })
        ask(0)
        return true
      case 'skip_quiz':
        push({ from: 'user', text: btn.text, step: 'quiz' })
        push({
          from: 'system',
          text: 'Квиз пустой: бот не узнал запрос и сразу перешёл к офферу.',
          step: 'quiz',
          tone: 'warn',
          broken: true,
        })
        sendOffer()
        return true
      case 'later':
        push({ from: 'user', text: btn.text, step: 'offer' })
        if (cfg.followUp.trim()) {
          push({ from: 'bot', text: FLOW_TEXT.laterReplyFollow, step: 'followup' })
          dayShift += DAY
          push({ from: 'divider', text: 'Через сутки', step: 'followup' })
          push({ from: 'bot', text: cfg.followUp, step: 'followup', buttons: [[bookButton()]] })
        } else {
          push({ from: 'bot', text: FLOW_TEXT.laterReply, step: 'followup' })
          push({
            from: 'system',
            text: 'Напоминание не задано — бот больше не напишет.',
            step: 'followup',
            tone: 'warn',
          })
        }
        stage = 'later'
        return true
      default:
        return false
    }
  }

  const doText = (raw: string): boolean => {
    const text = raw.trim()
    if (!text) return false
    if (/^\/start(?:@\w+)?$/i.test(text)) {
      doStart()
      return true
    }
    if (stage === 'idle') return false
    if (isCrisisMessage(text)) {
      kb = -1
      push({ from: 'user', text, step: 'crisis' })
      if (cfg.crisisText.trim()) {
        push({ from: 'bot', text: cfg.crisisText, step: 'crisis', tone: 'crisis' })
        crisisAnswered = true
      } else {
        push({ from: 'system', text: 'Кризисный текст пустой — бот промолчал.', step: 'crisis', tone: 'warn', broken: true })
      }
      push({
        from: 'system',
        text: 'Воронка остановлена: никаких кнопок и напоминаний. Психолог получит уведомление.',
        step: 'crisis',
        tone: 'crisis',
      })
      stage = 'crisis'
      return true
    }
    push({ from: 'user', text, step: STAGE_STEP[stage] })
    if (stage === 'crisis') {
      push({ from: 'system', text: 'Бот передаст сообщение психологу.', step: 'crisis', tone: 'info' })
      return true
    }
    push({ from: 'bot', text: FLOW_TEXT.fallback, step: STAGE_STEP[stage] })
    return true
  }

  for (let k = 0; k < actions.length; k++) {
    const a = actions[k]
    act = k
    seq = 0
    if (typeof a.at === 'number') now = a.at
    const ok = a.t === 'start' ? (doStart(), true) : a.t === 'press' ? doPress(a.id) : doText(a.text)
    if (!ok) break
    accepted = k + 1
  }

  // stage меняют вложенные функции — TS об этом не знает, поэтому читаем через явный тип
  const endStage = stage as FlowStage
  if (kb >= 0 && endStage !== 'crisis') msgs[kb] = { ...msgs[kb], active: true }

  return { messages: msgs, stage: endStage, accepted, booked, crisisAnswered }
}

/** Действия, которые доводят переписку до нужного этажа — превью следует за редактором. */
export function pathTo(cfg: BotConfig, step: BotStep, at = minutesNow()): ChatAction[] {
  const a: ChatAction[] = [{ t: 'start', at }]
  if (step === 'welcome' || step === 'consent') return a
  if (step === 'crisis') {
    a.push({ t: 'text', text: CRISIS_DEMO_TEXT, at })
    return a
  }
  if (cfg.consent) a.push({ t: 'press', id: 'consent_yes', at })
  if (step === 'magnet') return a
  a.push({ t: 'press', id: cfg.quiz.length ? 'quiz_start' : 'skip_quiz', at })
  const answers = step === 'quiz' ? cfg.quiz.slice(0, -1) : cfg.quiz
  for (const q of answers) a.push({ t: 'press', id: `q:${q.id}:0`, at })
  if (step === 'quiz' || step === 'offer' || step === 'booking') return a
  a.push({ t: 'press', id: 'later', at })
  return a
}
