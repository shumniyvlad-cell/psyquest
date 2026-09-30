// Тест-драйв: три виртуальных клиента проходят воронку. Каждая ошибка валидации
// роняет клиента на своём этаже, каждое замечание снижает оценку.

import type { BotConfig } from '../../game/types'
import { formatClock, runFlow, type ChatAction, type ChatMessage } from './flow'
import { STEP_TITLE, issueQuestionId, validateBot, type BotIssue, type BotStep } from './model'

export type PersonaId = 'anna' | 'igor' | 'mila'

export interface Persona {
  id: PersonaId
  name: string
  age: number
  g: 'f' | 'm'
  about: string
  /** Во сколько пишет, минуты от полуночи */
  startAt: number
  goal: 'booking' | 'crisis'
  script: (cfg: BotConfig) => ChatAction[]
}

const v = (p: Persona, f: string, m: string) => (p.g === 'f' ? f : m)

const quizStart = (cfg: BotConfig) => (cfg.quiz.length ? 'quiz_start' : 'skip_quiz')

export const MILA_TEXT = 'Извините, что ночью. Иногда кажется, что нет смысла жить…'

export const PERSONAS: readonly Persona[] = [
  {
    id: 'anna',
    name: 'Анна',
    age: 34,
    g: 'f',
    about: 'тревога перед выступлениями, отвечает на всё',
    startAt: 23 * 60 + 40,
    goal: 'booking',
    script: (cfg) => {
      let t = 23 * 60 + 40
      const a: ChatAction[] = [{ t: 'start', at: t }]
      if (cfg.consent) a.push({ t: 'press', id: 'consent_yes', at: ++t })
      a.push({ t: 'press', id: quizStart(cfg), at: ++t })
      for (const q of cfg.quiz) a.push({ t: 'press', id: `q:${q.id}:0`, at: ++t })
      a.push({ t: 'press', id: 'book', at: t + 2 })
      return a
    },
  },
  {
    id: 'igor',
    name: 'Игорь',
    age: 41,
    g: 'm',
    about: 'скептик, хочет сразу цену',
    startAt: 12 * 60 + 15,
    goal: 'booking',
    script: (cfg) => {
      let t = 12 * 60 + 15
      const a: ChatAction[] = [
        { t: 'start', at: t },
        { t: 'text', text: 'Сколько стоит?', at: ++t },
      ]
      if (cfg.consent) a.push({ t: 'press', id: 'consent_yes', at: ++t })
      a.push({ t: 'press', id: quizStart(cfg), at: ++t })
      for (const q of cfg.quiz) a.push({ t: 'press', id: `q:${q.id}:${Math.max(0, q.options.length - 1)}`, at: t })
      a.push({ t: 'press', id: 'later', at: ++t })
      a.push({ t: 'press', id: 'book', at: t + 4 })
      return a
    },
  },
  {
    id: 'mila',
    name: 'Мила',
    age: 27,
    g: 'f',
    about: 'пишет в 3 часа ночи, может прислать тревожное сообщение',
    startAt: 3 * 60 + 7,
    goal: 'crisis',
    script: (cfg) => {
      let t = 3 * 60 + 7
      const a: ChatAction[] = [{ t: 'start', at: t }]
      if (cfg.consent) a.push({ t: 'press', id: 'consent_yes', at: ++t })
      a.push({ t: 'press', id: quizStart(cfg), at: ++t })
      const q = cfg.quiz[0]
      if (q) a.push({ t: 'press', id: `q:${q.id}:${Math.floor(Math.max(0, q.options.length - 1) / 2)}`, at: ++t })
      a.push({ t: 'text', text: MILA_TEXT, at: t + 3 })
      return a
    },
  },
]

export interface PersonaRun {
  persona: Persona
  /** Переписка до точки выхода, с финальной заметкой */
  messages: ChatMessage[]
  passed: boolean
  dropStep?: BotStep
  dropIssue?: BotIssue
  warns: BotIssue[]
  score: number
  status: string
  detail: string
  taunt?: string
}

export interface SimResult {
  runs: PersonaRun[]
  issues: BotIssue[]
  passed: number
  score: number
}

