// «Мастер Игры»: превращает реальную цель игрока в маршрут, воронку и недельные квесты.
import { CHAPTER_META, ROUTE_ORDER } from './chapterMeta'
import type {
  AudienceSize,
  Channel,
  ChapterId,
  ChapterMode,
  Difficulty,
  Funnel,
  Goal,
  Plan,
  QuestDef,
  RouteStop,
  WeekPlan,
} from './types'

const AUDIENCE_WEEKLY_REACH: Record<AudienceSize, number> = { zero: 300, small: 1500, mid: 6000, big: 20000 }
const CHANNEL_MULT: Record<Channel, number> = {
  instagram: 1,
  telegram: 0.75,
  vk: 0.8,
  youtube: 0.9,
  tiktok: 1.5,
  offline: 0.35,
}
const REACH_TO_LEAD: Record<AudienceSize, number> = { zero: 0.015, small: 0.01, mid: 0.007, big: 0.005 }
const LEAD_TO_DIAG = 0.3
const DIAG_TO_CLIENT = 0.35
const WARM_TO_LEAD = 0.15

const WEIGHTS: Record<ChapterId, number> = {
  doubt: 0.6,
  forest: 1,
  forge: 1,
  tower: 1,
  studio: 1,
  launch: 1.4,
  arena: 1,
  lighthouse: 1.8,
}

export const AUDIENCE_LABEL: Record<AudienceSize, string> = {
  zero: 'почти нет, начинаю с нуля',
  small: 'до 1 000 подписчиков',
  mid: '1 000 – 10 000',
  big: 'больше 10 000',
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: 'Instagram',
  telegram: 'Telegram-канал',
  vk: 'ВКонтакте',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  offline: 'Сарафан и офлайн',
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  calm: 'Спокойный темп',
  normal: 'Честный вызов',
  ambitious: 'Амбициозно',
  heroic: 'Героический режим',
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const fmtNum = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))
export const fmtRub = (n: number) => `${fmtNum(n)} ₽`

/** Русское склонение: plural(5, 'неделя', 'недели', 'недель') */
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

export function computeFunnel(goal: Goal): Funnel {
  const clients = Math.max(1, Math.round(goal.clients))
  const diagnostics = Math.ceil(clients / DIAG_TO_CLIENT)
  const leads = Math.ceil(diagnostics / LEAD_TO_DIAG)
  const warm = goal.audience === 'zero' || goal.audience === 'small'
  const warmOutreach = warm ? clamp(Math.round(leads * 1.0), 30, 200) : clamp(Math.round(leads * 0.3), 10, 80)
  const rate = REACH_TO_LEAD[goal.audience] * (goal.channel === 'offline' ? 1.5 : 1)
  const fromContent = Math.max(0, leads - warmOutreach * WARM_TO_LEAD)
  const reach = Math.ceil(fromContent / rate)
  return {
    reach,
    leads,
    diagnostics,
    clients,
    warmOutreach,
    rates: { reachToLead: rate, leadToDiag: LEAD_TO_DIAG, diagToClient: DIAG_TO_CLIENT },
  }
}

function modeFor(id: ChapterId, goal: Goal): ChapterMode {
  if (id === 'forest' && goal.has.niche) return 'express'
  if (id === 'forge' && goal.has.product) return 'express'
  if (id === 'tower' && goal.has.bot) return 'express'
  if (id === 'studio' && goal.has.content) return 'express'
  return 'full'
}

function buildRoute(goal: Goal): RouteStop[] {
  const stops = ROUTE_ORDER.map((chapter) => ({ chapter, mode: modeFor(chapter, goal) }))
  const w = stops.map((s) => WEIGHTS[s.chapter] * (s.mode === 'express' ? 0.45 : 1))
  const total = w.reduce((a, b) => a + b, 0)
  let cum = 0
  return stops.map((s, i) => {
    const week = clamp(1 + Math.floor((cum / total) * goal.weeks), 1, goal.weeks)
    cum += w[i]
    return { ...s, week }
  })
}

