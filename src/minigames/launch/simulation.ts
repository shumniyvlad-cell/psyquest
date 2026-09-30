// «Буря Хаоса» — чистая логика мини-рогалика запуска. Без React: всё детерминировано зерном.
import { EVENTS, EVENT_BY_ID, type EventCtx, type EventEffect, type StormEvent } from './events.ts'
import { clamp, mulberry32, plural, roundChance, type Rng } from './rng.ts'

export type ActionId = 'case' | 'stories' | 'live' | 'dm' | 'collab' | 'rest'

export interface ActionDef {
  id: ActionId
  title: string
  blurb: string
  /** Расход энергии */
  cost: number
  /** Восстановление энергии (только отдых) */
  restore: number
  /** Базовый прирост интереса */
  interest: number
  /** Базовые заявки при среднем интересе и средней конверсии */
  apps: number
  /** Насколько заявки зависят от интереса аудитории: 0 — не зависят, 1 — полностью */
  idep: number
  /** Множитель за каждый день повтора подряд */
  repeat: number
  /** Публичный контент — держит ритм */
  content: boolean
}

export const ACTIONS: ActionDef[] = [
  {
    id: 'case',
    title: 'Пост-кейс',
    blurb: 'История изменений клиента — обезличенно и с согласия.',
    cost: 12,
    restore: 0,
    interest: 7,
    apps: 0.7,
    idep: 0.7,
    repeat: 0.65,
    content: true,
  },
  {
    id: 'stories',
    title: 'Сторис-прогрев',
    blurb: 'Живые кадры дня, опросы, ответы на вопросы.',
    cost: 6,
    restore: 0,
    interest: 9,
    apps: 0.24,
    idep: 0.5,
    repeat: 0.85,
    content: true,
  },
  {
    id: 'live',
    title: 'Прямой эфир',
    blurb: 'Час живого разговора: ближе всего к консультации.',
    cost: 22,
    restore: 0,
    interest: 13,
    apps: 1.0,
    idep: 0.8,
    repeat: 0.6,
    content: true,
  },
  {
    id: 'dm',
    title: 'Личные сообщения тёплым контактам',
    blurb: 'Бережно написать тем, кто уже спрашивает о работе. Без дожима.',
    cost: 13,
    restore: 0,
    interest: 2,
    apps: 1.32,
    idep: 0.25,
    repeat: 0.45,
    content: false,
  },
  {
    id: 'collab',
    title: 'Совместный эфир с коллегой',
    blurb: 'Обмен аудиториями и тёплый разговор на двоих.',
    cost: 18,
    restore: 0,
    interest: 16,
    apps: 0.7,
    idep: 0.45,
    repeat: 0.35,
    content: true,
  },
  {
    id: 'rest',
    title: 'Отдых',
    blurb: 'Сон, прогулка, тишина. Можно взять дважды — полный выходной.',
    cost: 0,
    restore: 24,
    interest: 0,
    apps: 0,
    idep: 0,
    repeat: 1,
    content: false,
  },
]

export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a])) as Record<ActionId, ActionDef>

export const TUNING = {
  baseEnergy: 60,
  energyPerResilience: 4,
  overnight: 5,
  fullRestBonus: 8,
  rhythmStep: 0.08,
  rhythmCap: 4,
  /** Накопленная усталость: каждый день подряд без отдыха делает дела дороже */
  grindStep: 0.15,
  grindCap: 5,
  decayContent: 3,
  decayIdle: 8,
  decayShare: 0.06,
  trustStep: 0.07,
  lostDayEnergy: 0.3,
  lostDayInterest: 12,
  /** Как отдача дел растёт с целью: большая цель — большая аудитория, но не пропорционально */
  scaleExp: 0.8,
  /** Общий множитель отдачи — главный рычаг баланса */
  yield: 0.93,
}

export type EnergyTier = 'fresh' | 'steady' | 'tired' | 'empty'

export const ENERGY_TIERS: { tier: EnergyTier; from: number; mult: number; label: string }[] = [
  { tier: 'fresh', from: 0.7, mult: 1.25, label: 'Свежая голова' },
  { tier: 'steady', from: 0.35, mult: 1, label: 'Рабочий ритм' },
  { tier: 'tired', from: 0.15, mult: 0.6, label: 'Усталость' },
  { tier: 'empty', from: 0, mult: 0.3, label: 'На нуле' },
]

export const energyTier = (ratio: number) => ENERGY_TIERS.find((t) => ratio >= t.from) ?? ENERGY_TIERS[3]

