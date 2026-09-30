// «Демон Выгорания» — чистая логика финального босса. Без React, детерминировано зерном.

// ---------- ГПСЧ (своя копия mulberry32, чтобы зона не зависела от соседей) ----------

function mulberry32(seed: number) {
  let a = seed >>> 0
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    get state() {
      return a
    },
  }
}

export const randomSeed = () => Math.floor(Math.random() * 4294967296) >>> 0

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n))
  const d10 = abs % 10
  const d100 = abs % 100
  if (d10 === 1 && d100 !== 11) return forms[0]
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return forms[1]
  return forms[2]
}

// ---------- Шкалы ----------

export type ScaleId = 'work' | 'recovery' | 'growth'
export type Zone = 'green' | 'yellow' | 'red'

export interface ScaleDef {
  id: ScaleId
  title: string
  hint: string
  /** Середина зелёной зоны */
  center: number
  lowText: string
  highText: string
}

export const SCALES: ScaleDef[] = [
  {
    id: 'work',
    title: 'Работа',
    hint: 'Клиенты и контент',
    center: 55,
    lowText: 'Практика простаивает',
    highText: 'Перегруз',
  },
  {
    id: 'recovery',
    title: 'Восстановление',
    hint: 'Сон, отдых, опоры',
    center: 60,
    lowText: 'Силы на исходе',
    highText: 'Отдых превратился в избегание',
  },
  {
    id: 'growth',
    title: 'Развитие',
    hint: 'Супервизия и обучение',
    center: 50,
    lowText: 'Застой и профдеформация',
    highText: 'Учёбы больше, чем практики',
  },
]

export const SCALE_IDS: ScaleId[] = ['work', 'recovery', 'growth']

/** Красные края шкал: ниже RED_LOW или выше RED_HIGH */
export const RED_LOW = 15
export const RED_HIGH = 90
export const WIN_TURNS = 8
export const MAX_TURNS = 16
export const RED_LIMIT = 2

/** Полуширина зелёной зоны: стойкость расширяет её */
export const greenHalf = (resilience: number) => 9 + clamp(resilience, 1, 20) * 0.75

export function greenRange(id: ScaleId, resilience: number): [number, number] {
  const c = SCALES.find((s) => s.id === id)!.center
  const h = greenHalf(resilience)
  return [Math.max(RED_LOW, c - h), Math.min(RED_HIGH, c + h)]
}

export function zoneOf(id: ScaleId, value: number, resilience: number): Zone {
  if (value < RED_LOW || value > RED_HIGH) return 'red'
  const [lo, hi] = greenRange(id, resilience)
  return value >= lo && value <= hi ? 'green' : 'yellow'
}

// ---------- Карты ----------

export type Vec = Record<ScaleId, number>

export interface BalanceCard {
  id: string
  title: string
  quip: string
  effect: Vec
  /** Отложенный эффект — прилетит в начале следующей недели */
  after?: Partial<Vec>
  afterText?: string
  /** Изменение числа клиентов — а значит, и недельной нагрузки */
  clients?: number
  kind: 'care' | 'growth' | 'work' | 'boundary' | 'trap'
}

