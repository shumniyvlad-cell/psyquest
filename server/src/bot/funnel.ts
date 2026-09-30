// Воронка Telegram-бота — чистая логика без сети и БД.
// Вход: апдейт + конфиг + состояние лида. Выход: действия (что отправить) и новое состояние.
// Поведение повторяет эталонное превью игры (runFlow в src/minigames/bot/flow.ts); сверх него —
// только то, что нужно живому боту: /admin, /forget, уведомления владельцу, честный подсчёт записи.
import { safeEqual } from '../lib/crypto.ts'
import type { BotConfig, Button, TgCallbackQuery, TgMessage, TgUpdate, TgUser } from '../types.ts'
import { hasCrisisMarkers, normalizeCrisisText } from './crisis.ts'
import {
  checkUrl,
  DEFAULT_CONSENT_TEXT,
  DEFAULT_CRISIS_TEXT,
  FLOW_TEXT,
  magnetMessage,
  offerMessage,
  SERVER_TEXT,
} from './texts.ts'

/** Самый дальний этап воронки (для карточек и списка лидов) */
export type Stage = 'welcome' | 'magnet' | 'quiz' | 'offer' | 'booking'

/** Где лид сейчас и какие кнопки активны — как FlowStage в превью */
export type Flow = 'consent' | 'magnet' | 'quiz' | 'offer' | 'later' | 'declined' | 'booked' | 'crisis'

const STAGE_RANK: Record<Stage, number> = { welcome: 0, magnet: 1, quiz: 2, offer: 3, booking: 4 }

export const STAGE_LABEL: Record<Stage, string> = {
  welcome: 'ещё не дал согласие',
  magnet: 'получил лид-магнит',
  quiz: 'проходит мини-тест',
  offer: 'видел предложение',
  booking: 'перешёл к записи',
}

export interface LeadState {
  stage: Stage
  flow: Flow
  /** Номер текущего вопроса квиза; -1 — квиз не идёт */
  quizIndex: number
  /** Кнопку записи уже показывали — она работает из любого сообщения (как в превью) */
  bookShown: boolean
  /** Ответы квиза, имя и username — только если данные можно хранить (согласие дано или не требуется) */
  answers: string[]
  name: string | null
  username: string | null
  consentAt: number | null
  magnetAt: number | null
  quizDoneAt: number | null
  offerAt: number | null
  bookingAt: number | null
  /** Когда нажал «Пока подумаю» — от этого момента считаем сутки до напоминания */
  laterAt: number | null
  followUpAt: number | null
  crisis: boolean
  createdAt: number
}

export type Action =
  | { type: 'send'; chatId: number; text: string; buttons?: Button[][] }
  | { type: 'edit'; chatId: number; messageId: number; text: string }
  | { type: 'answer'; callbackId: string; text?: string }

export interface FunnelContext {
  config: BotConfig
  adminCode: string
  ownerChatId: number | null
  /** false — исчерпан лимит попыток /admin */
  adminAllowed: boolean
  now: number
}

export interface FunnelResult {
  actions: Action[]
  /** Новое состояние лида; нет поля — сохранять нечего */
  lead?: LeadState
  /** Лид попросил удалить свои данные */
  forget?: true
  /** Привязать владельца бота к этому chat_id */
  owner?: number
  /** Неверный код /admin — для лимитера попыток */
  adminFailed?: true
}

// callback_data кнопок (ответ квиза — «a:<вопрос>:<вариант>»)
export const CB = { consentYes: 'c', consentNo: 'n', quiz: 'q', skipQuiz: 'o', book: 'b', later: 'l' } as const

export const FOLLOW_UP_DELAY = 24 * 60 * 60 * 1000

export function newLead(now: number): LeadState {
  return {
    stage: 'welcome',
    flow: 'consent',
    quizIndex: -1,
    bookShown: false,
    answers: [],
    name: null,
    username: null,
    consentAt: null,
    magnetAt: null,
    quizDoneAt: null,
    offerAt: null,
    bookingAt: null,
    laterAt: null,
    followUpAt: null,
    crisis: false,
    createdAt: now,
  }
}

/** Можно ли хранить данные лида и пересылать их владельцу */
export function canStore(lead: LeadState, config: BotConfig): boolean {
  return !config.consent || lead.consentAt !== null
}