export interface SimConfig {
  target: number
  days: number
  charisma: number
  resilience: number
  reputation: number
  planQuality: number
  bonusPerDay: number
  seed: number
}

export type SimPhase = 'plan' | 'event' | 'report' | 'lost' | 'final'

export interface Mods {
  interest: number
  dm: number
  apps: number
}

export interface ActionOutcome {
  id: ActionId
  energy: number
  interest: number
  /** Ожидаемые заявки (дробные) */
  expected: number
  /** Заявки по факту (после броска) */
  apps: number
  tier: EnergyTier
  /** Дело сделано на усталости */
  fatigue: boolean
  repeatMult: number
}

export interface DayRecord {
  day: number
  lost: boolean
  picks: ActionId[]
  cancelled: boolean
  eventId?: string
  option?: number
  result?: string
  wise?: boolean
  outcomes: ActionOutcome[]
  eventApps: number
  bonusApps: number
  apps: number
  energyStart: number
  energyEnd: number
  interestStart: number
  interestEnd: number
  trustDelta: number
  burnout: boolean
}

export interface SimState {
  cfg: SimConfig
  maxEnergy: number
  day: number
  phase: SimPhase
  energy: number
  interest: number
  trust: number
  applications: number
  rhythm: number
  /** Сколько дней подряд без единого отдыха */
  grind: number
  streak: Record<ActionId, number>
  mods: Mods
  burnoutNext: boolean
  usedEvents: string[]
  pending: { picks: ActionId[]; eventId: string } | null
  history: DayRecord[]
  log: string[]
  rng: number
}

const NO_MODS: Mods = { interest: 1, dm: 1, apps: 1 }
const zeroStreak = (): Record<ActionId, number> => ({ case: 0, stories: 0, live: 0, dm: 0, collab: 0, rest: 0 })

