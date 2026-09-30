// Клиент сервера игры. Без VITE_API_URL всё работает в демо-режиме прямо в браузере.
import catalog from '../../shared/catalog.json'
import type { BotConfig } from '../game/types'

const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const isDemo = !API

export interface Product {
  sku: string
  title: string
  subtitle: string
  price: number
  grants: string[]
  credits: number
  coins: number
  perks: string[]
}

export const PRODUCTS: Product[] = catalog.products
export const product = (sku: string) => PRODUCTS.find((p) => p.sku === sku)

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(API + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(0, 'network')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new ApiError(res.status, body.error ?? `http_${res.status}`)
  }
  return (await res.json()) as T
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) })

// ---------- Покупки ----------

export type CheckoutResult = { mode: 'demo'; localId?: string } | { mode: 'redirect'; url: string; localId: string }

export async function checkout(playerId: string, sku: string, email: string): Promise<CheckoutResult> {
  if (isDemo) return { mode: 'demo' }
  return post<CheckoutResult>('/api/checkout', { playerId, sku, email })
}

export interface Entitlements {
  grants: string[]
  credits: number
  pendingCoins: number
}

export async function fetchEntitlements(playerId: string): Promise<Entitlements | null> {
  if (isDemo) return null
  return call<Entitlements>(`/api/entitlements?playerId=${encodeURIComponent(playerId)}`)
}

export async function claimCoins(playerId: string): Promise<number> {
  if (isDemo) return 0
  const r = await post<{ coins: number }>('/api/coins/claim', { playerId })
  return r.coins
}

export async function paymentStatus(localId: string, playerId: string) {
  return call<{ status: 'pending' | 'succeeded' | 'canceled'; sku?: string }>(
    `/api/payments/${encodeURIComponent(localId)}?playerId=${encodeURIComponent(playerId)}`,
  )
}

export async function restorePurchases(playerId: string, email: string) {
  if (isDemo) return { restored: 0 }
  return post<{ restored: number }>('/api/restore', { playerId, email })
}

// ---------- Сова-наставник ----------

export type MentorTask = 'positioning' | 'offer' | 'hooks' | 'reel' | 'bot' | 'objection' | 'sales' | 'free'

export interface MentorReply {
  feedback: string
  improved: string
  score: number
  creditsLeft?: number
  demo?: boolean
}

export async function askMentor(req: {
  playerId: string
  task: MentorTask
  context: Record<string, string | number | undefined>
  draft: string
}): Promise<MentorReply> {
  if (isDemo) return demoMentor(req.task, req.draft, req.context)
  return post<MentorReply>('/api/mentor', req)
}

const VAGUE = ['всем', 'всех', 'любым', 'любой', 'разными', 'разные', 'гармони', 'счасть', 'лучшей версией', 'жизнь мечты']
const PROMISES = ['гарантир', '100%', 'навсегда', 'за одну сессию', 'за 1 сессию', 'избавлю']

function demoMentor(task: MentorTask, draft: string, context: Record<string, string | number | undefined>): MentorReply {
  const text = draft.trim()
  const low = text.toLowerCase()
  const notes: string[] = []
  let score = 55
  if (text.length < 40) {
    notes.push('Текст слишком короткий — человеку не за что зацепиться. Добавь, кому это и какой результат.')
    score -= 15
  } else if (text.length > 600) {
    notes.push('Длинно. Попробуй сказать главное в первых двух предложениях — остальное можно оставить на потом.')
    score -= 5
  } else score += 10
  const vague = VAGUE.filter((w) => low.includes(w))
  if (vague.length) {
    notes.push(`Размытые слова: ${vague.map((v) => `«${v}…»`).join(', ')}. Их слышат все — и никто не узнаёт себя.`)
    score -= 10 * vague.length
  } else score += 10
  const promise = PROMISES.filter((w) => low.includes(w))
  if (promise.length) {
    notes.push('Есть обещания результата. Психолог не может гарантировать итог — лучше опиши процесс и типичные изменения.')
    score -= 20
  } else score += 5
  if (/\d/.test(text)) {
    notes.push('Хорошо, что есть конкретика в цифрах — это вызывает доверие.')
    score += 8
  }
  if (task === 'hooks' || task === 'reel') {
    if (!/[?!]/.test(text)) notes.push('Хуку не хватает напряжения: вопрос или неожиданное утверждение цепляют сильнее.')
    else score += 6
  }
  if (task === 'offer' || task === 'bot') {
    if (!/(запис|напиш|оставь|переход|жми|нажми)/.test(low)) notes.push('Не хватает понятного следующего шага: что человеку сделать прямо сейчас?')
    else score += 6
  }
  if (!notes.length) notes.push('Звучит ясно и по-человечески. Проверь только, узнает ли себя в этом тексте твой клиент.')
  const who = context.who ? String(context.who) : 'люди, которым сейчас непросто'
  const improved =
    task === 'positioning'
      ? `Мои клиенты — ${who}. ${context.pain ? `Приходят, когда ${context.pain}.` : 'Приходят, когда стало тяжело справляться самим.'} Помогаю ${context.result ?? 'вернуть опору и понять, куда двигаться'}. Работаю ${context.method ? `в подходе «${context.method}»` : 'в своём подходе'}, бережно и по шагам.`
      : text.replace(/\s+/g, ' ').replace(/(гарантирую|100%|навсегда)/gi, '').trim()
  return {
    feedback: notes.join('\n\n'),
    improved,
    score: Math.max(5, Math.min(98, score)),
    demo: true,
  }
}