export const GOLEM_IDLE = 'Бип. Я Голем Молчания. Там, где бот молчит, я становлюсь сильнее.'
export const GOLEM_HURT = 'Бип… Кто-то дошёл до цели. В камне появилась трещина.'

export function golemTaunt(issue: BotIssue, p: Persona): string {
  if (issue.step === 'crisis') {
    return issue.id === 'crisis.text.sales'
      ? 'Даже мне не до шуток. Человеку плохо, а бот заговорил о записи. Здесь нужна помощь, а не продажа.'
      : 'Даже мне сейчас не до шуток. Человеку ночью плохо, а бот не помог. Верни кризисный текст — это важнее любой воронки.'
  }
  if (issue.id.endsWith('.pressure')) return 'Бип. «Осталось два места» — и человек ушёл навсегда. Дожим — мой лучший союзник.'
  switch (issue.step) {
    case 'welcome':
      return issue.id === 'welcome.name.empty'
        ? 'Бип. Бот без имени пишет незнакомцу. Выглядит как спам, звучит как спам. Прекрасно.'
        : `Бип. Человек написал в ${formatClock(p.startAt)}. Ему ответила тишина. Я доволен.`
    case 'consent':
      return 'Бип. Бот собирает ответы, не спросив разрешения. Закон грустит, я — нет.'
    case 'magnet':
      return 'Бип. Обещали материал, выдали пустоту. Доверие — ноль. Мой любимый счёт.'
    case 'quiz':
      return 'Бип. Вопрос есть, а ответить нечем. Человек смотрит в экран, экран смотрит в человека.'
    case 'offer':
      return 'Бип. Человек дошёл до конца и не узнал, что дальше. Интрига сохранена. Клиент — нет.'
    case 'booking':
      return 'Бип. Кнопка записи ведёт в никуда. Отличное место для встречи — там всегда тихо.'
    case 'followup':
      return 'Бип. «Подумаю» — и тишина. Молчание — золото. Моё золото.'
  }
}

function dropNarrative(p: Persona, issue: BotIssue): string {
  const left = v(p, 'ушла', 'ушёл')
  if (issue.id.endsWith('.pressure')) return `${p.name} ${v(p, 'почувствовала', 'почувствовал')} давление и ${left}.`
  if (issue.id === 'consent.off') return `Бот начал расспрашивать, не спросив согласия. ${p.name} не ${v(p, 'стала', 'стал')} отвечать.`
  if (issue.id === 'welcome.name.empty') return `Бот без имени похож на спам. ${p.name} ${v(p, 'закрыла', 'закрыл')} чат.`
  if (issue.id === 'crisis.text.sales')
    return `В ответ на боль бот заговорил о записи. ${p.name} ${v(p, 'осталась', 'остался')} без поддержки.`
  if (issue.id === 'offer.price.invalid') return `${p.name} не ${v(p, 'поняла', 'понял')}, сколько стоит встреча, и ${left}.`
  switch (issue.step) {
    case 'welcome':
      return `${p.name} ${v(p, 'подождала', 'подождал')} ответа и ${v(p, 'закрыла', 'закрыл')} чат.`
    case 'consent':
      return `${p.name} не ${v(p, 'поняла', 'понял')}, на что даёт согласие, и ${left}.`
    case 'magnet':
      return `${p.name} так и не ${v(p, 'получила', 'получил')} обещанный материал и ${left}.`
    case 'quiz':
      return `${p.name} не ${v(p, 'смогла', 'смог')} ответить на вопрос и ${v(p, 'закрыла', 'закрыл')} чат.`
    case 'offer':
      return `${p.name} не ${v(p, 'поняла', 'понял')}, что ${v(p, 'ей', 'ему')} предлагают, и ${left}.`
    case 'booking':
      return `${p.name} ${v(p, 'хотела', 'хотел')} записаться, но кнопка никуда не ведёт.`
    case 'followup':
      return `${p.name} ${v(p, 'получила', 'получил')} странное напоминание и ${v(p, 'отписалась', 'отписался')}.`
    case 'crisis':
      return `${p.name} ${v(p, 'осталась', 'остался')} без ответа в трудную минуту.`
  }
}