const fin = (v: number | undefined, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

export function createSim(input: Partial<SimConfig> & { target: number }): SimState {
  const cfg: SimConfig = {
    target: clamp(Math.round(fin(input.target, 10)), 1, 60),
    days: clamp(Math.round(fin(input.days, 7)), 3, 14),
    charisma: clamp(fin(input.charisma, 5), 1, 20),
    resilience: clamp(fin(input.resilience, 5), 1, 20),
    reputation: clamp(fin(input.reputation, 50), 0, 100),
    planQuality: clamp(fin(input.planQuality, 0.5), 0, 1),
    bonusPerDay: clamp(fin(input.bonusPerDay, 0), 0, 3),
    seed: fin(input.seed, 1) >>> 0,
  }
  const maxEnergy = Math.round(TUNING.baseEnergy + cfg.resilience * TUNING.energyPerResilience)
  const interest = Math.round(clamp(25 + cfg.planQuality * 15 + cfg.reputation * 0.1, 0, 100))
  return {
    cfg,
    maxEnergy,
    day: 1,
    phase: 'plan',
    energy: maxEnergy,
    interest,
    trust: 0,
    applications: 0,
    rhythm: 0,
    grind: 0,
    streak: zeroStreak(),
    mods: { ...NO_MODS },
    burnoutNext: false,
    usedEvents: [],
    pending: null,
    history: [],
    log: [],
    rng: mulberry32(cfg.seed ^ 0x9e3779b9).state,
  }
}

/** Отклик аудитории на предложения: харизма, репутация, качество плана и доверие */
export function conversion(s: Pick<SimState, 'cfg' | 'trust'>): number {
  const { charisma, reputation, planQuality } = s.cfg
  return (
    (0.55 + 0.045 * charisma) *
    (0.6 + 0.008 * reputation) *
    (0.62 + 0.55 * planQuality) *
    Math.max(0.5, 1 + TUNING.trustStep * s.trust)
  )
}

/** Множитель расхода энергии от накопленной усталости */
export const grindCost = (s: Pick<SimState, 'grind'>) => 1 + TUNING.grindStep * Math.min(s.grind, TUNING.grindCap)

/** Размер аудитории относительно базовой цели «10 заявок за 7 дней» */
export const audienceScale = (cfg: Pick<SimConfig, 'target' | 'days'>) =>
  ((Math.max(1, cfg.target) * 7) / Math.max(1, cfg.days) / 10) ** TUNING.scaleExp

/** Масштаб аудитории под нужный темп: 10 заявок за 7 дней — 1, 25 за 7 дней — около 1,9 */
export const targetScale = (cfg: Pick<SimConfig, 'target' | 'days'>) => TUNING.yield * audienceScale(cfg)

export function validPicks(picks: readonly ActionId[]): boolean {
  if (picks.length !== 2) return false
  if (!picks.every((p) => p in ACTION_BY_ID)) return false
  return picks[0] !== picks[1] || picks[0] === 'rest'
}

interface TodayCtx {
  mult: number
  liveMult: number
  extraCost: number
  restMult: number
  mods: Mods
}

const CALM_DAY: TodayCtx = { mult: 1, liveMult: 1, extraCost: 0, restMult: 1, mods: NO_MODS }

/** Ожидаемый результат одного дела при текущем состоянии — общий для подсказок и для расчёта дня. */
function expectAction(
  s: SimState,
  id: ActionId,
  energy: number,
  interest: number,
  ctx: TodayCtx,
  secondRest: boolean,
): ActionOutcome {
  const def = ACTION_BY_ID[id]
  if (id === 'rest') {
    const restore = (def.restore + (secondRest ? TUNING.fullRestBonus : 0)) * ctx.restMult
    return {
      id,
      energy: Math.min(restore, s.maxEnergy - energy),
      interest: 0,
      expected: 0,
      apps: 0,
      tier: energyTier(energy / s.maxEnergy).tier,
      fatigue: false,
      repeatMult: 1,
    }
  }
  const tier = energyTier(energy / s.maxEnergy)
  const live = id === 'live' || id === 'collab'
  const quality = tier.mult * ctx.mult * (live ? ctx.liveMult : 1)
  const repeatMult = Math.max(0.2, def.repeat ** s.streak[id])
  const rhythmMult = 1 + TUNING.rhythmStep * Math.min(s.rhythm, TUNING.rhythmCap)
  const interestGain = def.interest * quality * repeatMult * rhythmMult * ctx.mods.interest
  const interestMult = def.idep * (interest / 50) + (1 - def.idep)
  const dmMult = id === 'dm' ? ctx.mods.dm : 1
  const expected =
    def.apps * conversion(s) * targetScale(s.cfg) * interestMult * quality * repeatMult * dmMult * ctx.mods.apps
  return {
    id,
    energy: -Math.min(energy, def.cost * grindCost(s) + ctx.extraCost),
    interest: Math.min(interestGain, 100 - interest),
    expected,
    apps: 0,
    tier: tier.tier,
    fatigue: tier.tier === 'tired' || tier.tier === 'empty',
    repeatMult,
  }
}

export interface DayPreview {
  outcomes: ActionOutcome[]
  energyAfter: number
  interestAfter: number
  expectedApps: number
  /** Энергия к вечеру закончится — завтра выгорание */
  burnout: boolean
}

/** Прогноз без случайностей и событий — для подсказок на карточках. */
export function previewDay(s: SimState, picks: readonly ActionId[]): DayPreview {
  let energy = s.energy
  let interest = s.interest
  const outcomes: ActionOutcome[] = []
  picks.forEach((id, i) => {
    const o = expectAction(s, id, energy, interest, CALM_DAY, id === 'rest' && i === 1 && picks[0] === 'rest')
    energy = clamp(energy + o.energy, 0, s.maxEnergy)
    interest = clamp(interest + o.interest, 0, 100)
    outcomes.push(o)
  })
  return {
    outcomes,
    energyAfter: energy,
    interestAfter: interest,
    expectedApps: outcomes.reduce((a, o) => a + o.expected, 0) + s.cfg.bonusPerDay,
    burnout: picks.length === 2 && energy <= 0,
  }
}

function eventCtx(s: SimState, picks: readonly ActionId[]): EventCtx {
  return {
    day: s.day,
    days: s.cfg.days,
    energyRatio: s.energy / s.maxEnergy,
    interest: s.interest,
    picks,
    applications: s.applications,
    target: s.cfg.target,
  }
}

function drawEvent(s: SimState, picks: readonly ActionId[], rng: Rng): StormEvent {
  const ctx = eventCtx(s, picks)
  let pool = EVENTS.filter((e) => !s.usedEvents.includes(e.id))
  if (!pool.length) pool = EVENTS
  const weights = pool.map((e) => Math.max(0, e.weight(ctx)))
  let total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) {
    weights.fill(1)
    total = weights.length
  }
  let roll = rng.next() * total
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]
    if (roll < 0) return pool[i]
  }
  return pool[pool.length - 1]
}