function quest(
  id: string,
  week: number,
  chapter: ChapterId | undefined,
  title: string,
  desc: string,
  xp: number,
  coins: number,
  extra: Partial<QuestDef> = {},
): QuestDef {
  return { id, week, chapter, title, desc, xp, coins, kind: 'real', ...extra }
}

function chapterQuests(ch: ChapterId, week: number, goal: Goal, f: Funnel, route: RouteStop[]): QuestDef[] {
  const postsPerWeek = clamp(Math.round(goal.hoursPerWeek / 2.5), 2, 7)
  const arenaWeek = route.find((r) => r.chapter === 'arena')?.week ?? goal.weeks
  const diagWeeks = Math.max(1, goal.weeks - arenaWeek + 1)
  const diagPerWeek = clamp(Math.ceil(f.diagnostics / diagWeeks), 1, 15)
  const warmLaunch = clamp(Math.ceil(f.warmOutreach * 0.6), 10, 120)
  switch (ch) {
    case 'doubt':
      return [
        quest('doubt_facts', week, ch, 'Выпиши 10 фактов о своём опыте', 'Образование, часы практики, запросы, с которыми работаешь. Повесь список там, где увидишь его перед сессией.', 40, 10),
        quest('doubt_tell', week, ch, 'Расскажи трём знакомым, чем ты помогаешь', 'Не продавай — просто скажи вслух: «Я консультирую людей, которые…». Это разминка для голоса.', 80, 20, { target: 3, unit: 'разговора' }),
        quest('doubt_super', week, ch, 'Запишись на супервизию или интервизию', 'Практика растёт вместе с опорой. Супервизор — твой личный маяк.', 60, 15, { kind: 'selfcare' }),
      ]
    case 'forest':
      return [
        quest('forest_bio', week, ch, 'Обнови шапку профиля по новому позиционированию', 'Одна фраза: кому помогаешь, с чем и какой результат. Плюс ссылка на запись.', 60, 15),
        quest('forest_post', week, ch, 'Опубликуй пост «С кем я работаю»', 'Опиши своего клиента так, чтобы он узнал себя. И с кем ты не работаешь — это тоже честно.', 80, 20),
        quest('forest_ask', week, ch, 'Спроси трёх людей, понятно ли, кому ты помогаешь', 'Покажи шапку профиля коллегам или друзьям. Если они не могут пересказать — туман ещё не рассеялся.', 50, 10, { target: 3, unit: 'человека' }),
      ]
    case 'forge':
      return [
        quest('forge_magnet', week, ch, 'Сделай черновик лид-магнита', 'Чек-лист, мини-тест, аудиопрактика или гайд. Главное — польза за 10 минут.', 100, 25),
        quest('forge_prices', week, ch, 'Опубликуй линейку услуг с ценами', 'В закрепе, на сайте или в хайлайтах. Люди не пишут туда, где непонятно, сколько стоит.', 80, 20),
        quest('forge_legal', week, ch, 'Наведи порядок в юридической части', 'Самозанятость или ИП, договор-оферта, согласие на обработку персональных данных.', 60, 15),
      ]
    case 'tower':
      return [
        quest('tower_botfather', week, ch, 'Создай бота в @BotFather', 'Имя, юзернейм, аватар. Пять минут — и у практики появился круглосуточный администратор.', 40, 10),
        quest('tower_live', week, ch, 'Запусти бота', 'Через сервер игры, BotHelp, SaleBot — любой способ. Главное, чтобы он отвечал.', 120, 30),
        quest('tower_link', week, ch, 'Поставь ссылку на бота в шапку профиля', 'И в описание канала. Бот без ссылки — маяк без окна.', 40, 10),
        quest('tower_test', week, ch, 'Прогони бота на двух друзьях', 'Попроси честно рассказать, где было непонятно или скучно.', 60, 15, { target: 2, unit: 'теста' }),
      ]
    case 'studio':
      return [
        quest('studio_reel', week, ch, 'Опубликуй первый рилс', 'Смонтированный в Монтажной или снятый на телефон. Первый — самый страшный. Потом легче.', 120, 30),
        quest('studio_posts', week, ch, `Опубликуй ${postsPerWeek} публикаций по контент-плану`, 'Посты, рилсы, сторис — по плану из Студии Эха.', 100, 25, { target: postsPerWeek, unit: 'публикаций' }),
        quest('studio_comments', week, ch, 'Ответь на все комментарии за неделю', 'Каждый ответ — маленький разговор, из которого вырастает доверие.', 40, 10),
      ]
    case 'launch':
      return [
        quest('launch_warmup', week, ch, 'Проведи прогрев по плану', 'Каждый день — один шаг прогрева из плана запуска.', 150, 40, { target: 7, unit: 'дней' }),
        quest('launch_warm', week, ch, `Напиши лично ${warmLaunch} тёплым контактам`, 'Коротко и по-человечески: чем ты сейчас занимаешься и кому это может быть полезно. Без давления.', 120, 30, { target: warmLaunch, unit: 'сообщений' }),
        quest('launch_open', week, ch, 'Открой запись на знакомство', 'Пост или сторис с понятным шагом: как записаться и что будет на встрече.', 100, 25),
        quest('launch_live', week, ch, 'Проведи эфир или вебинар', 'Полчаса пользы и ответы на вопросы. Лица и голос продают бережнее любого текста.', 120, 30),
      ]
    case 'arena':
      return [
        quest('arena_diag', week, ch, `Проведи ${diagPerWeek} диагностических встреч`, 'По сценарию из Арены. После каждой — две строки: что сработало, что улучшить.', 200, 50, { target: diagPerWeek, unit: 'встреч' }),
        quest('arena_objections', week, ch, 'Запиши прозвучавшие возражения', 'И свои ответы. Через месяц это будет твой личный учебник продаж.', 60, 15),
        quest('arena_follow', week, ch, 'Сделай мягкий follow-up всем, кто взял паузу', 'Через 2–3 дня: «Как вам после нашей встречи? Если остались вопросы — я рядом».', 80, 20),
      ]
    case 'lighthouse':
      return []
  }
}