export const CARDS: BalanceCard[] = [
  {
    id: 'supervision',
    title: 'Супервизия',
    quip: 'Взгляд со стороны на свою работу — не экзамен, а опора.',
    effect: { work: 0, recovery: 6, growth: 14 },
    kind: 'growth',
  },
  {
    id: 'therapy',
    title: 'Личная терапия',
    quip: 'Сапожник наконец-то в сапогах.',
    effect: { work: -2, recovery: 14, growth: 6 },
    kind: 'care',
  },
  {
    id: 'offline',
    title: 'Выходной без телефона',
    quip: 'Клиенты выживут. Проверено.',
    effect: { work: -10, recovery: 22, growth: 0 },
    kind: 'care',
  },
  {
    id: 'more',
    title: 'Взять ещё клиента',
    quip: 'Деньги нужны, а часов в сутках по-прежнему двадцать четыре.',
    effect: { work: 14, recovery: -6, growth: -2 },
    clients: 1,
    kind: 'work',
  },
  {
    id: 'referral',
    title: 'Перенаправить клиента не из своей ниши',
    quip: 'Не твой запрос — не твоя вина. Хороший коллега — подарок клиенту.',
    effect: { work: -12, recovery: 6, growth: 4 },
    clients: -1,
    kind: 'boundary',
  },
  {
    id: 'price',
    title: 'Поднять цену для новых клиентов',
    quip: 'Страшно ровно три дня, потом легче.',
    effect: { work: -8, recovery: 8, growth: 2 },
    kind: 'boundary',
  },
  {
    id: 'walk',
    title: 'Прогулка и спорт',
    quip: 'Тело — тоже рабочий инструмент, и его тоже надо заряжать.',
    effect: { work: -3, recovery: 12, growth: 0 },
    kind: 'care',
  },
  {
    id: 'course',
    title: 'Курс повышения квалификации',
    quip: 'Ещё один сертификат в папку. Главное — применить.',
    effect: { work: -4, recovery: -6, growth: 18 },
    kind: 'growth',
  },
  {
    id: 'cancel',
    title: 'Отменить сессию в последний момент',
    quip: 'Облегчение на час, чувство вины на неделю.',
    effect: { work: -10, recovery: 8, growth: -6 },
    after: { recovery: -8 },
    afterText: 'Вина за отменённую сессию догоняет: восстановление −8',
    kind: 'trap',
  },
]

export const CARD_BY_ID: Record<string, BalanceCard> = Object.fromEntries(CARDS.map((c) => [c.id, c]))

// ---------- Состояние ----------

export interface BalanceConfig {
  resilience: number
  clients: number
  seed: number
}

export interface TurnRecord {
  turn: number
  drift: Vec
  card: string
  values: Vec
  zones: Record<ScaleId, Zone>
  green: boolean
  red: ScaleId[]
}

export interface BalanceState {
  cfg: BalanceConfig
  turn: number
  clients: number
  values: Vec
  hand: string[]
  greenTurns: number
  redStreak: Vec
  pendingAfter: Partial<Vec>
  pendingText: string
  lastDrift: Vec
  /** play — выбор карты, review — разбор недели, дальше won / lost */
  phase: 'play' | 'review' | 'won' | 'lost'
  lossReason?: { scale: ScaleId | 'time'; side?: 'low' | 'high' }
  /** Последний ход закончился красной зоной — демон вспыхивает */
  flare: boolean
  history: TurnRecord[]
  rng: number
}

const START: Vec = { work: 50, recovery: 58, growth: 48 }
const zeroVec = (): Vec => ({ work: 0, recovery: 0, growth: 0 })

/** Недельный дрейф: нагрузка растёт с числом клиентов, силы и навыки тают */
export function baseDrift(clients: number): Vec {
  const c = Math.sqrt(clamp(clients, 0, 40))
  return {
    work: 2 + 1.6 * c,
    recovery: -(3.5 + 1.1 * c),
    growth: -4,
  }
}