const cloneState = (s: SimState): SimState => ({
  ...s,
  streak: { ...s.streak },
  mods: { ...s.mods },
  usedEvents: s.usedEvents.slice(),
  pending: s.pending ? { picks: s.pending.picks.slice(), eventId: s.pending.eventId } : null,
  history: s.history.slice(),
  log: s.log.slice(),
})

/** Игрок выбрал два дела — Буря подбрасывает событие. */
export function beginDay(state: SimState, picks: readonly ActionId[]): SimState {
  if (state.phase !== 'plan' || !validPicks(picks)) return state
  const s = cloneState(state)
  const rng = mulberry32(s.rng)
  const ev = drawEvent(s, picks, rng)
  s.usedEvents.push(ev.id)
  s.pending = { picks: picks.slice(), eventId: ev.id }
  s.phase = 'event'
  s.rng = rng.state
  return s
}

export const pendingEvent = (s: SimState): StormEvent | null =>
  s.pending ? (EVENT_BY_ID[s.pending.eventId] ?? null) : null

const actionTitle = (id: ActionId) => ACTION_BY_ID[id].title

/** Ответ на событие — и расчёт всего дня. */
export function chooseOption(state: SimState, optionIndex: number): SimState {
  const ev = pendingEvent(state)
  if (state.phase !== 'event' || !state.pending || !ev) return state
  const opt = ev.options[clamp(Math.round(optionIndex), 0, ev.options.length - 1)]
  const eff: EventEffect = opt.effect
  const s = cloneState(state)
  const rng = mulberry32(s.rng)

  const planned = s.pending!.picks
  const cancelled = !!eff.cancel && planned.some((p) => p !== 'rest')
  const picks: ActionId[] = eff.cancel ? ['rest', 'rest'] : planned.slice()
  const workCount = picks.filter((p) => p !== 'rest').length
  const ctx: TodayCtx = {
    mult: eff.mult ?? 1,
    liveMult: eff.liveMult ?? 1,
    extraCost: workCount ? (eff.extraCost ?? 0) / workCount : 0,
    restMult: eff.restMult ?? 1,
    mods: s.mods,
  }

  const energyStart = s.energy
  const interestStart = s.interest
  let energy = s.energy
  let interest = s.interest
  const outcomes: ActionOutcome[] = []
  picks.forEach((id, i) => {
    const o = expectAction(s, id, energy, interest, ctx, id === 'rest' && i === 1 && picks[0] === 'rest')
    // шум ±35% вокруг ожидания, затем стохастическое округление до целых заявок
    o.apps = roundChance(o.expected * (0.65 + 0.7 * rng.next()), rng)
    energy = clamp(energy + o.energy, 0, s.maxEnergy)
    interest = clamp(interest + o.interest, 0, 100)
    outcomes.push(o)
  })

  energy = clamp(energy + (eff.energy ?? 0), 0, s.maxEnergy)
  interest = clamp(interest + (eff.interest ?? 0), 0, 100)
  const trustBefore = s.trust
  s.trust = clamp(s.trust + (eff.trust ?? 0), -5, 6)
  // заявки от событий масштабируются вместе с аудиторией — иначе при маленькой цели всё решал бы случай
  const eventRaw = (eff.apps ?? 0) + (eff.appsChance && rng.chance(eff.appsChance) ? 1 : 0)
  const eventApps = eventRaw ? Math.max(eff.apps ? 1 : 0, roundChance(eventRaw * audienceScale(s.cfg), rng)) : 0
  const bonusApps = roundChance(s.cfg.bonusPerDay, rng)
  const actionApps = outcomes.reduce((a, o) => a + o.apps, 0)
  const apps = actionApps + eventApps + bonusApps
  s.applications += apps

  // вечер: интерес остывает, ритм и повторы пересчитываются
  const hadContent = picks.some((p) => ACTION_BY_ID[p].content)
  s.rhythm = hadContent ? s.rhythm + 1 : 0
  s.grind = picks.includes('rest') ? 0 : s.grind + 1
  interest = clamp(
    interest - (hadContent ? TUNING.decayContent : TUNING.decayIdle) - interest * TUNING.decayShare,
    0,
    100,
  )
  for (const a of ACTIONS) s.streak[a.id] = a.id !== 'rest' && picks.includes(a.id) ? s.streak[a.id] + 1 : 0

  const burnout = energy <= 0
  if (!burnout) energy = Math.min(s.maxEnergy, energy + TUNING.overnight)
  s.energy = Math.round(energy * 10) / 10
  s.interest = Math.round(interest * 10) / 10
  s.mods = { ...NO_MODS, ...(eff.next ?? {}) }
  s.burnoutNext = burnout && s.day < s.cfg.days

  const rec: DayRecord = {
    day: s.day,
    lost: false,
    picks,
    cancelled,
    eventId: ev.id,
    option: ev.options.indexOf(opt),
    result: opt.result,
    wise: !!opt.wise,
    outcomes,
    eventApps,
    bonusApps,
    apps,
    energyStart,
    energyEnd: s.energy,
    interestStart,
    interestEnd: s.interest,
    trustDelta: s.trust - trustBefore,
    burnout,
  }
  s.history.push(rec)
  const done = cancelled ? 'дела отменены, отдых' : picks.map(actionTitle).join(' и ')
  s.log.push(
    `День ${s.day}: ${done}. Буря: «${ev.title}» — ${opt.label.toLowerCase()}. ` +
      `+${apps} ${plural(apps, ['заявка', 'заявки', 'заявок'])}, всего ${s.applications}.` +
      (burnout ? ' Энергия на нуле.' : ''),
  )
  s.pending = null
  s.phase = 'report'
  s.rng = rng.state
  return s
}

