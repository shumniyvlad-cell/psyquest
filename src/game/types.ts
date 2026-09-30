// Базовые типы игры. Всё, что игрок создаёт в главах, — настоящие артефакты его практики.

export type Gender = 'm' | 'f'
export type ClassId = 'analyst' | 'gestalt' | 'cbt' | 'coach' | 'creative'
export type StatId = 'confidence' | 'expertise' | 'charisma' | 'resilience'
export type ChapterId =
  | 'doubt'
  | 'forest'
  | 'forge'
  | 'tower'
  | 'studio'
  | 'launch'
  | 'arena'
  | 'lighthouse'
export type ChapterStatus = 'locked' | 'available' | 'active' | 'done'
export type ChapterMode = 'full' | 'express'
export type Channel = 'instagram' | 'telegram' | 'vk' | 'youtube' | 'tiktok' | 'offline'
export type AudienceSize = 'zero' | 'small' | 'mid' | 'big'
export type LanternId = 'amber' | 'mint' | 'rose' | 'lilac' | 'emerald' | 'aurora' | 'crimson'

export type Stats = Record<StatId, number>

export interface Hero {
  name: string
  gender: Gender
  classId: ClassId
  lantern: LanternId
}

export interface Goal {
  /** Сколько новых клиентов игрок хочет привлечь */
  clients: number
  /** Срок в неделях */
  weeks: number
  /** Средний чек пакета, ₽ */
  check: number
  niche: string
  channel: Channel
  audience: AudienceSize
  has: { niche: boolean; product: boolean; bot: boolean; content: boolean }
  currentClients: number
  hoursPerWeek: number
  /** YYYY-MM-DD */
  startDate: string
}

export interface Funnel {
  reach: number
  leads: number
  diagnostics: number
  clients: number
  warmOutreach: number
  rates: { reachToLead: number; leadToDiag: number; diagToClient: number }
}

export interface RouteStop {
  chapter: ChapterId
  mode: ChapterMode
  week: number
}

export interface QuestDef {
  id: string
  chapter?: ChapterId
  week: number
  title: string
  desc: string
  xp: number
  coins: number
  /** Для квестов со счётчиком: сколько раз нужно сделать */
  target?: number
  unit?: string
  kind: 'real' | 'selfcare'
}

export interface WeekPlan {
  index: number
  title: string
  focus: ChapterId[]
  quests: QuestDef[]
}

export type Difficulty = 'calm' | 'normal' | 'ambitious' | 'heroic'

export interface Plan {
  funnel: Funnel
  income: number
  sessionsPerWeek: number
  difficulty: Difficulty
  difficultyLabel: string
  /** Во сколько раз цель больше реалистичного охвата за срок */
  pressure: number
  /** Сколько недель нужно для спокойного темпа */
  comfortableWeeks: number
  bossScale: number
  route: RouteStop[]
  weeks: WeekPlan[]
  advice: string[]
  generatedAt: number
  season: number
}

// ---------- Артефакты (реальные результаты игрока) ----------

export interface ExpertiseArtifact {
  education: string
  hours: string
  requests: string
  caseStory: string
  support: string
  uniqueness: string
}

export interface PositioningArtifact {
  who: string
  pain: string
  result: string
  method: string
  statement: string
  score: number
}

export interface ProductItem {
  name: string
  format: string
  price: number
  promise: string
}

export interface ProductArtifact {
  leadMagnet: ProductItem
  entry: ProductItem
  core: ProductItem
  premium: ProductItem
  /** Оценка ковки: S / A / B / C */
  quality: 'S' | 'A' | 'B' | 'C'
}

export interface BotQuizQuestion {
  id: string
  text: string
  options: string[]
}

export interface BotConfig {
  botName: string
  welcome: string
  consent: boolean
  consentText: string
  leadMagnetTitle: string
  leadMagnetUrl: string
  quiz: BotQuizQuestion[]
  offerText: string
  offerPrice: number
  bookingText: string
  bookingUrl: string
  followUp: string
  crisisText: string
  /** Заполняется после деплоя через сервер игры */
  deployed?: { botId: string; username: string; adminCode: string; deployedAt: number }
}

export interface ReelScript {
  id: string
  hook: string
  problem: string
  insight: string
  cta: string
}

export interface ContentPlanDay {
  day: number
  rubric: 'expert' | 'personal' | 'selling' | 'engaging'
  format: 'reel' | 'post' | 'stories' | 'live'
  topic: string
}

export interface ContentArtifact {
  hooks: string[]
  scripts: ReelScript[]
  plan: ContentPlanDay[]
}

export interface LaunchDay {
  day: number
  date: string
  stage: string
  content: string
}

export interface LaunchArtifact {
  startDate: string
  days: LaunchDay[]
  /** Сколько заявок собрано в симуляции запуска */
  simApplications: number
}

export interface SalesStep {
  id: string
  title: string
  text: string
}

export interface SalesArtifact {
  steps: SalesStep[]
}

export interface ReelExport {
  exportedAt: number
  durationSec: number
  format: string
}

export interface Artifacts {
  expertise?: ExpertiseArtifact
  positioning?: PositioningArtifact
  product?: ProductArtifact
  bot?: BotConfig
  content?: ContentArtifact
  launch?: LaunchArtifact
  sales?: SalesArtifact
  reel?: ReelExport
}

export type ArtifactKey = keyof Artifacts

export interface ClientRecord {
  id: string
  name: string
  date: string
  amount: number
  product: string
  note: string
  season: number
}

export interface QuestState {
  done: boolean
  doneAt?: number
  progress?: number
  note?: string
}

export interface ChapterState {
  status: ChapterStatus
  step: number
  completedAt?: number
  replays?: number
}

export interface Settings {
  music: number
  sfx: number
  textSpeed: 'slow' | 'normal' | 'fast' | 'instant'
  reducedMotion: boolean
}

export interface JournalEntry {
  t: number
  text: string
}
