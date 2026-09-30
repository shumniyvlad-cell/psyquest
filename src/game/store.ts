import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { sfx, stinger } from '../audio/engine'
import { CHAPTER_META, ROUTE_ORDER } from './chapterMeta'
import { CONSUMABLES, type ConsumableId, type RelicId } from './items'
import { allQuests, buildPlan, plural } from './planner'
import { CLASSES, LANTERNS, SKILL_POINTS_PER_LEVEL, effectiveStats, titleForLevel, xpForLevel } from './progression'
import type {
  ArtifactKey,
  Artifacts,
  ChapterId,
  ChapterState,
  ClientRecord,
  Goal,
  Hero,
  JournalEntry,
  Plan,
  QuestState,
  Settings,
  StatId,
  Stats,
} from './types'
import { lcFirst, type TextCtx } from './text'

export type Scene = 'title' | 'create' | 'prologue' | 'oath' | 'route' | 'map' | 'chapter' | 'ending'
export type PanelId = 'quests' | 'hero' | 'chest' | 'shop' | 'clients' | 'settings' | 'paywall' | null

export interface Toast {
  id: number
  text: string
  sub?: string
  kind: 'xp' | 'coin' | 'item' | 'info' | 'warn'
}

export interface SaveData {
  version: number
  playerId: string
  createdAt: number
  hero: Hero | null
  goal: Goal | null
  plan: Plan | null
  level: number
  xp: number
  totalXp: number
  skillPoints: number
  allocated: Stats
  reputation: number
  coins: number
  consumables: Record<ConsumableId, number>
  relics: RelicId[]
  owned: string[]
  aiCredits: number
  artifacts: Artifacts
  chapters: Record<ChapterId, ChapterState>
  quests: Record<string, QuestState>
  clients: ClientRecord[]
  flags: Record<string, boolean>
  seenEvents: string[]
  journal: JournalEntry[]
  settings: Settings
  season: number
  counters: { battlesWon: number; battlesLost: number; questsDone: number; streak: number; lastActiveDay: string; eventsSeen: number }
  mapNode: number
}

interface UiState {
  scene: Scene
  panel: PanelId
  paywallFor: ChapterId | null
  shopTab: 'coins' | 'treasury' | 'looks'
  toasts: Toast[]
  levelUps: number[]
  currentChapter: ChapterId | null
  pendingEvent: string | null
}

interface Actions {
  go: (scene: Scene) => void
  openPanel: (panel: PanelId, opts?: { shopTab?: UiState['shopTab'] }) => void
  toast: (text: string, kind?: Toast['kind'], sub?: string) => void
  dismissToast: (id: number) => void
  shiftLevelUp: () => void
  newGame: () => void
  setHero: (hero: Hero) => void
  swearOath: (goal: Goal) => void
  gainXp: (amount: number, reason?: string) => number
  addCoins: (amount: number, reason?: string) => void
  spendCoins: (amount: number) => boolean
  addConsumable: (id: ConsumableId, n?: number) => void
  useConsumable: (id: ConsumableId) => boolean
  buyConsumable: (id: ConsumableId) => boolean
  grantRelic: (id: RelicId) => void
  grant: (ids: string[]) => void
  buyLantern: (id: keyof typeof LANTERNS) => boolean
  setLantern: (id: keyof typeof LANTERNS) => void
  addAiCredits: (n: number) => void
  useAiCredit: () => boolean
  setArtifact: <K extends ArtifactKey>(key: K, value: Artifacts[K]) => void
  startChapter: (id: ChapterId) => void
  leaveChapter: () => void
  setChapterStep: (id: ChapterId, step: number) => void
  completeChapter: (id: ChapterId) => void
  setQuestProgress: (id: string, value: number) => void
  completeQuest: (id: string, note?: string) => void
  addClient: (c: Omit<ClientRecord, 'id' | 'season'>) => void
  removeClient: (id: string) => void
  allocate: (stat: StatId) => void
  adjustReputation: (delta: number) => void
  setFlag: (key: string, value?: boolean) => void
  markEventSeen: (id: string) => void
  setPendingEvent: (id: string | null) => void
  log: (text: string) => void
  setSettings: (patch: Partial<Settings>) => void
  moveTo: (node: number) => void
  recordBattle: (won: boolean) => void
  startNewSeason: (goal: Goal) => void
  exportSave: () => string
  importSave: (json: string) => boolean
}

