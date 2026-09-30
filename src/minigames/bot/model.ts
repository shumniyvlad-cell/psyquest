// Башня Ботов — модель: дефолтный сценарий, валидация и текстовый экспорт.
// Этика воронки: бот не лечит и не ставит диагнозы, ценность — до просьбы о записи,
// согласие — до сбора ответов, кризис — сразу помощь, а не продажа, никаких дожимов.

import type { BotConfig, BotQuizQuestion, PositioningArtifact, ProductArtifact } from '../../game/types'
import { CRISIS_MARKERS } from './crisis'

export const DEFAULT_CRISIS_TEXT =
  'Мне очень жаль, что тебе сейчас так тяжело. Я бот и не могу помочь в такой ситуации, но помощь есть прямо сейчас. Экстренные службы: 112. Экстренная психологическая помощь МЧС: +7 (495) 989-50-50. Телефон доверия для детей, подростков и родителей: 8-800-2000-122, бесплатно и круглосуточно. Если рядом есть близкий человек, напиши или позвони ему. Твой психолог увидит это сообщение.'

export const DEFAULT_CONSENT_TEXT =
  'Прежде чем задать пару вопросов, нужно твоё согласие. Бот сохранит имя в Telegram и ответы, чтобы психолог мог подготовиться к встрече. Данные не передаются третьим лицам, а удалить их можно в любой момент — просто напиши об этом. Нажимая «Даю согласие», ты соглашаешься на обработку персональных данных по 152-ФЗ.'

/** Строка со ссылкой на политику внутри текста согласия (отдельного поля в BotConfig нет). */
export const POLICY_PREFIX = 'Политика конфиденциальности: '

export type BotStep = 'welcome' | 'consent' | 'magnet' | 'quiz' | 'offer' | 'booking' | 'followup' | 'crisis'

export interface BotIssue {
  id: string
  step: BotStep
  severity: 'error' | 'warn'
  text: string
}

export const LIMITS = {
  button: 30,
  message: 1000,
  botName: 64,
  quizMin: 1,
  quizMax: 3,
  optionsMin: 2,
  optionsMax: 4,
} as const

export const BOT_STEPS: readonly { id: BotStep; title: string }[] = [
  { id: 'welcome', title: 'Имя и приветствие' },
  { id: 'consent', title: 'Согласие на обработку данных' },
  { id: 'magnet', title: 'Лид-магнит' },
  { id: 'quiz', title: 'Квиз' },
  { id: 'offer', title: 'Оффер' },
  { id: 'booking', title: 'Кнопка записи' },
  { id: 'followup', title: 'Напоминание через сутки' },
  { id: 'crisis', title: 'Кризисный ответ' },
]

export const STEP_TITLE: Record<BotStep, string> = Object.fromEntries(BOT_STEPS.map((s) => [s.id, s.title])) as Record<
  BotStep,
  string
>

/** Служебные тексты воронки, которые не настраиваются (их же увидит сервер и экспорт). */
export const FLOW_TEXT = {
  start: 'Запустить',
  consentYes: 'Даю согласие',
  consentNo: 'Не сейчас',
  magnetOpen: 'Открыть материал',
  quizStart: 'Ответить на вопросы',
  skipQuiz: 'Узнать о встрече',
  later: 'Пока подумаю',
  declinedIntro: 'Хорошо, ответы сохранять не буду.',
  declinedOffer:
    'Если захочется разобрать свою ситуацию со специалистом, запись по кнопке ниже. Больше ничего присылать не буду.',
  laterReply: 'Конечно, без спешки. Материал остаётся у тебя.',
  laterReplyFollow: 'Конечно, без спешки. Материал остаётся у тебя, а завтра я один раз коротко напомню о себе.',
  fallback: 'Я бот и понимаю только кнопки под сообщениями. Всё главное, включая стоимость, будет через пару шагов.',
} as const

// ---------- Мелкие утилиты ----------

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

const len = (s: string) => [...s].length

function clip(s: string, n: number): string {
  const t = s.trim().replace(/\s+/g, ' ')
  return len(t) > n ? `${[...t].slice(0, n - 1).join('')}…` : t
}