export function handleUpdate(update: TgUpdate, lead: LeadState | null, ctx: FunnelContext): FunnelResult {
  if (update.callback_query) return onCallback(update.callback_query, lead, ctx)
  if (update.message) return onMessage(update.message, lead, ctx)
  return { actions: [] }
}

/** Напоминание — одно и только после «Пока подумаю» (как в превью); кризисным лидам — никогда */
export function followUpDue(lead: LeadState, now: number): boolean {
  return (
    lead.flow === 'later' &&
    lead.laterAt !== null &&
    lead.followUpAt === null &&
    !lead.crisis &&
    now - lead.laterAt >= FOLLOW_UP_DELAY
  )
}

/** Напоминание через сутки: текст followUp и кнопка записи (как в превью). */
export function buildFollowUp(config: BotConfig, chatId: number): Action | null {
  if (!config.followUp.trim()) return null
  return send(chatId, config.followUp, [[bookButton(config)]])
}

// ---------- сообщения ----------

function onMessage(msg: TgMessage, lead: LeadState | null, ctx: FunnelContext): FunnelResult {
  const from = msg.from
  if (msg.chat.type !== 'private' || !from || from.is_bot) return { actions: [] }
  const chatId = msg.chat.id
  const text = (msg.text ?? '').trim()
  // стикеры, фото, голосовые — как непонятный текст в превью
  if (!text) return { actions: [send(chatId, FLOW_TEXT.fallback)] }

  const cmd = /^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(text)
  const command = cmd?.[1]?.toLowerCase()
  if (command === 'start') return start(chatId, from, lead, ctx)
  if (command === 'admin') return admin(chatId, cmd?.[2] ?? '', ctx)
  if (command === 'forget') return forget(chatId)
  return freeText(chatId, from, text, lead, ctx)
}

function start(chatId: number, from: TgUser, lead: LeadState | null, ctx: FunnelContext): FunnelResult {
  const { config } = ctx
  const next = touch(lead, from, ctx)
  next.quizIndex = -1
  const actions: Action[] = []
  if (config.welcome.trim()) actions.push(send(chatId, config.welcome))
  if (config.consent) {
    // согласие спрашиваем на каждом /start, как в превью
    next.flow = 'consent'
    actions.push(
      send(chatId, config.consentText.trim() ? config.consentText : DEFAULT_CONSENT_TEXT, [
        [{ text: FLOW_TEXT.consentYes, data: CB.consentYes }],
        [{ text: FLOW_TEXT.consentNo, data: CB.consentNo }],
      ]),
    )
    return { actions, lead: next }
  }
  if (!lead) notifyOwner(actions, ctx, card('Новый лид', next, config))
  sendMagnet(actions, chatId, next, ctx, true)
  return { actions, lead: next }
}

function admin(chatId: number, arg: string, ctx: FunnelContext): FunnelResult {
  if (!ctx.adminAllowed) return { actions: [send(chatId, SERVER_TEXT.adminLocked)] }
  const code = arg.trim()
  if (!/^\d{6}$/.test(code)) return { actions: [send(chatId, SERVER_TEXT.adminFormat)] }
  if (!safeEqual(code, ctx.adminCode)) return { actions: [send(chatId, SERVER_TEXT.adminBad)], adminFailed: true }
  const actions: Action[] = [send(chatId, SERVER_TEXT.adminOk)]
  if (ctx.ownerChatId !== null && ctx.ownerChatId !== chatId) actions.push(send(ctx.ownerChatId, SERVER_TEXT.ownerMoved))
  return { actions, owner: chatId }
}

function forget(chatId: number): FunnelResult {
  return { actions: [send(chatId, SERVER_TEXT.forgotten)], forget: true }
}

// «Удалите мои данные», «отзываю согласие» — текст согласия обещает, что об этом достаточно написать
function wantsForget(text: string): boolean {
  const n = normalizeCrisisText(text)
  return (
    /(?<![а-я])(?:удали|удалите|удалить|сотри|сотрите|стереть)(?![а-я])(?: [а-я]+){0,3} (?:данн|ответ|информац|переписк)/.test(n) ||
    /(?<![а-я])(?:отзываю|отозвать|отзовите|отзову)(?![а-я])(?: [а-я]+){0,2} согласи/.test(n)
  )
}