export type GameState = SaveData & UiState & Actions

const SAVE_KEYS: (keyof SaveData)[] = [
  'version', 'playerId', 'createdAt', 'hero', 'goal', 'plan', 'level', 'xp', 'totalXp', 'skillPoints',
  'allocated', 'reputation', 'coins', 'consumables', 'relics', 'owned', 'aiCredits', 'artifacts',
  'chapters', 'quests', 'clients', 'flags', 'seenEvents', 'journal', 'settings', 'season', 'counters', 'mapNode',
]

function uuid(): string {
  const c = globalThis.crypto
  if (c && 'randomUUID' in c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID()
    } catch {
      /* небезопасный контекст — ниже фоллбек */
    }
  }
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export const shortId = () => Math.random().toString(36).slice(2, 10)

const today = () => new Date().toISOString().slice(0, 10)

function freshChapters(): Record<ChapterId, ChapterState> {
  return Object.fromEntries(
    ROUTE_ORDER.map((id, i) => [id, { status: i === 0 ? 'available' : 'locked', step: 0 } satisfies ChapterState]),
  ) as Record<ChapterId, ChapterState>
}

const DEFAULT_SETTINGS: Settings = { music: 0.55, sfx: 0.8, textSpeed: 'normal', reducedMotion: false }

function freshSave(keep?: Partial<SaveData>): SaveData {
  return {
    version: 1,
    playerId: keep?.playerId ?? uuid(),
    createdAt: Date.now(),
    hero: null,
    goal: null,
    plan: null,
    level: 1,
    xp: 0,
    totalXp: 0,
    skillPoints: 0,
    allocated: { confidence: 0, expertise: 0, charisma: 0, resilience: 0 },
    reputation: 50,
    coins: keep?.coins ?? 60,
    consumables: { hint: 2, tea: 1, supervision: 0 },
    relics: [],
    owned: keep?.owned ?? [],
    aiCredits: keep?.aiCredits ?? 3,
    artifacts: {},
    chapters: freshChapters(),
    quests: {},
    clients: [],
    flags: {},
    seenEvents: [],
    journal: [],
    settings: keep?.settings ?? DEFAULT_SETTINGS,
    season: 1,
    counters: { battlesWon: 0, battlesLost: 0, questsDone: 0, streak: 0, lastActiveDay: '', eventsSeen: 0 },
    mapNode: 0,
  }
}

let toastSeq = 1

