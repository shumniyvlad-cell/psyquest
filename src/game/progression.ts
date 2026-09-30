import type { ChapterId, ClassId, LanternId, StatId, Stats } from './types'

export interface ClassDef {
  id: ClassId
  name: string
  method: string
  desc: string
  bonus: string
  bonusChapter: ChapterId
  stats: Stats
}

export const CLASSES: Record<ClassId, ClassDef> = {
  analyst: {
    id: 'analyst',
    name: 'Аналитик глубин',
    method: 'психоанализ, психодинамическая терапия',
    desc: 'Видит то, что прячется под поверхностью, и умеет выдерживать долгую работу.',
    bonus: '+25% опыта в Лесу Смыслов',
    bonusChapter: 'forest',
    stats: { confidence: 3, expertise: 5, charisma: 2, resilience: 4 },
  },
  gestalt: {
    id: 'gestalt',
    name: 'Мастер контакта',
    method: 'гештальт, экзистенциальный подход',
    desc: 'Чувствует момент «здесь и сейчас». В живом разговоре ему нет равных.',
    bonus: '+25% опыта на Арене Продаж',
    bonusChapter: 'arena',
    stats: { confidence: 4, expertise: 3, charisma: 5, resilience: 2 },
  },
  cbt: {
    id: 'cbt',
    name: 'Архитектор мыслей',
    method: 'КПТ, схема-терапия, ACT',
    desc: 'Любит структуру, протоколы и измеримый результат. Строит продукт как систему.',
    bonus: '+25% опыта в Кузнице Продукта',
    bonusChapter: 'forge',
    stats: { confidence: 3, expertise: 4, charisma: 3, resilience: 4 },
  },
  coach: {
    id: 'coach',
    name: 'Навигатор целей',
    method: 'коучинг, краткосрочная терапия, ОРКТ',
    desc: 'Видит цель и двигается к ней быстро. Запуски — родная стихия.',
    bonus: '+25% опыта на Площади Запуска',
    bonusChapter: 'launch',
    stats: { confidence: 5, expertise: 2, charisma: 4, resilience: 3 },
  },
  creative: {
    id: 'creative',
    name: 'Алхимик образов',
    method: 'арт-терапия, телесная, сказкотерапия',
    desc: 'Говорит образами и метафорами. Контент рождается сам собой.',
    bonus: '+25% опыта в Студии Эха',
    bonusChapter: 'studio',
    stats: { confidence: 3, expertise: 3, charisma: 5, resilience: 3 },
  },
}

export const STAT_INFO: Record<StatId, { name: string; desc: string }> = {
  confidence: { name: 'Уверенность', desc: 'Запас сил в спорах с тенями. Больше уверенности — дольше держишься в бою.' },
  expertise: { name: 'Экспертиза', desc: 'Сила аргументов. Сильные ответы бьют больнее.' },
  charisma: { name: 'Харизма', desc: 'Как далеко слышен твой голос. Влияет на заявки в запуске.' },
  resilience: { name: 'Стойкость', desc: 'Энергия и защита от выгорания в запуске и в финале.' },
}

export const LANTERNS: Record<LanternId, { name: string; color: string; soft: string; price: number; free: boolean }> = {
  amber: { name: 'Янтарь', color: '#ffb547', soft: 'rgba(255, 181, 71, 0.35)', price: 0, free: true },
  mint: { name: 'Аврора', color: '#6fe3c8', soft: 'rgba(111, 227, 200, 0.32)', price: 0, free: true },
  rose: { name: 'Роза', color: '#ff8fb1', soft: 'rgba(255, 143, 177, 0.32)', price: 0, free: true },
  lilac: { name: 'Сирень', color: '#b9a4ff', soft: 'rgba(185, 164, 255, 0.32)', price: 0, free: true },
  emerald: { name: 'Изумруд', color: '#5ee37a', soft: 'rgba(94, 227, 122, 0.3)', price: 180, free: false },
  crimson: { name: 'Гранат', color: '#ff6b6b', soft: 'rgba(255, 107, 107, 0.32)', price: 180, free: false },
  aurora: { name: 'Северное сияние', color: '#9ff0ff', soft: 'rgba(159, 240, 255, 0.34)', price: 320, free: false },
}

/** Опыт, нужный для перехода с уровня level на level + 1 */
export function xpForLevel(level: number) {
  return Math.round(90 * Math.pow(level, 1.35) + 40)
}

const TITLES: [number, string][] = [
  [1, 'Искра в тумане'],
  [2, 'Ученик Фонарщика'],
  [4, 'Фонарщик'],
  [6, 'Проводник'],
  [8, 'Мастер Света'],
  [10, 'Хранитель Пути'],
  [12, 'Смотритель Маяка'],
  [15, 'Легенда Психеи'],
]

export function titleForLevel(level: number) {
  let t = TITLES[0][1]
  for (const [lvl, name] of TITLES) if (level >= lvl) t = name
  return t
}

export const SKILL_POINTS_PER_LEVEL = 2

/** Итоговые характеристики: база класса + вложенные очки + реликвии */
export function effectiveStats(classId: ClassId, allocated: Stats, relics: string[]): Stats {
  const base = CLASSES[classId].stats
  const s: Stats = {
    confidence: base.confidence + allocated.confidence,
    expertise: base.expertise + allocated.expertise,
    charisma: base.charisma + allocated.charisma,
    resilience: base.resilience + allocated.resilience,
  }
  if (relics.includes('crystal_echo')) s.charisma += 2
  if (relics.includes('horn')) s.charisma += 1
  if (relics.includes('lantern_oil')) s.resilience += 2
  return s
}

export function maxHp(stats: Stats, relics: string[]) {
  return 60 + stats.confidence * 8 + (relics.includes('shield_facts') ? 15 : 0)
}

export function damageMult(stats: Stats) {
  return 1 + stats.expertise * 0.06
}