function startTurn(s: BalanceState, rng: ReturnType<typeof mulberry32>) {
  const base = baseDrift(s.clients)
  const drift = zeroVec()
  for (const id of SCALE_IDS) {
    const noise = 0.8 + 0.4 * rng.next()
    drift[id] = Math.round((base[id] * noise + (s.pendingAfter[id] ?? 0)) * 10) / 10
    s.values[id] = clamp(Math.round((s.values[id] + drift[id]) * 10) / 10, 0, 100)
  }
  s.lastDrift = drift
  s.pendingAfter = {}
  // три разные карты из колоды
  const ids = CARDS.map((c) => c.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  s.hand = ids.slice(0, 3)
}

const fin = (v: number | undefined, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

export function createBalance(input: Partial<BalanceConfig>): BalanceState {
  const cfg: BalanceConfig = {
    resilience: clamp(Math.round(fin(input.resilience, 5)), 1, 20),
    clients: clamp(Math.round(fin(input.clients, 5)), 0, 40),
    seed: fin(input.seed, 1) >>> 0,
  }
  const rng = mulberry32(cfg.seed ^ 0x51ed270b)
  const s: BalanceState = {
    cfg,
    turn: 1,
    clients: cfg.clients,
    values: { ...START },
    hand: [],
    greenTurns: 0,
    redStreak: zeroVec(),
    pendingAfter: {},
    pendingText: '',
    lastDrift: zeroVec(),
    phase: 'play',
    flare: false,
    history: [],
    rng: 0,
  }
  startTurn(s, rng)
  s.rng = rng.state
  return s
}

export const zonesOf = (s: Pick<BalanceState, 'values' | 'cfg'>, values: Vec = s.values) =>
  Object.fromEntries(SCALE_IDS.map((id) => [id, zoneOf(id, values[id], s.cfg.resilience)])) as Record<ScaleId, Zone>

/** Значения шкал после карты — для подсказки до выбора */
export function previewCard(s: BalanceState, cardId: string): Vec {
  const card = CARD_BY_ID[cardId]
  const out = { ...s.values }
  if (!card) return out
  for (const id of SCALE_IDS) out[id] = clamp(out[id] + card.effect[id], 0, 100)
  return out
}

export function playCard(state: BalanceState, cardId: string): BalanceState {
  const card = CARD_BY_ID[cardId]
  if (state.phase !== 'play' || !card || !state.hand.includes(cardId)) return state
  const s: BalanceState = {
    ...state,
    values: previewCard(state, cardId),
    redStreak: { ...state.redStreak },
    pendingAfter: { ...(card.after ?? {}) },
    pendingText: card.afterText ?? '',
    history: state.history.slice(),
    clients: clamp(state.clients + (card.clients ?? 0), 0, 40),
  }
  const zones = zonesOf(s)
  const red = SCALE_IDS.filter((id) => zones[id] === 'red')
  const green = SCALE_IDS.every((id) => zones[id] === 'green')
  for (const id of SCALE_IDS) s.redStreak[id] = zones[id] === 'red' ? s.redStreak[id] + 1 : 0
  if (green) s.greenTurns += 1
  s.flare = red.length > 0
  s.history.push({ turn: s.turn, drift: state.lastDrift, card: cardId, values: { ...s.values }, zones, green, red })

  const burnt = SCALE_IDS.find((id) => s.redStreak[id] >= RED_LIMIT)
  if (s.greenTurns >= WIN_TURNS) {
    s.phase = 'won'
  } else if (burnt) {
    s.phase = 'lost'
    s.lossReason = { scale: burnt, side: s.values[burnt] < RED_LOW ? 'low' : 'high' }
  } else if (s.turn >= MAX_TURNS) {
    s.phase = 'lost'
    s.lossReason = { scale: 'time' }
  } else {
    s.phase = 'review'
  }
  return s
}

/** Новая неделя: дрейф шкал и свежая раздача */
export function nextTurn(state: BalanceState): BalanceState {
  if (state.phase !== 'review') return state
  const s: BalanceState = {
    ...state,
    values: { ...state.values },
    turn: state.turn + 1,
    phase: 'play',
    flare: false,
  }
  const rng = mulberry32(s.rng)
  startTurn(s, rng)
  s.rng = rng.state
  return s
}

/** 1 — демон в полной силе, 0 — рассеялся */
export const demonPower = (s: BalanceState) => (s.phase === 'won' ? 0 : 1 - s.greenTurns / WIN_TURNS)

// ---------- Итог ----------

export interface BalanceInsight {
  title: string
  text: string
  lines: string[]
  moral: string
}

const LOSS_TEXT: Record<ScaleId, { low: string; high: string }> = {
  work: {
    low: 'Практика простаивала: без клиентов тревога растёт быстрее, чем отдых её гасит. Нагрузку снижают постепенно, а не обнуляют.',
    high: 'Работа захлестнула: слишком много клиентов и контента на одного человека. Границы и перенаправление — забота о клиентах, а не отказ от них.',
  },
  recovery: {
    low: 'Силы закончились раньше задач. Отдых и личная терапия — такие же рабочие инструменты психолога, как супервизия и методички.',
    high: 'Отдых превратился в избегание: практика и развитие остались без внимания. Восстановление — опора для работы, а не замена ей.',
  },
  growth: {
    low: 'Без супервизии и обучения работа превращается в конвейер — отсюда недалеко до профдеформации.',
    high: 'Учёба вытеснила практику и отдых. Ещё один курс не заменит живого опыта и нормального сна.',
  },
}

export function insight(s: BalanceState): BalanceInsight {
  const counts: Record<string, number> = {}
  for (const h of s.history) counts[h.card] = (counts[h.card] ?? 0) + 1
  const times = (n: number) => `${n} ${plural(n, ['раз', 'раза', 'раз'])}`
  const lines: string[] = []
  const care = (counts.therapy ?? 0) + (counts.offline ?? 0) + (counts.walk ?? 0)
  const bounds = (counts.referral ?? 0) + (counts.price ?? 0)
  const sup = counts.supervision ?? 0
  lines.push(
    sup > 0
      ? `Супервизия — ${times(sup)}. Взгляд коллеги со стороны помогает заметить перегруз раньше, чем его заметит тело.`
      : 'Супервизии в этой партии не было ни разу, а это самый быстрый способ заметить перегруз со стороны.',
  )
  lines.push(
    bounds > 0
      ? `Границы — ${times(bounds)}: перенаправить клиента или поднять цену значит сохранить силы для тех, кому помогаешь.`
      : 'Границ не было: ни перенаправлений, ни пересмотра цены. Нагрузка росла без спроса.',
  )
  lines.push(
    care > 0
      ? `Восстановление — ${times(care)}: терапия, выходные и прогулки держали силы на плаву.`
      : 'Отдыха не было ни разу — силы держались на честном слове.',
  )
  if (counts.cancel) lines.push(`Отменённые в последний момент сессии — ${times(counts.cancel)}: облегчение быстрое, а вина долгая.`)
  if (counts.more) lines.push(`Новые клиенты сверх плана — ${times(counts.more)}: каждый добавлял нагрузку на все следующие недели.`)

  const moral =
    'Супервизия, границы и отдых — часть профессии психолога, а не слабость. Профилактика выгорания работает, когда она регулярная.'

  if (s.phase === 'won') {
    return {
      title: 'Демон рассеялся',
      text: `Восемь недель равновесия — и от Демона остался только дымок. Устойчивость складывается не из рывка, а из маленьких регулярных решений.`,
      lines,
      moral,
    }
  }
  const r = s.lossReason
  const text =
    !r || r.scale === 'time'
      ? `Шестнадцать недель на грани: шкалы слишком редко были в зелёной зоне одновременно. Равновесие — это регулярность, а не рывок.`
      : LOSS_TEXT[r.scale][r.side ?? 'low']
  return { title: 'Демон пока сильнее', text, lines, moral }
}

// ---------- Автопрогон для баланс-скриптов ----------

export type BalanceStrategy = (s: BalanceState, roll: () => number) => string

export function runBalance(cfg: Partial<BalanceConfig>, strategy: BalanceStrategy, strategySeed = 3): BalanceState {
  let s = createBalance(cfg)
  const rng = mulberry32(strategySeed)
  for (let guard = 0; guard < MAX_TURNS * 3 && (s.phase === 'play' || s.phase === 'review'); guard++) {
    s = s.phase === 'play' ? playCard(s, strategy(s, () => rng.next())) : nextTurn(s)
  }
  return s
}