function sentence(raw: string | undefined): string {
  const t = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (!t) return ''
  const cap = t[0].toUpperCase() + t.slice(1)
  return /[.!?…]$/.test(cap) ? cap : `${cap}.`
}

function stripEnd(raw: string): string {
  return raw.trim().replace(/[.!?…:;,\s]+$/u, '')
}

/** «Название» — без двойных кавычек, если они уже есть внутри. */
export function quoteTitle(t: string): string {
  const s = t.trim()
  if (!s) return '«без названия»'
  return /[«»"„“]/.test(s) ? s : `«${s}»`
}

export function formatPrice(price: number): string {
  return `${Math.round(price).toLocaleString('ru-RU')}\u00a0₽`
}

export function priceLine(price: number): string {
  return Number.isFinite(price) && price > 0 ? `Стоимость: ${formatPrice(price)}` : 'Стоимость: бесплатно'
}

function questionsWord(n: number): string {
  if (n === 1) return 'один короткий вопрос'
  if (n === 2) return 'два коротких вопроса'
  if (n === 3) return 'три коротких вопроса'
  if (n === 4) return 'четыре коротких вопроса'
  return `${n} коротких вопросов`
}

export function magnetMessage(cfg: BotConfig, withQuiz: boolean, declined = false): string {
  const head = `${declined ? `${FLOW_TEXT.declinedIntro} ` : ''}Держи материал: ${quoteTitle(cfg.leadMagnetTitle)}. Он твой в любом случае, без условий.`
  if (!withQuiz || cfg.quiz.length === 0) return head
  return `${head}\n\nА если хочешь, ответь на ${questionsWord(cfg.quiz.length)} — подскажу, какой шаг будет следующим.`
}

export function offerMessage(cfg: BotConfig): string {
  const body = cfg.offerText.trim()
  return body ? `${body}\n\n${priceLine(cfg.offerPrice)}` : priceLine(cfg.offerPrice)
}

export function newQuestionId(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

// ---------- Ссылки ----------

const TG_USERNAME = /^[A-Za-z][A-Za-z0-9_]{4,31}$/

export interface UrlCheck {
  ok: boolean
  /** Нормализованный адрес, который откроет бот */
  url: string | null
  insecure: boolean
  reason?: 'empty' | 'format' | 'tg-user'
}

/** Разбирает ссылку: https://…, t.me/username, @username, домен без протокола. */
export function checkUrl(raw: string): UrlCheck {
  const s = raw.trim()
  if (!s) return { ok: false, url: null, insecure: false, reason: 'empty' }
  if (/\s/.test(s)) return { ok: false, url: null, insecure: false, reason: 'format' }
  if (s.startsWith('@')) {
    const u = s.slice(1)
    return TG_USERNAME.test(u)
      ? { ok: true, url: `https://t.me/${u}`, insecure: false }
      : { ok: false, url: null, insecure: false, reason: 'tg-user' }
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) && !/^[^/:]+:\d/.test(s) ? s : `https://${s}`
  let u: URL
  try {
    u = new URL(withScheme)
  } catch {
    return { ok: false, url: null, insecure: false, reason: 'format' }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, url: null, insecure: false, reason: 'format' }
  const host = u.hostname.toLowerCase()
  if (!/^[a-z0-9.-]+$/.test(host) || !/\.([a-z]{2,}|xn--[a-z0-9-]{2,})$/.test(host) || host.includes('..')) {
    return { ok: false, url: null, insecure: false, reason: 'format' }
  }
  if (host === 't.me' || host === 'telegram.me' || host === 'www.t.me') {
    const first = u.pathname.split('/').filter(Boolean)[0] ?? ''
    const invite = first.startsWith('+') || first === 'joinchat'
    if (!invite && !TG_USERNAME.test(first)) return { ok: false, url: null, insecure: false, reason: 'tg-user' }
  }
  return { ok: true, url: u.toString(), insecure: u.protocol === 'http:' }
}

/** Короткое отображение ссылки без протокола. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

// ---------- Политика конфиденциальности внутри текста согласия ----------

export function getPolicyUrl(consentText: string): string {
  const line = consentText.split('\n').find((l) => l.startsWith(POLICY_PREFIX))
  return line ? line.slice(POLICY_PREFIX.length) : ''
}

export function setPolicyUrl(consentText: string, url: string): string {
  const lines = consentText.split('\n')
  const idx = lines.findIndex((l) => l.startsWith(POLICY_PREFIX))
  if (!url) {
    if (idx < 0) return consentText
    lines.splice(idx, 1)
    return lines.join('\n').replace(/\n+$/, '')
  }
  if (idx >= 0) {
    lines[idx] = POLICY_PREFIX + url
    return lines.join('\n')
  }
  const base = consentText.replace(/\s+$/, '')
  return `${base}${base ? '\n\n' : ''}${POLICY_PREFIX}${url}`
}

// ---------- Этические проверки текста ----------

const PRESSURE: RegExp[] = [
  /(?<![а-я])осталось (?:(?:всего|лишь|только|буквально) )?(?:\d+|одно|одна|два|две|три|четыре|пять|пара|пару|несколько) (?:свободн[а-я]* )?(?:мест|окошк|окон|слот)[а-я]*/,
  /(?<![а-я])последн[а-я]* (?:свободн[а-я]* )?(?:мест[а-я]*|окошк[а-я]*|слот[а-я]*|шанс)/,
  /(?<![а-я])только (?:сегодня|до завтра|до конца дня|до полуночи|24 часа)/,
  /(?<![а-я])успей(?:те)?(?![а-я])/,
  /(?<![а-я])(?:скидка|цена|предложение|бонус) (?:сгорит|сгорает|исчезнет|пропадет)/,
  /(?<![а-я])сгорит через/,
  /(?<![а-я])(?:количество )?мест[а]? ограничен[а-я]*/,
  /(?<![а-я])(?:не )?упусти(?:те)? (?:свой )?шанс/,
  /(?<![а-я])торопи(?:сь|тесь)(?![а-я])/,
  /(?<![а-я])пока не поздно/,
]

const CURE: RegExp[] = [
  /(?<![а-я])(?:вылеч|излеч)[а-я]*/,
  /(?<![а-я])(?:поставл|поставим|поставлю|определ)[а-я]* (?:тебе |вам )?диагноз[а-я]*/,
  /(?<![а-я])гарантир[а-я]* (?:результат|избавлени|излечени|успех)[а-я]*/,
  /(?<![а-я])100 ?% (?:результат|гарант)[а-я]*/,
  /(?<![а-я])навсегда избав[а-я]*/,
]

const SALES = /₽|(?<![а-я])руб(?:\.|лей|ля|ль)?(?![а-я])|скидк|стоимост|оплат|(?<![а-я])запиш(?:ись|итесь)(?![а-я])|записаться|(?<![а-я])купи(?:ть|те)?(?![а-я])|(?<![а-я])цен[аы](?![а-я])|(?<![а-я])акци[яи](?![а-я])/

const low = (s: string) => s.toLowerCase().replace(/ё/g, 'е')
const lowSpaced = (s: string) => low(s).replace(/[^a-zа-я0-9%₽\s]+/g, ' ').replace(/\s+/g, ' ')

function findPhrase(text: string, list: RegExp[]): string | null {
  const t = lowSpaced(text)
  for (const re of list) {
    const m = t.match(re)
    if (m) return m[0].trim()
  }
  return null
}

export const findPressure = (text: string) => findPhrase(text, PRESSURE)
export const findCurePromise = (text: string) => findPhrase(text, CURE)

// ---------- Нормализация ----------

/** Приводит сохранённый конфиг к полному виду (старые сейвы, частичные данные). */
export function normalizeConfig(v: Partial<BotConfig> | null | undefined): BotConfig {
  const src = v ?? {}
  const price = Number(src.offerPrice)
  const quiz: BotQuizQuestion[] = Array.isArray(src.quiz)
    ? src.quiz.map((q, i) => ({
        id: str(q?.id) || `q${i + 1}`,
        text: str(q?.text),
        options: Array.isArray(q?.options) ? q.options.map(str) : [],
      }))
    : []
  const cfg: BotConfig = {
    botName: str(src.botName),
    welcome: str(src.welcome),
    consent: src.consent !== false,
    consentText: str(src.consentText),
    leadMagnetTitle: str(src.leadMagnetTitle),
    leadMagnetUrl: str(src.leadMagnetUrl),
    quiz,
    offerText: str(src.offerText),
    offerPrice: Number.isFinite(price) ? price : 0,
    bookingText: str(src.bookingText),
    bookingUrl: str(src.bookingUrl),
    followUp: str(src.followUp),
    crisisText: str(src.crisisText),
  }
  if (src.deployed) cfg.deployed = src.deployed
  return cfg
}

// ---------- Дефолтный сценарий ----------

export function defaultBotConfig(ctx: {
  heroName: string
  positioning?: PositioningArtifact
  product?: ProductArtifact
}): BotConfig {
  const name = ctx.heroName.trim()
  const pos = ctx.positioning
  const lm = ctx.product?.leadMagnet
  const entry = ctx.product?.entry

  const statement = name ? sentence(pos?.statement) : ''
  const intro = name ? `Привет! Меня зовут ${name}, я психолог.` : 'Привет! Это бот-помощник психолога.'
  const body = name
    ? 'Этот бот — мой помощник. Он не ставит диагнозы и не заменяет консультацию, зато здесь можно забрать бесплатный материал и за пару минут понять, чем я могу помочь.'
    : 'Он не ставит диагнозы и не заменяет консультацию, зато здесь можно забрать бесплатный материал и за пару минут понять, с чего начать.'
  const welcome = `${[intro, statement].filter(Boolean).join(' ')}\n\n${body}`

  const magnetTitle = lm?.name?.trim() || 'Чек-лист «Как понять, что пора к психологу»'

  const pain = stripEnd(pos?.pain ?? '')
  const q1: BotQuizQuestion =
    pain && len(pain) <= 90
      ? { id: 'q1', text: `Узнаёшь себя в этом: «${pain}»?`, options: ['Да, это про меня', 'Отчасти', 'Скорее нет'] }
      : {
          id: 'q1',
          text: 'Что сейчас беспокоит сильнее всего?',
          options: ['Тревога и напряжение', 'Отношения с близкими', 'Усталость и выгорание', 'Пока сложно сказать'],
        }
  const quiz: BotQuizQuestion[] = [
    q1,
    { id: 'q2', text: 'Как давно это с тобой?', options: ['Пару недель', 'Несколько месяцев', 'Больше года'] },
    {
      id: 'q3',
      text: 'Был ли у тебя опыт работы с психологом?',
      options: ['Да, и он помог', 'Да, но не зашло', 'Нет, это впервые'],
    },
  ]

  let offerText: string
  if (entry?.name?.trim()) {
    const format = entry.format?.trim() ? ` (${stripEnd(entry.format)})` : ''
    const promise = sentence(entry.promise)
    offerText = `Спасибо за ответы. Следующий шаг — ${quoteTitle(entry.name)}${format}.${promise ? ` ${promise}` : ''}\n\nЭто спокойное знакомство без обязательств: решение о дальнейшей работе остаётся за тобой.`
  } else {
    offerText =
      'Спасибо за ответы. Если хочется разобраться глубже, приходи на знакомство: 30 минут онлайн, где мы спокойно обсудим твой запрос и поймём, подхожу ли я тебе как специалист.\n\nБез обязательств: решение о дальнейшей работе остаётся за тобой.'
  }
  const rawPrice = Number(entry?.price)
  const offerPrice = Number.isFinite(rawPrice) && rawPrice > 0 ? Math.round(rawPrice) : 0

  const followUp = `${name ? `Привет! Это снова ${name}.` : 'Привет! Это снова бот-помощник психолога.'} Удалось заглянуть в материал? Если после него захотелось разобрать свою ситуацию, запись по кнопке ниже. Больше напоминать не буду — возвращайся, когда будет удобно.`

  return {
    botName: name ? `${name} | психолог` : 'Бот психолога',
    welcome,
    consent: true,
    consentText: DEFAULT_CONSENT_TEXT,
    leadMagnetTitle: magnetTitle,
    leadMagnetUrl: '',
    quiz,
    offerText,
    offerPrice,
    bookingText: offerPrice > 0 ? 'Записаться на встречу' : 'Записаться на знакомство',
    bookingUrl: '',
    followUp,
    crisisText: DEFAULT_CRISIS_TEXT,
  }
}

// ---------- Валидация ----------

function urlIssues(step: BotStep, id: string, raw: string, what: 'magnet' | 'booking' | 'policy'): BotIssue[] {
  const res = checkUrl(raw)
  if (res.ok) {
    return res.insecure
      ? [{ id: `${id}.http`, step, severity: 'warn', text: 'Ссылка без https — часть телефонов предупредит о небезопасном сайте.' }]
      : []
  }
  if (what === 'policy') {
    return res.reason === 'empty'
      ? []
      : [{ id: `${id}.invalid`, step, severity: 'warn', text: 'Ссылка на политику не похожа на адрес — проверь её.' }]
  }
  if (res.reason === 'empty') {
    return [
      {
        id: `${id}.empty`,
        step,
        severity: 'error',
        text:
          what === 'magnet'
            ? 'Нет ссылки на материал — обещанная польза не дойдёт.'
            : 'Нет ссылки для записи — кнопка ведёт в никуда.',
      },
    ]
  }
  if (res.reason === 'tg-user') {
    return [
      {
        id: `${id}.invalid`,
        step,
        severity: 'error',
        text: 'Username в ссылке t.me — от 5 символов: латиница, цифры и подчёркивание.',
      },
    ]
  }
  return [
    {
      id: `${id}.invalid`,
      step,
      severity: 'error',
      text:
        what === 'magnet'
          ? 'Ссылка на материал не открывается — проверь адрес. Пример: https://disk.yandex.ru/…'
          : 'Ссылка записи не открывается. Подойдёт t.me/username, сайт или календарь.',
    },
  ]
}

function ethicsIssues(step: BotStep, id: string, text: string): BotIssue[] {
  const out: BotIssue[] = []
  const push = findPressure(text)
  if (push) {
    out.push({
      id: `${id}.pressure`,
      step,
      severity: 'error',
      text: `«${push}» — это дожим. Бот греет, а не давит: убери срочность и дефицит.`,
    })
  }
  const cure = findCurePromise(text)
  if (cure) {
    out.push({
      id: `${id}.cure`,
      step,
      severity: 'warn',
      text: `«${cure}» — бот не лечит и не обещает результат. Лучше опиши, что будет на встрече.`,
    })
  }
  return out
}

function longMessage(step: BotStep, id: string, text: string, what: string): BotIssue[] {
  return len(text.trim()) > LIMITS.message
    ? [
        {
          id: `${id}.long`,
          step,
          severity: 'warn',
          text: `${what} длиннее ${LIMITS.message} символов — на телефоне это простыня. Сократи до пары абзацев.`,
        },
      ]
    : []
}

/** id вопроса из id проблемы квиза (`quiz.q:<id>.…`), иначе null. */
export function issueQuestionId(issue: BotIssue): string | null {
  const m = issue.id.match(/^quiz\.q:([^.]+)\./)
  return m ? m[1] : null
}

export function validateBot(input: BotConfig): BotIssue[] {
  const cfg = normalizeConfig(input)
  const out: BotIssue[] = []
  const add = (step: BotStep, id: string, severity: BotIssue['severity'], text: string) =>
    out.push({ id, step, severity, text })

  // Этаж 1: имя и приветствие
  if (!cfg.botName.trim()) add('welcome', 'welcome.name.empty', 'error', 'Дай боту имя — без него чат выглядит как спам.')
  else if (len(cfg.botName.trim()) > LIMITS.botName)
    add('welcome', 'welcome.name.long', 'warn', `Имя длиннее ${LIMITS.botName} символов — Telegram его обрежет.`)
  if (!cfg.welcome.trim())
    add('welcome', 'welcome.text.empty', 'error', 'Приветствие пустое: человек нажмёт «Запустить» и получит тишину.')
  out.push(...longMessage('welcome', 'welcome.text', cfg.welcome, 'Приветствие'))
  out.push(...ethicsIssues('welcome', 'welcome.text', cfg.welcome))

  // Этаж 2: согласие
  if (!cfg.consent) {
    add(
      'consent',
      'consent.off',
      'error',
      'Согласие выключено, а квиз собирает ответы. По 152-ФЗ сначала согласие, потом вопросы.',
    )
  } else {
    const t = cfg.consentText.trim()
    if (!t) add('consent', 'consent.text.empty', 'error', 'Текст согласия пустой — человек не поймёт, на что соглашается.')
    else {
      if (!/персональн|152/i.test(t))
        add(
          'consent',
          'consent.text.pd',
          'warn',
          'Назови прямо: согласие на обработку персональных данных. Так требует 152-ФЗ.',
        )
      out.push(...longMessage('consent', 'consent.text', t, 'Текст согласия'))
      const policy = getPolicyUrl(cfg.consentText).trim()
      if (policy) out.push(...urlIssues('consent', 'consent.policy', policy, 'policy'))
    }
  }

  // Этаж 3: лид-магнит
  if (!cfg.leadMagnetTitle.trim())
    add('magnet', 'magnet.title.empty', 'error', 'У материала нет названия — непонятно, что человек получает.')
  else if (len(cfg.leadMagnetTitle.trim()) > 120)
    add('magnet', 'magnet.title.long', 'warn', 'Название длинное — сократи до одной строки.')
  out.push(...urlIssues('magnet', 'magnet.url', cfg.leadMagnetUrl, 'magnet'))

  // Этаж 4: квиз
  if (cfg.quiz.length < LIMITS.quizMin)
    add(
      'quiz',
      'quiz.empty',
      'error',
      'Добавь хотя бы один вопрос — так бот поймёт запрос и не будет продавать вслепую.',
    )
  if (cfg.quiz.length > LIMITS.quizMax)
    add('quiz', 'quiz.many', 'warn', `Больше ${LIMITS.quizMax} вопросов — люди устают. Хватит 1–3.`)
  cfg.quiz.forEach((q, qi) => {
    const n = qi + 1
    const base = `quiz.q:${q.id}`
    if (!q.text.trim()) add('quiz', `${base}.text.empty`, 'error', `Вопрос ${n} без текста.`)
    out.push(...longMessage('quiz', `${base}.text`, q.text, `Вопрос ${n}`))
    if (q.options.length < LIMITS.optionsMin)
      add('quiz', `${base}.options.few`, 'error', `У вопроса ${n} меньше двух вариантов — отвечать нечем.`)
    if (q.options.length > LIMITS.optionsMax)
      add(
        'quiz',
        `${base}.options.many`,
        'warn',
        `У вопроса ${n} больше ${LIMITS.optionsMax} вариантов — кнопки не поместятся на экране.`,
      )
    const seen = new Set<string>()
    let dup = false
    q.options.forEach((o, oi) => {
      const t = o.trim()
      if (!t) {
        add('quiz', `${base}.opt${oi}.empty`, 'error', `В вопросе ${n} есть пустой вариант ответа.`)
        return
      }
      if (len(t) > LIMITS.button)
        add(
          'quiz',
          `${base}.opt${oi}.long`,
          'warn',
          `Вариант «${clip(t, 24)}» длиннее ${LIMITS.button} символов — на кнопке он обрежется.`,
        )
      const k = low(t)
      if (seen.has(k)) dup = true
      seen.add(k)
    })
    if (dup) add('quiz', `${base}.options.dup`, 'warn', `В вопросе ${n} повторяются варианты ответа.`)
  })

  // Этаж 5: оффер
  if (!cfg.offerText.trim())
    add('offer', 'offer.text.empty', 'error', 'Оффер пустой — человек дошёл до конца и не узнал, что дальше.')
  out.push(...longMessage('offer', 'offer.text', offerMessage(cfg), 'Оффер'))
  out.push(...ethicsIssues('offer', 'offer.text', cfg.offerText))
  if (!Number.isFinite(cfg.offerPrice) || cfg.offerPrice < 0)
    add('offer', 'offer.price.invalid', 'error', 'Цена должна быть числом от 0. Ноль — значит бесплатно.')

  // Этаж 6: запись
  const bt = cfg.bookingText.trim()
  if (!bt) add('booking', 'booking.text.empty', 'error', 'У кнопки записи нет текста.')
  else if (len(bt) > LIMITS.button)
    add(
      'booking',
      'booking.text.long',
      'warn',
      `Текст кнопки длиннее ${LIMITS.button} символов — на телефоне он обрежется.`,
    )
  out.push(...ethicsIssues('booking', 'booking.text', cfg.bookingText))
  out.push(...urlIssues('booking', 'booking.url', cfg.bookingUrl, 'booking'))

  // Этаж 7: напоминание
  if (!cfg.followUp.trim())
    add(
      'followup',
      'followup.text.empty',
      'warn',
      'Напоминания нет — часть людей, нажавших «Пока подумаю», просто забудет.',
    )
  out.push(...longMessage('followup', 'followup.text', cfg.followUp, 'Напоминание'))
  out.push(...ethicsIssues('followup', 'followup.text', cfg.followUp))

  // Этаж 8: кризис
  const ct = cfg.crisisText.trim()
  if (!ct)
    add(
      'crisis',
      'crisis.text.empty',
      'error',
      'Кризисный текст пустой — человеку в беде бот не ответит. Верни стандартный текст.',
    )
  else {
    if (!/\d/.test(ct))
      add('crisis', 'crisis.text.phone', 'warn', 'В кризисном ответе нет ни одного телефона. Добавь 112 или телефон доверия.')
    if (SALES.test(low(ct)))
      add('crisis', 'crisis.text.sales', 'error', 'В кризисном ответе есть продажа. Здесь только поддержка и телефоны помощи.')
    out.push(...longMessage('crisis', 'crisis.text', ct, 'Кризисный ответ'))
  }

  return out
}

export function issuesByStep(issues: BotIssue[]): Record<BotStep, BotIssue[]> {
  const map = Object.fromEntries(BOT_STEPS.map((s) => [s.id, [] as BotIssue[]])) as Record<BotStep, BotIssue[]>
  for (const i of issues) map[i.step].push(i)
  return map
}

// ---------- Экспорт сценария текстом ----------

export function botScriptText(input: BotConfig): string {
  const cfg = normalizeConfig(input)
  const L: string[] = []
  const blank = () => L.push('')
  const orEmpty = (text: string, step: BotStep) =>
    text.trim() ? text.trim() : `(пусто — заполни этаж «${STEP_TITLE[step]}»)`
  const link = (raw: string, step: BotStep) => {
    const res = checkUrl(raw)
    return res.ok && res.url ? res.url : `(нет рабочей ссылки — проверь этаж «${STEP_TITLE[step]}»)`
  }
  const bookBtn = `[${cfg.bookingText.trim() || 'Записаться'}] — ссылка ${link(cfg.bookingUrl, 'booking')}`
  const magnetBtn = `[${FLOW_TEXT.magnetOpen}] — ссылка ${link(cfg.leadMagnetUrl, 'magnet')}`
  const hasQuiz = cfg.quiz.length > 0

  L.push(`Сценарий бота «${cfg.botName.trim() || 'Бот без имени'}»`)
  L.push(
    'Для переноса в BotHelp, SaleBot, Leadteh или другой конструктор. Каждый шаг — отдельное сообщение, кнопки идут под ним.',
  )
  blank()

  L.push('Шаг 1. Приветствие')
  L.push('Когда: человек нажал «Запустить» (команда /start).')
  L.push('Сообщение:')
  L.push(orEmpty(cfg.welcome, 'welcome'))
  blank()

  L.push('Шаг 2. Согласие на обработку персональных данных')
  if (cfg.consent) {
    L.push('Когда: сразу после приветствия. До согласия бот ничего не сохраняет.')
    L.push('Сообщение:')
    L.push(orEmpty(cfg.consentText, 'consent'))
    L.push('Кнопки:')
    L.push(`[${FLOW_TEXT.consentYes}] — перейти к шагу 3`)
    L.push(`[${FLOW_TEXT.consentNo}] — выдать материал без вопросов, один раз показать запись (шаг 3а)`)
  } else {
    L.push('Согласие выключено. Включи его перед запуском: без согласия квиз не имеет права сохранять ответы (152-ФЗ).')
  }
  blank()

  L.push('Шаг 3. Лид-магнит')
  L.push('Сообщение:')
  L.push(magnetMessage(cfg, true))
  L.push('Кнопки:')
  L.push(magnetBtn)
  L.push(hasQuiz ? `[${FLOW_TEXT.quizStart}] — перейти к шагу 4` : `[${FLOW_TEXT.skipQuiz}] — перейти к шагу 5`)
  blank()

  if (cfg.consent) {
    L.push('Шаг 3а. Если согласия нет')
    L.push('Сообщение:')
    L.push(magnetMessage(cfg, false, true))
    L.push('Кнопки:')
    L.push(magnetBtn)
    L.push('Следом сообщение:')
    L.push(FLOW_TEXT.declinedOffer)
    L.push('Кнопки:')
    L.push(bookBtn)
    L.push('Дальше бот ничего не присылает и ничего не сохраняет.')
    blank()
  }

  L.push('Шаг 4. Квиз')
  if (!hasQuiz) L.push('(вопросов нет — заполни этаж «Квиз»)')
  cfg.quiz.forEach((q, i) => {
    L.push(`Вопрос ${i + 1} из ${cfg.quiz.length}: ${orEmpty(q.text, 'quiz')}`)
    L.push(`Кнопки: ${q.options.map((o) => `[${o.trim() || '…'}]`).join(' ') || '(нет вариантов)'}`)
    L.push(
      i + 1 < cfg.quiz.length
        ? `Любой ответ — сохранить в поле «Вопрос ${i + 1}» и задать вопрос ${i + 2}.`
        : `Любой ответ — сохранить в поле «Вопрос ${i + 1}» и перейти к шагу 5.`,
    )
  })
  blank()

  L.push('Шаг 5. Оффер')
  L.push('Сообщение:')
  L.push(cfg.offerText.trim() ? offerMessage(cfg) : `${orEmpty('', 'offer')}\n\n${priceLine(cfg.offerPrice)}`)
  L.push('Кнопки:')
  L.push(bookBtn)
  L.push(`[${FLOW_TEXT.later}] — перейти к шагу 6`)
  L.push('Нажатие на запись — уведомить психолога: человек перешёл к записи.')
  blank()

  L.push('Шаг 6. Напоминание через сутки')
  if (cfg.followUp.trim()) {
    L.push('Когда: человек нажал «Пока подумаю». Отправить один раз.')
    L.push('Сразу ответить:')
    L.push(FLOW_TEXT.laterReplyFollow)
    L.push('Через 24 часа:')
    L.push(cfg.followUp.trim())
    L.push('Кнопки:')
    L.push(bookBtn)
  } else {
    L.push('Напоминание не задано. Сразу ответить:')
    L.push(FLOW_TEXT.laterReply)
  }
  blank()

  L.push('Любой шаг. Кризисные сообщения')
  L.push(`Когда: человек пишет о суициде или самоповреждении — ${CRISIS_MARKERS.map((m) => `«${m}»`).join(', ')} и другие формы этих слов.`)
  L.push(
    'Что сделать: сразу ответить текстом ниже, остановить воронку (никаких кнопок, офферов и напоминаний) и переслать сообщение психологу.',
  )
  L.push('Сообщение:')
  L.push(orEmpty(cfg.crisisText, 'crisis'))
  blank()

  L.push('Любой шаг. Непонятный текст')
  L.push('Сообщение:')
  L.push(FLOW_TEXT.fallback)
  blank()

  L.push('Правила этики')
  L.push('— Бот не лечит и не ставит диагнозы: он знакомит и помогает понять запрос.')
  L.push('— Материал выдаётся до просьбы о записи и не требует телефона или почты.')
  L.push('— Согласие на обработку данных — до первого вопроса.')
  L.push('— Одно напоминание. Никаких «осталось 2 места», таймеров и дожимов.')

  return L.join('\n')
}

/** Конфиг для выгрузки: без данных деплоя (код админа — ключ к заявкам). */
export function exportableConfig(cfg: BotConfig): BotConfig {
  const out = normalizeConfig(cfg)
  delete out.deployed
  return out
}