function freeText(chatId: number, from: TgUser, text: string, lead: LeadState | null, ctx: FunnelContext): FunnelResult {
  const { config } = ctx

  // Кризис — раньше всего остального, на любом шаге
  if (hasCrisisMarkers(text)) {
    const next = touch(lead, from, ctx)
    next.crisis = true
    next.flow = 'crisis'
    next.quizIndex = -1
    const actions: Action[] = [send(chatId, config.crisisText.trim() ? config.crisisText : DEFAULT_CRISIS_TEXT)]
    if (ctx.ownerChatId !== null && ctx.ownerChatId !== chatId) {
      // Сообщение уходит психологу даже без согласия: риск для жизни (кризисный текст обещает, что психолог его увидит).
      // В боте без согласия оно не сохраняется.
      const lines = [
        'СРОЧНО: сообщение с признаками кризиса.',
        whoFrom(from),
        '',
        `«${clip(text, 1500)}»`,
        '',
        'Человеку автоматически отправлен кризисный ответ с телефонами помощи. Свяжись с ним как можно скорее.',
      ]
      if (!canStore(next, config)) {
        lines.push('Согласия на обработку данных нет: сообщение передано только из-за риска для жизни и в боте не сохранено.')
      }
      actions.push(send(ctx.ownerChatId, lines.join('\n')))
    }
    return { actions, lead: next }
  }

  if (wantsForget(text)) return forget(chatId)
  if (!lead) return start(chatId, from, null, ctx)
  const next = touch(lead, from, ctx)

  // После кризиса воронка стоит: сообщения только передаём психологу, без ответа (как в превью)
  if (lead.flow === 'crisis') {
    const actions: Action[] = []
    if (ctx.ownerChatId !== null && ctx.ownerChatId !== chatId) {
      actions.push(send(ctx.ownerChatId, `Новое сообщение после кризисного\n${whoFrom(from)}\n\n«${clip(text, 3000)}»`))
    }
    return { actions, lead: next }
  }

  const actions: Action[] = [send(chatId, FLOW_TEXT.fallback)]
  // Человек видит то же, что в превью; психологу вопрос уходит, только если есть согласие
  if (ctx.ownerChatId !== null && ctx.ownerChatId !== chatId && canStore(next, config)) {
    actions.push(send(ctx.ownerChatId, `Сообщение от лида\n${who(next)}\n\n«${clip(text, 3000)}»`))
  }
  return { actions, lead: next }
}

// ---------- кнопки ----------