// Слот сохранения из адреса: ?save=demo — отдельный сейв, например для показа игры клиенту
const SLOT = (() => {
  try {
    const v = new URLSearchParams(window.location.search).get('save')
    return v && /^[a-z0-9_-]{1,20}$/i.test(v) ? `-${v}` : ''
  } catch {
    return ''
  }
})()

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...freshSave(),
      scene: 'title',
      panel: null,
      paywallFor: null,
      shopTab: 'coins',
      toasts: [],
      levelUps: [],
      currentChapter: null,
      pendingEvent: null,

      go: (scene) => set({ scene, panel: null }),
      openPanel: (panel, opts) => {
        if (panel) sfx('open')
        set({ panel, ...(opts?.shopTab ? { shopTab: opts.shopTab } : {}) })
      },
      toast: (text, kind = 'info', sub) => {
        const id = toastSeq++
        set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, sub, kind }] }))
        setTimeout(() => get().dismissToast(id), 3200)
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      shiftLevelUp: () => set((s) => ({ levelUps: s.levelUps.slice(1) })),

      newGame: () => {
        const s = get()
        set({
          ...freshSave({ playerId: s.playerId, owned: s.owned, aiCredits: s.aiCredits, coins: s.coins, settings: s.settings }),
          scene: 'create',
          panel: null,
          currentChapter: null,
          levelUps: [],
        })
      },

      setHero: (hero) => set({ hero }),

      swearOath: (goal) => {
        const plan = buildPlan(goal, get().season)
        set({ goal, plan, chapters: freshChapters(), quests: {}, mapNode: 0 })
        get().log(`Клятва: ${goal.clients} новых клиентов за ${goal.weeks} недель.`)
      },

      gainXp: (amount, reason) => {
        const s = get()
        if (amount <= 0) return 0
        let mult = 1
        if (s.relics.includes('compass')) mult += 0.1
        if (s.hero && s.currentChapter && CLASSES[s.hero.classId].bonusChapter === s.currentChapter) mult += 0.25
        const gained = Math.round(amount * mult)
        let { level, xp, skillPoints } = s
        xp += gained
        const ups: number[] = []
        while (xp >= xpForLevel(level)) {
          xp -= xpForLevel(level)
          level++
          skillPoints += SKILL_POINTS_PER_LEVEL
          ups.push(level)
        }
        set({ level, xp, skillPoints, totalXp: s.totalXp + gained, levelUps: [...s.levelUps, ...ups] })
        get().toast(`+${gained} опыта`, 'xp', reason)
        sfx('xp')
        if (ups.length) {
          stinger('levelup')
          get().log(`Новый уровень: ${level} — «${titleForLevel(level)}».`)
        }
        return gained
      },

      addCoins: (amount, reason) => {
        if (amount === 0) return
        set((s) => ({ coins: Math.max(0, s.coins + amount) }))
        if (amount > 0) {
          get().toast(`+${amount} ${plural(amount, 'монета', 'монеты', 'монет')}`, 'coin', reason)
          sfx('coin')
        }
      },
      spendCoins: (amount) => {
        if (get().coins < amount) {
          sfx('error')
          return false
        }
        set((s) => ({ coins: s.coins - amount }))
        sfx('coin')
        return true
      },

      addConsumable: (id, n = 1) => set((s) => ({ consumables: { ...s.consumables, [id]: (s.consumables[id] ?? 0) + n } })),
      useConsumable: (id) => {
        const have = get().consumables[id] ?? 0
        if (have <= 0) return false
        set((s) => ({ consumables: { ...s.consumables, [id]: have - 1 } }))
        return true
      },
      buyConsumable: (id) => {
        const def = CONSUMABLES[id]
        if (!get().spendCoins(def.price)) return false
        get().addConsumable(id, 1)
        get().toast(`${def.name} в сумке`, 'item')
        return true
      },

      grantRelic: (id) => {
        if (get().relics.includes(id)) return
        set((s) => ({ relics: [...s.relics, id] }))
      },

      grant: (ids) => {
        const next = new Set(get().owned)
        ids.forEach((i) => next.add(i))
        set({ owned: [...next] })
      },
      buyLantern: (id) => {
        const def = LANTERNS[id]
        const key = `lantern_${id}`
        if (def.free || get().owned.includes(key)) return true
        if (!get().spendCoins(def.price)) return false
        get().grant([key])
        get().toast(`Новый свет фонаря: ${def.name}`, 'item')
        return true
      },
      setLantern: (id) => {
        const hero = get().hero
        if (!hero) return
        set({ hero: { ...hero, lantern: id } })
      },

      addAiCredits: (n) => set((s) => ({ aiCredits: s.aiCredits + n })),
      useAiCredit: () => {
        if (get().aiCredits <= 0) return false
        set((s) => ({ aiCredits: s.aiCredits - 1 }))
        return true
      },

      setArtifact: (key, value) => set((s) => ({ artifacts: { ...s.artifacts, [key]: value } })),

      startChapter: (id) => {
        const s = get()
        const meta = CHAPTER_META[id]
        if (!meta.free && !s.owned.includes('full_path')) {
          sfx('lock')
          set({ panel: 'paywall', paywallFor: id })
          return
        }
        const st = s.chapters[id]
        if (st.status === 'locked') return
        set({
          currentChapter: id,
          scene: 'chapter',
          panel: null,
          chapters: { ...s.chapters, [id]: { ...st, status: st.status === 'done' ? 'done' : 'active' } },
        })
      },
      leaveChapter: () => set({ scene: 'map', currentChapter: null, panel: null }),

      setChapterStep: (id, step) =>
        set((s) => ({ chapters: { ...s.chapters, [id]: { ...s.chapters[id], step } } })),

      completeChapter: (id) => {
        const s = get()
        const chapters = { ...s.chapters }
        const wasDone = chapters[id].status === 'done'
        chapters[id] = {
          ...chapters[id],
          status: 'done',
          step: 0,
          completedAt: chapters[id].completedAt ?? Date.now(),
          replays: wasDone ? (chapters[id].replays ?? 0) + 1 : chapters[id].replays ?? 0,
        }
        const idx = ROUTE_ORDER.indexOf(id)
        const next = ROUTE_ORDER[idx + 1]
        if (next && chapters[next].status === 'locked') chapters[next] = { ...chapters[next], status: 'available' }
        set({ chapters, mapNode: Math.max(s.mapNode, idx + 1) })
        if (!wasDone) get().log(`Пройдена глава «${CHAPTER_META[id].name}».`)
      },

      setQuestProgress: (id, value) =>
        set((s) => ({ quests: { ...s.quests, [id]: { ...(s.quests[id] ?? { done: false }), progress: Math.max(0, value) } } })),

      completeQuest: (id, note) => {
        const s = get()
        if (s.quests[id]?.done || !s.plan) return
        const def = allQuests(s.plan).find((q) => q.id === id)
        if (!def) return
        const day = today()
        const counters = { ...s.counters, questsDone: s.counters.questsDone + 1 }
        if (counters.lastActiveDay !== day) {
          const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
          counters.streak = counters.lastActiveDay === y ? counters.streak + 1 : 1
          counters.lastActiveDay = day
        }
        set({
          quests: { ...s.quests, [id]: { ...(s.quests[id] ?? {}), done: true, doneAt: Date.now(), note, progress: def.target } },
          counters,
        })
        stinger('quest')
        get().gainXp(def.xp, 'реальный шаг')
        get().addCoins(def.coins)
        get().log(`Сделано в жизни: ${def.title}.`)
      },

      addClient: (c) => {
        const s = get()
        const rec: ClientRecord = { ...c, id: shortId(), season: s.season }
        set({ clients: [...s.clients, rec] })
        stinger('ship')
        get().gainXp(300, 'новый клиент')
        get().addCoins(100)
        get().log(`Новый клиент: ${c.name || 'без имени'}${c.amount ? `, ${c.amount} ₽` : ''}.`)
      },
      removeClient: (id) => set((s) => ({ clients: s.clients.filter((c) => c.id !== id) })),

      allocate: (stat) => {
        const s = get()
        if (s.skillPoints <= 0) return
        sfx('select')
        set({ skillPoints: s.skillPoints - 1, allocated: { ...s.allocated, [stat]: s.allocated[stat] + 1 } })
      },

      adjustReputation: (delta) => set((s) => ({ reputation: Math.max(0, Math.min(100, s.reputation + delta)) })),
      setFlag: (key, value = true) => set((s) => ({ flags: { ...s.flags, [key]: value } })),
      markEventSeen: (id) =>
        set((s) => ({
          seenEvents: s.seenEvents.includes(id) ? s.seenEvents : [...s.seenEvents, id],
          counters: { ...s.counters, eventsSeen: s.counters.eventsSeen + 1 },
        })),
      setPendingEvent: (id) => set({ pendingEvent: id }),
      log: (text) => set((s) => ({ journal: [...s.journal.slice(-199), { t: Date.now(), text }] })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      moveTo: (node) => set({ mapNode: node }),
      recordBattle: (won) =>
        set((s) => ({
          counters: {
            ...s.counters,
            battlesWon: s.counters.battlesWon + (won ? 1 : 0),
            battlesLost: s.counters.battlesLost + (won ? 0 : 1),
          },
        })),

      startNewSeason: (goal) => {
        const s = get()
        const season = s.season + 1
        const plan = buildPlan(goal, season)
        const chapters = freshChapters()
        // во втором сезоне все главы открыты для повторного прохождения
        for (const id of ROUTE_ORDER) chapters[id] = { status: 'available', step: 0 }
        set({ season, goal, plan, chapters, quests: {}, mapNode: 0, scene: 'route', panel: null })
        get().log(`Сезон ${season}: новая клятва — ${goal.clients} клиентов за ${goal.weeks} недель.`)
      },

      exportSave: () => {
        const s = get()
        const data = Object.fromEntries(SAVE_KEYS.map((k) => [k, s[k]]))
        return JSON.stringify({ app: 'psyquest', savedAt: Date.now(), data }, null, 2)
      },
      importSave: (json) => {
        try {
          const parsed = JSON.parse(json) as { app?: string; data?: Partial<SaveData> }
          if (parsed.app !== 'psyquest' || !parsed.data) return false
          const base = freshSave()
          const data = { ...base, ...parsed.data }
          set({ ...data, scene: data.hero && data.plan ? 'map' : 'title', panel: null, currentChapter: null })
          return true
        } catch {
          return false
        }
      },
    }),
    {
      name: `psyquest-save-v1${SLOT}`,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => Object.fromEntries(SAVE_KEYS.map((k) => [k, s[k]])) as unknown as GameState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SaveData>
        return {
          ...current,
          ...p,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
          consumables: { ...current.consumables, ...(p.consumables ?? {}) },
          counters: { ...current.counters, ...(p.counters ?? {}) },
          chapters: { ...current.chapters, ...(p.chapters ?? {}) },
        }
      },
    },
  ),
)

