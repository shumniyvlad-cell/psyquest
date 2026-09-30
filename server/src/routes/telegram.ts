// Вебхук Telegram для ботов игроков (мультитенантный раннер) и фоновый followUp.
import { setTimeout as sleep } from 'node:timers/promises'
import { Hono } from 'hono'
import { z } from 'zod'
import { buildFollowUp, FOLLOW_UP_DELAY, followUpDue, handleUpdate, type Action } from '../bot/funnel.ts'
import {
  botSecret,
  botToken,
  deleteLead,
  followUpCandidates,
  getBot,
  loadLead,
  markBlocked,
  markFollowUp,
  saveLead,
  setOwner,
  type BotRow,
} from '../bot/store.ts'
import { features } from '../env.ts'
import { safeEqual } from '../lib/crypto.ts'
import { describe } from '../lib/http.ts'
import { RateLimiter } from '../lib/ratelimit.ts'
import * as tg from '../lib/telegram.ts'
import type { TgUpdate } from '../types.ts'

export const telegramRoutes = new Hono()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Только поля, которые нужны воронке; остальное отбрасывается
const User = z.object({
  id: z.number(),
  is_bot: z.boolean().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
})
const Message = z.object({
  message_id: z.number(),
  chat: z.object({ id: z.number(), type: z.string() }),
  from: User.optional(),
  text: z.string().optional(),
})
const UpdateSchema = z.object({
  update_id: z.number(),
  message: Message.optional(),
  callback_query: z
    .object({ id: z.string(), from: User, message: Message.optional(), data: z.string().optional() })
    .optional(),
})

// Защита /admin от перебора кода: 5 ошибок в час на чат и 20 на бота
const adminFailsByChat = new RateLimiter(5, 60 * 60_000)
const adminFailsByBot = new RateLimiter(20, 60 * 60_000)

// Telegram может повторить апдейт — помним последние update_id
const seen = new Set<string>()
function firstSeen(key: string): boolean {
  if (seen.has(key)) return false
  seen.add(key)
  if (seen.size > 20_000) {
    const oldest = seen.values().next().value
    if (oldest !== undefined) seen.delete(oldest)
  }
  return true
}

// Апдейты одного чата обрабатываем строго по очереди (иначе гонки состояния воронки)
const chains = new Map<string, Promise<void>>()
function enqueue(key: string, job: () => Promise<void>) {
  const prev = chains.get(key) ?? Promise.resolve()
  const next: Promise<void> = prev
    .then(job)
    .catch((e) => console.error('[tg] обработка апдейта упала:', describe(e)))
    .finally(() => {
      if (chains.get(key) === next) chains.delete(key)
    })
  chains.set(key, next)
}

telegramRoutes.post('/tg/:botId', async (c) => {
  if (!features.bots) return c.json({ error: 'bots_disabled' }, 503)
  // Дальше — всегда 200: иначе Telegram будет повторять апдейт
  const ok = () => c.json({ ok: true })
  const botId = c.req.param('botId').toLowerCase()
  const bot = UUID_RE.test(botId) ? getBot(botId) : null
  if (!bot) return ok()

  let secret: string
  try {
    secret = botSecret(bot)
  } catch {
    console.error(`[tg] не расшифровать секрет вебхука (bot ${botId}) — проверьте BOT_TOKEN_KEY`)
    return ok()
  }
  if (!safeEqual(c.req.header('x-telegram-bot-api-secret-token') ?? '', secret)) {
    console.warn(`[tg] неверный secret token (bot ${botId})`)
    return ok()
  }

  const parsed = UpdateSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return ok()
  const update: TgUpdate = parsed.data
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id
  if (chatId === undefined || !firstSeen(`${botId}:${update.update_id}`)) return ok()

  enqueue(`${botId}:${chatId}`, () => processUpdate(botId, chatId, update))
  return ok()
})