/** Переход к следующему дню: обычный день, потерянный из-за выгорания или финал. */
export function nextDay(state: SimState): SimState {
  if (state.phase !== 'report' && state.phase !== 'lost') return state
  const s = cloneState(state)
  if (s.day >= s.cfg.days) {
    s.phase = 'final'
    return s
  }
  s.day += 1
  if (s.burnoutNext) {
    s.burnoutNext = false
    const energyStart = s.energy
    const interestStart = s.interest
    s.energy = Math.max(s.energy, Math.round(s.maxEnergy * TUNING.lostDayEnergy))
    s.interest = clamp(s.interest - TUNING.lostDayInterest, 0, 100)
    // пропасть без предупреждения — аудитория это замечает
    s.trust = clamp(s.trust - 1, -5, 6)
    s.rhythm = 0
    s.grind = 0
    s.streak = zeroStreak()
    s.mods = { ...NO_MODS }
    s.history.push({
      day: s.day,
      lost: true,
      picks: [],
      cancelled: false,
      outcomes: [],
      eventApps: 0,
      bonusApps: 0,
      apps: 0,
      energyStart,
      energyEnd: s.energy,
      interestStart,
      interestEnd: s.interest,
      trustDelta: -1,
      burnout: false,
    })
    s.log.push(`День ${s.day}: выгорание — день потерян, контента и заявок нет.`)
    s.phase = 'lost'
    return s
  }
  s.phase = 'plan'
  return s
}

export const isWon = (s: SimState) => s.applications >= s.cfg.target

/** Насколько сгустилась Буря: 0 — рассеялась, 1 — в полную силу. */
export function stormLevel(s: SimState): number {
  if (s.phase === 'final') return isWon(s) ? 0.04 : 0.92
  const done = s.phase === 'plan' || s.phase === 'event' ? s.day - 1 : s.day
  const expected = (s.cfg.target * done) / s.cfg.days
  const lead = (s.applications - expected) / Math.max(4, s.cfg.target)
  let lvl = 0.58 - lead * 1.5
  if (s.energy / s.maxEnergy < 0.35) lvl += 0.14
  lvl -= (s.interest - 45) / 260
  if (isWon(s)) lvl = Math.min(lvl, 0.18)
  return clamp(lvl, 0.04, 1)
}

// ---------- Разбор партии ----------

export interface SimSummary {
  won: boolean
  applications: number
  target: number
  byAction: Record<ActionId, { uses: number; apps: number }>
  eventApps: number
  bonusApps: number
  restSlots: number
  lostDays: number
  contentDays: number
  activeDays: number
  wiseChoices: number
  choices: number
  trust: number
  fatigueActions: number
  headline: string
  insights: string[]
  verdict: string
}