function onCallback(q: TgCallbackQuery, lead: LeadState | null, ctx: FunnelContext): FunnelResult {
  const msg = q.message
  if (!msg || msg.chat.type !== 'private' || q.from.is_bot) return { actions: [answer(q.id)] }
  const chatId = msg.chat.id
  const data = q.data ?? ''
  const { config, now } = ctx

  if (!lead) {
    const r = start(chatId, q.from, null, ctx)
    return { ...r, actions: [answer(q.id), ...r.actions] }
  }
  // Кризис останавливает воронку: никакие кнопки больше не работают до /start
  if (lead.flow === 'crisis') return { actions: [answer(q.id)] }

  const stale: FunnelResult = { actions: [answer(q.id, SERVER_TEXT.stale)] }
  const actions: Action[] = [answer(q.id)]

  // Кнопка записи работает из любого сообщения, где её показали (как ссылка в превью)
  if (data === CB.book) {
    if (!lead.bookShown) return stale
    return book(chatId, q, lead, ctx)
  }

  if (data === CB.consentYes || data === CB.consentNo) {
    if (lead.flow !== 'consent') return stale
    const yes = data === CB.consentYes
    const firstTime = lead.consentAt === null
    // «Не сейчас» = согласия нет: имя и ответы стираются и дальше не сохраняются
    const next = touch({ ...lead, consentAt: yes ? (lead.consentAt ?? now) : null }, q.from, ctx)
    const shown = msg.text || (config.consentText.trim() ? config.consentText : DEFAULT_CONSENT_TEXT)
    actions.push(edit(chatId, msg.message_id, `${shown}\n\n${SERVER_TEXT.answer(yes ? FLOW_TEXT.consentYes : FLOW_TEXT.consentNo)}`))
    if (yes) {
      if (firstTime) notifyOwner(actions, ctx, card('Новый лид', next, config))
      sendMagnet(actions, chatId, next, ctx, true)
    } else {
      sendMagnet(actions, chatId, next, ctx, false, true)
      actions.push(send(chatId, FLOW_TEXT.declinedOffer, [[bookButton(config)]]))
      next.bookShown = true
      next.flow = 'declined'
      advance(next, 'offer')
      next.offerAt ??= now
    }
    return { actions, lead: next }
  }

  const next = touch(lead, q.from, ctx)

  if (data === CB.quiz) {
    if (lead.flow !== 'magnet' || config.quiz.length === 0) return stale
    next.answers = []
    askQuestion(actions, chatId, next, config, 0)
    return { actions, lead: next }
  }

  if (data === CB.skipQuiz) {
    if (lead.flow !== 'magnet') return stale
    sendOffer(actions, chatId, next, ctx)
    return { actions, lead: next }
  }

  const m = /^a:(\d{1,2}):(\d{1,2})$/.exec(data)
  if (m) {
    const i = Number(m[1])
    const j = Number(m[2])
    const question = config.quiz[i]
    const option = question?.options[j]
    if (lead.flow !== 'quiz' || lead.quizIndex !== i || !question || option === undefined) return stale
    if (canStore(next, config)) next.answers = [...next.answers.slice(0, i), option.trim()]
    actions.push(edit(chatId, msg.message_id, `${questionText(config, i)}\n\n${SERVER_TEXT.answer(option.trim() || '…')}`))
    if (i + 1 < config.quiz.length) {
      askQuestion(actions, chatId, next, config, i + 1)
    } else {
      next.quizDoneAt ??= now
      sendOffer(actions, chatId, next, ctx)
      if (canStore(next, config)) notifyOwner(actions, ctx, card('Лид прошёл мини-тест', next, config))
    }
    return { actions, lead: next }
  }

  if (data === CB.later) {
    if (lead.flow !== 'offer') return stale
    next.flow = 'later'
    next.laterAt = now
    next.followUpAt = null // бот пообещал одно напоминание — ставим его заново
    actions.push(send(chatId, config.followUp.trim() ? FLOW_TEXT.laterReplyFollow : FLOW_TEXT.laterReply))
    return { actions, lead: next }
  }

  return stale
}

/** Честный подсчёт записи: callback-кнопка засчитывает клик и присылает кнопку-ссылку. */
function book(chatId: number, q: TgCallbackQuery, lead: LeadState, ctx: FunnelContext): FunnelResult {
  const { config, now } = ctx
  const next = touch(lead, q.from, ctx)
  const actions: Action[] = [answer(q.id)]
  const label = bookLabel(config)
  const link = checkUrl(config.bookingUrl)
  if (!link.ok || !link.url) {
    actions.push(send(chatId, SERVER_TEXT.bookingBroken))
    notifyOwner(actions, ctx, `Человек хотел записаться, но ссылка для записи не работает. Проверь её в игре на этаже «Кнопка записи».`)
    return { actions, lead: next }
  }
  next.flow = 'booked'
  next.quizIndex = -1
  advance(next, 'booking')
  next.bookingAt ??= now
  actions.push(send(chatId, SERVER_TEXT.bookingLink, [[{ text: label, url: link.url }]]))
  // Повторное нажатие в той же сессии — просто ещё раз ссылка, без второго уведомления
  if (lead.flow !== 'booked') {
    notifyOwner(
      actions,
      ctx,
      canStore(next, config)
        ? card(`Лид нажал «${label}»`, next, config)
        : `Человек без согласия на обработку данных нажал «${label}» и перешёл к записи. Имя и ответы не сохраняются.`,
    )
  }
  return { actions, lead: next }
}

// ---------- шаги воронки ----------