export function buildPlan(goal: Goal, season = 1): Plan {
  const funnel = computeFunnel(goal)
  const route = buildRoute(goal)
  const hoursFactor = clamp(goal.hoursPerWeek / 5, 0.5, 2.4)
  const weeklyCap = AUDIENCE_WEEKLY_REACH[goal.audience] * CHANNEL_MULT[goal.channel] * hoursFactor
  const prepWeeks = Math.max(1, Math.round(goal.weeks * 0.35))
  const activeWeeks = Math.max(1, goal.weeks - prepWeeks)
  const achievable = weeklyCap * activeWeeks * 1.3
  const pressure = funnel.reach / Math.max(1, achievable)
  const difficulty: Difficulty = pressure < 0.6 ? 'calm' : pressure < 1.15 ? 'normal' : pressure < 2.2 ? 'ambitious' : 'heroic'
  const comfortableWeeks = Math.ceil(prepWeeks + funnel.reach / (weeklyCap * 1.3))
  const bossScale = clamp(0.85 + 0.12 * Math.min(pressure, 3) + goal.clients / 80, 0.85, 1.6)
  const income = funnel.clients * goal.check
  const sessionsPerWeek = funnel.clients + goal.currentClients

  const weeks: WeekPlan[] = []
  const studioWeek = route.find((r) => r.chapter === 'studio')?.week ?? 1
  const arenaWeek = route.find((r) => r.chapter === 'arena')?.week ?? goal.weeks
  const postsPerWeek = clamp(Math.round(goal.hoursPerWeek / 2.5), 2, 7)
  const diagWeeks = Math.max(1, goal.weeks - arenaWeek + 1)
  const diagPerWeek = clamp(Math.ceil(funnel.diagnostics / diagWeeks), 1, 15)

  for (let i = 1; i <= goal.weeks; i++) {
    const focus = route.filter((r) => r.week === i && r.chapter !== 'lighthouse').map((r) => r.chapter)
    const quests: QuestDef[] = []
    for (const ch of focus) quests.push(...chapterQuests(ch, i, goal, funnel, route))
    if (i > studioWeek) {
      quests.push(
        quest(`w${i}_content`, i, undefined, `Неделя ${i}: ${postsPerWeek} публикаций`, 'Ровный темп важнее рывков. Алгоритмы и люди любят регулярность.', 90, 20, {
          target: postsPerWeek,
          unit: 'публикаций',
        }),
      )
    }
    if (i > arenaWeek) {
      quests.push(
        quest(`w${i}_diag`, i, undefined, `Неделя ${i}: ${diagPerWeek} знакомств с клиентами`, 'Встречи по сценарию диагностики. Каждая — шаг к Маяку.', 150, 35, {
          target: diagPerWeek,
          unit: 'встреч',
        }),
      )
    }
    quests.push(
      quest(`w${i}_rest`, i, undefined, 'Один день без работы и соцсетей', 'Фонарь горит на масле. Масло — это отдых.', 50, 10, { kind: 'selfcare' }),
    )
    const names = focus.map((c) => CHAPTER_META[c].name)
    const title = names.length ? `Неделя ${i}: ${names.join(', ')}` : `Неделя ${i}: ровный темп`
    weeks.push({ index: i, title, focus, quests })
  }

  const advice: string[] = []
  advice.push(
    `Чтобы прийти к ${funnel.clients} клиентам, понадобится около ${fmtNum(funnel.diagnostics)} знакомств, ~${fmtNum(funnel.leads)} заявок и ~${fmtNum(funnel.reach)} просмотров контента. Это средние цифры по рынку — по дороге сверим их с твоими настоящими.`,
  )
  if (goal.audience === 'zero' || goal.audience === 'small') {
    advice.push(`Первые клиенты почти всегда приходят из тёплого круга. В маршрут добавлены личные сообщения — около ${funnel.warmOutreach} за весь путь.`)
  }
  if (difficulty === 'heroic') {
    const calmPace = comfortableWeeks > 52 ? 'больше года' : `примерно ${comfortableWeeks} ${plural(comfortableWeeks, 'неделя', 'недели', 'недель')}`
    advice.push(`Цель смелая. При твоей аудитории спокойный темп — ${calmPace}. Можно оставить как есть: тогда тени будут сильнее, а награды — щедрее.`)
  } else if (difficulty === 'ambitious') {
    advice.push(`Придётся держать темп. Проверь, что в неделе действительно найдутся ${goal.hoursPerWeek} часов на развитие практики.`)
  } else if (difficulty === 'calm') {
    advice.push('Темп спокойный — хватит сил и на сессии, и на жизнь. Можно даже замахнуться на большее.')
  }
  advice.push(`Когда цель будет достигнута, у тебя будет около ${sessionsPerWeek} сессий в неделю. Заложи время на супервизию и отдых — выгорание тоже босс.`)
  advice.push(`${funnel.clients} × ${fmtRub(goal.check)} = ${fmtRub(income)} — доход от пакетов первой волны.`)
  if (!goal.has.product) advice.push('Начнём с продукта: пока нет понятной линейки услуг, людям нечего выбрать.')

  return {
    funnel,
    income,
    sessionsPerWeek,
    difficulty,
    difficultyLabel: DIFFICULTY_LABEL[difficulty],
    pressure,
    comfortableWeeks,
    bossScale,
    route,
    weeks,
    advice,
    generatedAt: Date.now(),
    season,
  }
}

export function allQuests(plan: Plan): QuestDef[] {
  return plan.weeks.flatMap((w) => w.quests)
}

/** Номер текущей недели пути по дате старта */
export function currentWeek(goal: Goal, now = Date.now()): number {
  const start = new Date(goal.startDate + 'T00:00:00').getTime()
  if (Number.isNaN(start)) return 1
  const w = Math.floor((now - start) / (7 * 24 * 3600 * 1000)) + 1
  return clamp(w, 1, goal.weeks)
}