export function summarize(s: SimState): SimSummary {
  const byAction = Object.fromEntries(ACTIONS.map((a) => [a.id, { uses: 0, apps: 0 }])) as SimSummary['byAction']
  let eventApps = 0
  let bonusApps = 0
  let restSlots = 0
  let lostDays = 0
  let contentDays = 0
  let activeDays = 0
  let wiseChoices = 0
  let choices = 0
  let fatigueActions = 0
  for (const d of s.history) {
    if (d.lost) {
      lostDays++
      continue
    }
    activeDays++
    eventApps += d.eventApps
    bonusApps += d.bonusApps
    if (d.picks.some((p) => ACTION_BY_ID[p].content)) contentDays++
    if (d.eventId) {
      choices++
      if (d.wise) wiseChoices++
    }
    for (const o of d.outcomes) {
      byAction[o.id].uses++
      byAction[o.id].apps += o.apps
      if (o.id === 'rest') restSlots++
      else if (o.fatigue) fatigueActions++
    }
  }
  const won = isWon(s)
  const total = s.applications
  const days = s.cfg.days
  const insights: string[] = []
  const w = (n: number) => plural(n, ['заявка', 'заявки', 'заявок'])
  const dn = (n: number) => plural(n, ['день', 'дня', 'дней'])

  const dm = byAction.dm
  if (dm.uses > 0) {
    insights.push(
      `Личные сообщения тёплым контактам: ${dm.apps} ${w(dm.apps)} за ${dm.uses} ${plural(dm.uses, ['раз', 'раза', 'раз'])}. Люди, которые уже знают тебя, откликаются охотнее всех — если писать бережно и не каждый день.`,
    )
  } else {
    insights.push(
      'Личных сообщений в этой партии не было, а это самая тёплая дорога к заявке: люди, которые уже знают тебя, откликаются охотнее всех.',
    )
  }

  if (contentDays >= Math.ceil(days * 0.7)) {
    insights.push(`Регулярность сработала: контент выходил ${contentDays} из ${days} дней, и интерес не успевал остыть.`)
  } else {
    insights.push(
      `Контент выходил ${contentDays} из ${days} дней. В паузах интерес остывает быстрее, чем набирается, — даже короткие сторис держат ритм.`,
    )
  }

  if (lostDays > 0) {
    insights.push(
      `Выгорание забрало ${lostDays} ${dn(lostDays)} — без контента, без заявок и с остывшей аудиторией. Отдых вовремя обходится дешевле.`,
    )
  } else if (restSlots === 0) {
    insights.push('Отдыха не было ни разу: энергия таяла, и каждое следующее действие давало меньше.')
  } else {
    insights.push('Отдых не украл время у запуска: с полной энергией те же действия дают больше.')
  }

  if (fatigueActions > 0) {
    insights.push(
      `${fatigueActions} ${plural(fatigueActions, ['дело сделано', 'дела сделаны', 'дел сделано'])} на остатках сил — отдача от них заметно ниже.`,
    )
  }

  if (choices > 0) {
    if (s.trust > 0) {
      insights.push(
        `Бережные решения в Буре (${wiseChoices} из ${choices}) подняли доверие аудитории — а доверие повышает отклик на всё остальное.`,
      )
    } else if (s.trust < 0) {
      insights.push('Быстрые решения в Буре стоили доверия: отклик на предложения стал ниже, чем мог бы.')
    }
  }

  const headline = won
    ? total >= s.cfg.target * 1.4
      ? 'Буря рассеялась с запасом'
      : 'Буря рассеялась'
    : total >= s.cfg.target * 0.7
      ? 'Почти получилось'
      : 'Буря оказалась сильнее'

  const verdict =
    'Запуск выигрывает не тот, кто пашет без выходных, а тот, кто держит ритм: регулярный контент, личные сообщения тёплым контактам и отдых в плане, а не «когда-нибудь потом».'

  return {
    won,
    applications: total,
    target: s.cfg.target,
    byAction,
    eventApps,
    bonusApps,
    restSlots,
    lostDays,
    contentDays,
    activeDays,
    wiseChoices,
    choices,
    trust: s.trust,
    fatigueActions,
    headline,
    insights,
    verdict,
  }
}

// ---------- Автопрогон (для баланс-скриптов и тестов) ----------

export interface Strategy {
  name: string
  actions(s: SimState, rng: Rng): ActionId[]
  option(s: SimState, ev: StormEvent, rng: Rng): number
}

export function runSim(cfg: Partial<SimConfig> & { target: number }, strategy: Strategy, strategySeed = 7): SimState {
  let s = createSim(cfg)
  const rng = mulberry32(strategySeed)
  for (let guard = 0; guard < 400 && s.phase !== 'final'; guard++) {
    if (s.phase === 'plan') s = beginDay(s, strategy.actions(s, rng))
    else if (s.phase === 'event') s = chooseOption(s, strategy.option(s, pendingEvent(s)!, rng))
    else s = nextDay(s)
  }
  return s
}