// ---------- Боты ----------

export interface DeployResult {
  botId: string
  username: string
  adminCode: string
}

export async function deployBot(playerId: string, token: string, config: BotConfig): Promise<DeployResult> {
  return post<DeployResult>('/api/bots', { playerId, token, config: stripDeployed(config) })
}

export async function updateBot(playerId: string, botId: string, config: BotConfig) {
  return call<{ ok: boolean }>(`/api/bots/${encodeURIComponent(botId)}`, {
    method: 'PUT',
    body: JSON.stringify({ playerId, config: stripDeployed(config) }),
  })
}

export interface LeadsReply {
  leads: { id: string; name: string; username?: string; answers: string[]; stage: string; consent: boolean; crisis?: boolean; createdAt: number | string }[]
  stats: { started: number; consented: number; gotMagnet: number; finishedQuiz: number; clickedBooking: number }
}

export async function fetchLeads(playerId: string, botId: string) {
  return call<LeadsReply>(`/api/bots/${encodeURIComponent(botId)}/leads?playerId=${encodeURIComponent(playerId)}`)
}

function stripDeployed(cfg: BotConfig): BotConfig {
  const { deployed: _deployed, ...rest } = cfg
  void _deployed
  return rest
}

export const serverInfo = () => (isDemo ? null : API)

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'network':
        return 'Сервер игры недоступен. Проверь интернет и попробуй ещё раз.'
      case 'no_credits':
        return 'Разборы Совы закончились. Пополнить можно в Лавке.'
      case 'ai_disabled':
        return 'AI-наставник на сервере пока не подключён.'
      case 'bots_disabled':
        return 'Запуск ботов на сервере пока не настроен.'
      case 'invalid_token':
        return 'Telegram не принял токен. Скопируй его из @BotFather целиком.'
      case 'token_in_use':
        return 'Этот бот уже подключён к другому профилю игры.'
      case 'bot_limit':
        return 'Можно подключить до трёх ботов. Удали лишнего, чтобы добавить нового.'
      case 'telegram_unavailable':
      case 'webhook_failed':
        return 'Telegram сейчас не отвечает. Попробуй через пару минут.'
      case 'email_required':
        return 'Укажи email — на него придёт чек.'
      case 'payment_unavailable':
        return 'Оплата временно недоступна. Попробуй чуть позже.'
      case 'ai_refused':
        return 'Сова не смогла разобрать этот текст. Попробуй переформулировать.'
      case 'ai_busy':
      case 'ai_timeout':
      case 'ai_error':
      case 'busy':
        return 'Сова сейчас занята. Попробуй ещё раз через минуту — разбор не списан.'
      case 'origin_not_allowed':
        return 'Сервер не принимает запросы с этого адреса. Добавь его в ALLOWED_ORIGINS.'
      default:
        if (e.status === 429) return 'Слишком часто. Подожди минуту и попробуй снова.'
        return `Что-то пошло не так (${e.code}). Попробуй ещё раз.`
    }
  }
  return 'Что-то пошло не так. Попробуй ещё раз.'
}
