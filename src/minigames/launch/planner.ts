// Логика планировщика запуска: даты, раскладка этапов прогрева по дням, форматы под канал.
import type { Channel, LaunchDay } from '../../game/types'
import { STAGE_EXTRA, WARMUP_STAGES, type StageFamily } from './stages.ts'

export const PLAN_LENGTHS = [7, 10, 14] as const
export type PlanLength = (typeof PLAN_LENGTHS)[number]

export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: 'Instagram',
  threads: 'Threads',
  telegram: 'Telegram',
  vk: 'ВКонтакте',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  offline: 'Офлайн',
}

/** Два базовых формата канала: [публичный, личный] */
export const CHANNEL_FORMATS: Record<Channel, readonly [string, string]> = {
  instagram: ['Рилс', 'Сторис'],
  threads: ['Тред', 'Пост'],
  tiktok: ['Рилс', 'Сторис'],
  telegram: ['Пост', 'Голосовое'],
  vk: ['Пост', 'Клип'],
  youtube: ['Shorts', 'Видео'],
  offline: ['Встреча', 'Личные сообщения'],
}

export const FORMAT_TIP: Record<string, string> = {
  Рилс: 'До минуты, крючок в первые три секунды, в конце — один понятный шаг.',
  Сторис: 'Четыре-шесть кадров, живое видео и стикер-вопрос или опрос.',
  Пост: 'Один тезис, личный пример и вопрос к читателю.',
  Тред: 'Цепочка из трёх-семи коротких постов: крючок в первом, по одной мысли в каждом, в конце — вопрос.',
  Голосовое: 'До трёх минут, как разговор с одним человеком.',
  Клип: 'Вертикальное видео до минуты, субтитры обязательны.',
  Shorts: 'До минуты, мысль — с первого кадра.',
  Видео: 'Восемь-пятнадцать минут, план в описании и таймкоды.',
  Встреча: 'Малая группа, понятная тема и время, запись по ссылке.',
  'Личные сообщения': 'Короткий личный текст тем, кто уже знает тебя. Без рассылки по шаблону.',
}

/** Какой из двух форматов канала больше подходит этапу: 0 — публичный, 1 — личный */
const FORMAT_PREF: Record<string, 0 | 1> = {
  intro: 0,
  problem: 0,
  myths: 1,
  cases: 0,
  method: 1,
  value: 0,
  offer: 0,
  faq: 1,
}

/** Каким этапам достаются дополнительные дни в длинных планах — по очереди */
const EXTRA_PRIORITY = ['faq', 'cases', 'value', 'problem', 'offer', 'myths', 'intro', 'method']

/** Пары соседних этапов, которые можно объединить в один день в коротком плане */
const MERGES: { a: string; b: string; title: string; content: string }[] = [
  {
    a: 'method',
    b: 'value',
    title: 'Метод и полезность',
    content:
      'Как проходит работа — на практике: короткое упражнение из метода, рассказ о первой встрече и ссылка на гайд для тех, кто хочет попробовать глубже.',
  },
  {
    a: 'myths',
    b: 'cases',
    title: 'Мифы и кейсы',
    content:
      'Миф «терапия — это на годы» и история, которая его опровергает: обезличенный кейс с понятными сроками, с согласия клиента.',
  },
  {
    a: 'intro',
    b: 'problem',
    title: 'Знакомство и проблема',
    content:
      'Кто я и с какими запросами работаю: короткая личная история и три трудности, с которыми ко мне приходят чаще всего.',
  },
]

export interface PlanSlot {
  /** Ключ для хранения правок: этап (или пара этапов) + номер повтора */
  key: string
  stageIds: string[]
  title: string
  family: StageFamily
  occurrence: number
  idea: string
}

export const snapLength = (days: number | undefined): PlanLength => {
  if (!days || !Number.isFinite(days)) return 10
  let best: PlanLength = PLAN_LENGTHS[0]
  for (const len of PLAN_LENGTHS) if (Math.abs(len - days) < Math.abs(best - days)) best = len
  return best
}

/** Раскладывает восемь этапов по дням: в коротком плане объединяет соседей, в длинном — даёт важным этапам второй день. */
export function distributeStages(days: number): PlanSlot[] {
  const n = Math.max(5, Math.min(21, Math.round(days)))
  const counts: Record<string, number> = {}
  for (const s of WARMUP_STAGES) counts[s.id] = 1
  for (let extra = 0, i = 0; extra < n - WARMUP_STAGES.length; extra++, i++) {
    counts[EXTRA_PRIORITY[i % EXTRA_PRIORITY.length]] += 1
  }
  const merges = MERGES.slice(0, Math.max(0, WARMUP_STAGES.length - n))
  const mergedFirst = new Map(merges.map((m) => [m.a, m]))
  const mergedSecond = new Set(merges.map((m) => m.b))

  const slots: PlanSlot[] = []
  for (const stage of WARMUP_STAGES) {
    if (mergedSecond.has(stage.id)) continue
    const extra = STAGE_EXTRA[stage.id]
    const merge = mergedFirst.get(stage.id)
    if (merge) {
      slots.push({
        key: `${merge.a}+${merge.b}#1`,
        stageIds: [merge.a, merge.b],
        title: merge.title,
        family: extra.family,
        occurrence: 1,
        idea: merge.content,
      })
      continue
    }
    for (let k = 1; k <= counts[stage.id]; k++) {
      const ideas = [stage.content, ...extra.ideas]
      slots.push({
        key: `${stage.id}#${k}`,
        stageIds: [stage.id],
        title: stage.title,
        family: extra.family,
        occurrence: k,
        idea: ideas[Math.min(k - 1, ideas.length - 1)],
      })
    }
  }
  return slots
}

export function formatFor(channel: Channel, slot: Pick<PlanSlot, 'stageIds' | 'occurrence'>): string {
  const pair = CHANNEL_FORMATS[channel] ?? CHANNEL_FORMATS.telegram
  const pref = FORMAT_PREF[slot.stageIds[0]] ?? 0
  const idx = (pref + slot.occurrence - 1) % 2
  return pair[idx]
}

export const defaultContent = (channel: Channel, slot: PlanSlot) => `${formatFor(channel, slot)}: ${slot.idea}`

// ---------- Даты (локальное время, формат YYYY-MM-DD) ----------

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function parseISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null
  return d
}

export const isValidISO = (iso: string) => parseISO(iso) !== null

export function addDaysISO(iso: string, n: number): string {
  const d = parseISO(iso) ?? new Date()
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))
}

export const todayISO = (now = new Date()) => toISO(now)
export const tomorrowISO = (now = new Date()) => addDaysISO(toISO(now), 1)

export interface PlanRow extends LaunchDay {
  key: string
  family: StageFamily
  format: string
  defaultText: string
}

/** Собирает дни плана; edits — правки игрока по ключу слота, они переживают смену даты и длительности. */
export function buildPlan(
  startDate: string,
  days: number,
  channel: Channel,
  edits: Record<string, string> = {},
): PlanRow[] {
  const start = isValidISO(startDate) ? startDate : tomorrowISO()
  return distributeStages(days).map((slot, i) => {
    const text = defaultContent(channel, slot)
    return {
      key: slot.key,
      day: i + 1,
      date: addDaysISO(start, i),
      stage: slot.title,
      content: edits[slot.key] ?? text,
      family: slot.family,
      format: formatFor(channel, slot),
      defaultText: text,
    }
  })
}

export const toLaunchDays = (rows: PlanRow[]): LaunchDay[] =>
  rows.map(({ day, date, stage, content }) => ({ day, date, stage, content: content.trim() }))