async function processUpdate(botId: string, chatId: number, update: TgUpdate) {
  const bot = getBot(botId) // свежая запись: сценарий и владелец могли поменяться
  if (!bot) return
  const chatKey = `${botId}:${chatId}`
  const result = handleUpdate(update, loadLead(botId, chatId), {
    config: bot.config,
    adminCode: bot.adminCode,
    ownerChatId: bot.ownerChatId,
    adminAllowed: !adminFailsByChat.blocked(chatKey) && !adminFailsByBot.blocked(botId),
    now: Date.now(),
  })
  if (result.adminFailed) {
    adminFailsByChat.hit(chatKey)
    adminFailsByBot.hit(botId)
  }
  if (result.owner !== undefined) setOwner(botId, result.owner)
  if (result.forget) deleteLead(botId, chatId)
  else if (result.lead) saveLead(botId, chatId, result.lead)
  if (result.actions.length) await runActions(bot, botToken(bot), result.actions)
}

type SendAction = Extract<Action, { type: 'send' }>

function perform(token: string, a: Action) {
  if (a.type === 'send') return tg.sendMessage(token, a.chatId, a.text, a.buttons)
  if (a.type === 'edit') return tg.editMessageText(token, a.chatId, a.messageId, a.text)
  return tg.answerCallbackQuery(token, a.callbackId, a.text)
}

/** Кнопки-ссылки убираем, а сами ссылки дописываем в текст. */
function linksAsText(a: SendAction): SendAction {
  const links = (a.buttons ?? []).flat().flatMap((b) => ('url' in b ? [`${b.text}: ${b.url}`] : []))
  const rows = (a.buttons ?? []).map((row) => row.filter((b) => !('url' in b))).filter((row) => row.length > 0)
  return { ...a, text: [a.text, '', ...links].join('\n'), buttons: rows }
}

async function runActions(bot: BotRow, token: string, actions: Action[]) {
  for (const original of actions) {
    let a = original
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await perform(token, a)
        break
      } catch (e) {
        const err = e instanceof tg.TelegramError ? e : null
        // 429 — подождать, сколько просит Telegram (если недолго), и повторить
        if (err?.code === 429 && (err.retryAfter ?? 99) <= 5 && attempt < 2) {
          await sleep((err.retryAfter ?? 1) * 1000)
          continue
        }
        // Telegram не принял ссылку в кнопке — отправляем ссылки текстом, чтобы сообщение всё равно дошло
        if (err?.code === 400 && a.type === 'send' && a.buttons?.flat().some((b) => 'url' in b)) {
          a = linksAsText(a)
          continue
        }
        if (err?.code === 403 && a.type === 'send') markBlocked(bot.id, a.chatId)
        console.warn(`[tg] ${a.type} не выполнено (bot ${bot.id}):`, describe(e))
        break
      }
    }
  }
}

// ---------- followUp: раз в 10 минут; одно напоминание через сутки после «Пока подумаю» ----------

let followUpRunning = false

export async function runFollowUps(now = Date.now()) {
  if (followUpRunning) return
  followUpRunning = true
  try {
    const bots = new Map<string, { bot: BotRow; token: string } | null>()
    for (const cand of followUpCandidates(now, FOLLOW_UP_DELAY)) {
      if (!followUpDue(cand.lead, now)) continue
      if (!bots.has(cand.botId)) {
        const bot = getBot(cand.botId)
        bots.set(cand.botId, bot ? { bot, token: botToken(bot) } : null)
      }
      const entry = bots.get(cand.botId)
      if (!entry) continue
      markFollowUp(cand.id, now) // помечаем до отправки: не больше одного сообщения даже при сбое
      const action = buildFollowUp(entry.bot.config, cand.chatId)
      if (!action) continue
      await runActions(entry.bot, entry.token, [action])
      await sleep(50) // не упираемся в лимиты Telegram
    }
  } finally {
    followUpRunning = false
  }
}

export function startFollowUps() {
  if (!features.bots) return
  setInterval(() => {
    runFollowUps().catch((e) => console.error('[followup]', describe(e)))
  }, 10 * 60_000).unref()
}