function note(key: string, text: string, tone: ChatMessage['tone'], step: BotStep, time: string): ChatMessage {
  return { key, from: 'system', text, tone, step, time }
}

function simulatePersona(cfg: BotConfig, p: Persona, issues: BotIssue[]): PersonaRun {
  const flow = runFlow(cfg, p.script(cfg))
  const all = flow.messages

  const stepErr = new Map<BotStep, BotIssue>()
  const qErr = new Map<string, BotIssue>()
  for (const e of issues) {
    if (e.severity !== 'error') continue
    const qid = issueQuestionId(e)
    if (qid) {
      if (!qErr.has(qid)) qErr.set(qid, e)
    } else if (!stepErr.has(e.step)) stepErr.set(e.step, e)
  }

  let cut = all.length
  let drop: BotIssue | undefined
  for (let i = 0; i < all.length; i++) {
    const m = all[i]
    const se = stepErr.get(m.step)
    if (se) {
      let j = i
      while (j + 1 < all.length && all[j + 1].step === m.step && all[j + 1].from !== 'user') j++
      cut = j + 1
      drop = se
      break
    }
    if (m.ref && m.from === 'bot') {
      const qe = qErr.get(m.ref)
      if (qe) {
        cut = i + 1
        drop = qe
        break
      }
    }
  }

  const seen = all.slice(0, cut)
  const lastTime = seen.length ? seen[seen.length - 1].time : formatClock(p.startAt)

  const reached = p.goal === 'booking' ? flow.booked : flow.crisisAnswered
  if (!drop && !reached) {
    const last = seen.length ? seen[seen.length - 1].step : 'welcome'
    drop = { id: 'flow.stuck', step: last, severity: 'error', text: 'Воронка оборвалась — проверь этажи по порядку.' }
  }

  const seenSteps = new Set(seen.map((m) => m.step))
  const seenQuestions = new Set(seen.flatMap((m) => (m.ref ? [m.ref] : [])))
  const warns = issues.filter((i) => {
    if (i.severity !== 'warn') return false
    const qid = issueQuestionId(i)
    return qid ? seenQuestions.has(qid) : seenSteps.has(i.step)
  })

  if (drop) {
    return {
      persona: p,
      messages: [...seen, note(`${p.id}-drop`, dropNarrative(p, drop), 'warn', drop.step, lastTime)],
      passed: false,
      dropStep: drop.step,
      dropIssue: drop,
      warns,
      score: 0,
      status: `${v(p, 'Потерялась', 'Потерялся')} на этаже «${STEP_TITLE[drop.step]}»`,
      detail: drop.text,
      taunt: golemTaunt(drop, p),
    }
  }

  const followed = p.id === 'igor' && cfg.followUp.trim().length > 0
  const finale =
    p.goal === 'crisis'
      ? `${p.name} ${v(p, 'получила', 'получил')} телефоны помощи, а бот не стал ничего продавать.`
      : `${p.name} ${v(p, 'перешла', 'перешёл')} к записи${followed ? ' после напоминания' : ''}.`
  return {
    persona: p,
    messages: [...seen, note(`${p.id}-done`, finale, 'ok', seen.length ? seen[seen.length - 1].step : 'booking', lastTime)],
    passed: true,
    warns,
    score: Math.max(40, 100 - 8 * warns.length),
    status:
      p.goal === 'crisis'
        ? `${v(p, 'Получила', 'Получил')} кризисный ответ`
        : `${v(p, 'Дошла', 'Дошёл')} до записи${followed ? ' после напоминания' : ''}`,
    detail: warns.length ? `Замечаний по пути: ${warns.length}` : 'Без замечаний',
  }
}

export function simulate(cfg: BotConfig): SimResult {
  const issues = validateBot(cfg)
  const runs = PERSONAS.map((p) => simulatePersona(cfg, p, issues))
  const passed = runs.filter((r) => r.passed).length
  const score = Math.round(runs.reduce((s, r) => s + r.score, 0) / runs.length)
  return { runs, issues, passed, score }
}