function sendMagnet(actions: Action[], chatId: number, lead: LeadState, ctx: FunnelContext, withQuiz: boolean, declined = false) {
  const { config } = ctx
  advance(lead, 'magnet')
  lead.magnetAt ??= ctx.now
  lead.flow = 'magnet'
  const rows: Button[][] = []
  const link = checkUrl(config.leadMagnetUrl)
  if (link.ok && link.url) rows.push([{ text: FLOW_TEXT.magnetOpen, url: link.url }])
  if (withQuiz) {
    rows.push([
      config.quiz.length ? { text: FLOW_TEXT.quizStart, data: CB.quiz } : { text: FLOW_TEXT.skipQuiz, data: CB.skipQuiz },
    ])
  }
  actions.push(send(chatId, magnetMessage(config, withQuiz, declined), rows.length ? rows : undefined))
}

function questionText(config: BotConfig, i: number): string {
  const text = config.quiz[i]?.text ?? ''
  return `Вопрос ${i + 1} из ${config.quiz.length}\n\n${text.trim() ? text : SERVER_TEXT.emptyQuestion}`
}

function askQuestion(actions: Action[], chatId: number, lead: LeadState, config: BotConfig, i: number) {
  const q = config.quiz[i]
  if (!q) return
  advance(lead, 'quiz')
  lead.flow = 'quiz'
  lead.quizIndex = i
  actions.push(
    send(
      chatId,
      questionText(config, i),
      q.options.map((o, j) => [{ text: o.trim() || SERVER_TEXT.emptyOption, data: `a:${i}:${j}` }]),
    ),
  )
}

function sendOffer(actions: Action[], chatId: number, lead: LeadState, ctx: FunnelContext) {
  const { config } = ctx
  advance(lead, 'offer')
  lead.offerAt ??= ctx.now
  lead.flow = 'offer'
  lead.quizIndex = -1
  lead.bookShown = true
  actions.push(send(chatId, offerMessage(config), [[bookButton(config)], [{ text: FLOW_TEXT.later, data: CB.later }]]))
}

// ---------- помощники ----------

function bookLabel(config: BotConfig): string {
  return config.bookingText.trim() || SERVER_TEXT.bookingDefault
}

function bookButton(config: BotConfig): Button {
  return { text: bookLabel(config), data: CB.book }
}

/** Копия лида с актуальными именем и username — только если данные можно хранить */
function touch(lead: LeadState | null, from: TgUser, ctx: FunnelContext): LeadState {
  const next: LeadState = { ...(lead ?? newLead(ctx.now)), answers: [...(lead?.answers ?? [])] }
  if (canStore(next, ctx.config)) {
    next.name = fullName(from)
    next.username = from.username ?? null
  } else {
    next.name = null
    next.username = null
    next.answers = []
  }
  return next
}

function advance(lead: LeadState, stage: Stage) {
  if (STAGE_RANK[stage] > STAGE_RANK[lead.stage]) lead.stage = stage
}

function notifyOwner(actions: Action[], ctx: FunnelContext, text: string) {
  if (ctx.ownerChatId !== null) actions.push(send(ctx.ownerChatId, text))
}

function fullName(from: TgUser): string | null {
  return [from.first_name, from.last_name].filter(Boolean).join(' ').trim() || null
}

function whoFrom(from: TgUser): string {
  return `${fullName(from) ?? 'Без имени'} (${from.username ? '@' + from.username : 'username не указан'})`
}

function who(lead: LeadState): string {
  return `${lead.name ?? 'Без имени'} (${lead.username ? '@' + lead.username : 'username не указан'})`
}

function card(title: string, lead: LeadState, config: BotConfig): string {
  const lines = [
    title,
    `Имя: ${lead.name ?? '—'}`,
    `Telegram: ${lead.username ? '@' + lead.username : 'username не указан'}`,
    `Этап: ${STAGE_LABEL[lead.stage]}`,
  ]
  if (lead.answers.length) {
    lines.push('', 'Ответы на вопросы:')
    lead.answers.forEach((a, i) => lines.push(`${i + 1}. ${clip(config.quiz[i]?.text ?? 'Вопрос', 120)} — ${a}`))
  }
  return lines.join('\n')
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function send(chatId: number, text: string, buttons?: Button[][]): Action {
  return buttons ? { type: 'send', chatId, text, buttons } : { type: 'send', chatId, text }
}

function edit(chatId: number, messageId: number, text: string): Action {
  return { type: 'edit', chatId, messageId, text }
}

function answer(callbackId: string, text?: string): Action {
  return text ? { type: 'answer', callbackId, text } : { type: 'answer', callbackId }
}