// ---------- Селекторы ----------

export const hasFull = (s: SaveData) => s.owned.includes('full_path')
export const hasPro = (s: SaveData) => s.owned.includes('pro_pack')

export function heroStats(s: SaveData): Stats {
  if (!s.hero) return { confidence: 3, expertise: 3, charisma: 3, resilience: 3 }
  return effectiveStats(s.hero.classId, s.allocated, s.relics)
}

export function lanternOf(s: SaveData) {
  return LANTERNS[s.hero?.lantern ?? 'amber']
}

export function seasonClients(s: SaveData) {
  return s.clients.filter((c) => c.season === s.season)
}

export function textCtx(s: SaveData): TextCtx {
  const a = s.artifacts
  return {
    gender: s.hero?.gender ?? 'f',
      name: s.hero?.name,
      clients: s.goal?.clients,
      weeks: s.goal?.weeks,
      check: s.goal ? new Intl.NumberFormat('ru-RU').format(s.goal.check) : undefined,
      niche: s.goal?.niche || a.positioning?.who,
      hours: lcFirst(a.expertise?.hours),
      education: lcFirst(a.expertise?.education),
      uniqueness: lcFirst(a.expertise?.uniqueness),
      requests: lcFirst(a.expertise?.requests),
      who: a.positioning?.who,
      pain: a.positioning?.pain,
      result: a.positioning?.result,
      method: a.positioning?.method,
      statement: a.positioning?.statement,
      core: a.product?.core.name,
      corePrice: a.product ? new Intl.NumberFormat('ru-RU').format(a.product.core.price) : undefined,
      magnet: a.product?.leadMagnet.name,
      title: titleForLevel(s.level),
      diag: s.plan?.funnel.diagnostics,
      leads: s.plan?.funnel.leads,
  }
}

// Хуки для производных данных: useShallow не даёт React зациклиться на новых массивах и объектах
export const useSeasonClients = () => useGame(useShallow(seasonClients))
export const useHeroStats = () => useGame(useShallow(heroStats))
export const useTextCtx = () => useGame(useShallow(textCtx))
