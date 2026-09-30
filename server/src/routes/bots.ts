// Боты игроков: деплой (getMe + setWebhook), обновление сценария, удаление, лиды и статистика.
import { randomUUID } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { z } from 'zod'
import {
  botSecret,
  botToken,
  countBots,
  deleteBot,
  getBot,
  getBotByTokenHash,
  insertBot,
  leadStats,
  listLeads,
  updateBot,
} from '../bot/store.ts'
import { env, features } from '../env.ts'
import { randomDigits, randomSecret, sha256hex } from '../lib/crypto.ts'
import { check, describe, readJson, Uuid } from '../lib/http.ts'
import { RateLimiter, tooMany } from '../lib/ratelimit.ts'
import * as tg from '../lib/telegram.ts'
import type { BotConfig } from '../types.ts'

export const botsRoutes = new Hono()

const MAX_BOTS = 3
const deployLimiter = new RateLimiter(10, 60 * 60_000)

// Сценарий в том же виде, что хранит игра: тексты как есть (обрезку и проверку ссылок делает воронка, как превью).
// Лимиты — под сообщения Telegram (4096); ошибки сценария ловит валидатор игры до деплоя.
const Text = (max: number) => z.string().max(max).default('')

const QuizQuestion = z.object({
  id: z.string().max(100).default(''),
  text: Text(4000),
  // хотя бы один вариант, иначе лиду нечем ответить
  options: z.array(z.string().max(200)).min(1).max(12),
})

// Неизвестные поля (в т.ч. deployed) отбрасываются
const BotConfigSchema = z.object({
  botName: Text(200),
  welcome: Text(4000),
  consent: z.boolean().default(true),
  consentText: Text(4000),
  leadMagnetTitle: Text(1000),
  leadMagnetUrl: Text(2048),
  quiz: z.array(QuizQuestion).max(20).default([]),
  offerText: Text(4000),
  offerPrice: z.number().min(0).max(1_000_000_000).default(0),
  bookingText: Text(200),
  bookingUrl: Text(2048),
  followUp: Text(4000),
  crisisText: Text(4000),
}) satisfies z.ZodType<BotConfig>

const Token = z
  .string()
  .trim()
  .regex(/^\d{3,20}:[A-Za-z0-9_-]{20,80}$/, 'неверный формат токена')

const CreateBody = z.object({ playerId: Uuid, token: Token, config: BotConfigSchema })
const UpdateBody = z.object({ playerId: Uuid, config: BotConfigSchema })
const OwnerBody = z.object({ playerId: Uuid })
const BotParam = z.object({ botId: Uuid })
const LeadsQuery = z.object({ botId: Uuid, playerId: Uuid })

const disabled = (c: Context) => c.json({ error: 'bots_disabled' }, 503)

// Деплой и удаление — по одному за раз: так не будет гонок за токен и лимит в 3 бота
let queue: Promise<unknown> = Promise.resolve()
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.catch(() => undefined)
  return run
}

botsRoutes.post('/bots', async (c) => {
  if (!features.bots) return disabled(c)
  const p = await readJson(c, CreateBody)
  if (!p.ok) return p.res
  const { playerId, token, config } = p.data
  const rl = deployLimiter.hit(playerId)
  if (!rl.ok) return tooMany(c, rl.retryAfter)
  return serialized(() => deploy(c, playerId, token, config))
})

async function deploy(c: Context, playerId: string, token: string, config: BotConfig) {
  let me: tg.BotInfo
  try {
    me = await tg.getMe(token)
  } catch (e) {
    if (e instanceof tg.TelegramError && (e.code === 401 || e.code === 404)) {
      return c.json({ error: 'invalid_token' }, 400)
    }
    console.warn('[bots] getMe failed:', describe(e))
    return c.json({ error: 'telegram_unavailable' }, 502)
  }
  if (!me.is_bot || !me.username) return c.json({ error: 'invalid_token' }, 400)

  const tokenHash = sha256hex(token)
  const existing = getBotByTokenHash(tokenHash)
  // тот же токен у другого игрока — отказ; у этого же — обновление
  if (existing && existing.playerId !== playerId) return c.json({ error: 'token_in_use' }, 409)
  if (!existing && countBots(playerId) >= MAX_BOTS) return c.json({ error: 'bot_limit', max: MAX_BOTS }, 403)

  const botId = existing?.id ?? randomUUID()
  const secret = existing ? botSecret(existing) : randomSecret(32)
  const adminCode = existing?.adminCode ?? randomDigits(6)
  try {
    await tg.setWebhook(token, {
      url: `${env.publicApiUrl}/api/tg/${botId}`,
      secret,
      // новый бот — старые апдейты не нужны; при обновлении не теряем то, что ещё не доставлено
      dropPending: !existing,
    })
  } catch (e) {
    console.warn('[bots] setWebhook failed:', describe(e))
    return c.json({ error: 'webhook_failed' }, 502)
  }

  if (existing) updateBot(botId, { config, username: me.username })
  else insertBot({ id: botId, playerId, token, tokenHash, secret, username: me.username, adminCode, config })
  console.log(`[bots] ${existing ? 'обновлён' : 'создан'} бот ${botId} (@${me.username})`)
  return c.json({ botId, username: me.username, adminCode })
}

botsRoutes.put('/bots/:botId', async (c) => {
  if (!features.bots) return disabled(c)
  const id = check(c, BotParam, c.req.param())
  if (!id.ok) return id.res
  const p = await readJson(c, UpdateBody)
  if (!p.ok) return p.res
  const bot = getBot(id.data.botId)
  if (!bot || bot.playerId !== p.data.playerId) return c.json({ error: 'not_found' }, 404)
  updateBot(bot.id, { config: p.data.config })
  return c.json({ ok: true, botId: bot.id, username: bot.username, adminCode: bot.adminCode })
})

botsRoutes.delete('/bots/:botId', async (c) => {
  if (!features.bots) return disabled(c)
  const id = check(c, BotParam, c.req.param())
  if (!id.ok) return id.res
  // playerId — в JSON-теле; если клиент не умеет тело у DELETE — в query
  const raw: unknown = await c.req.json().catch(() => ({ playerId: c.req.query('playerId') }))
  const p = check(c, OwnerBody, raw)
  if (!p.ok) return p.res
  const bot = getBot(id.data.botId)
  if (!bot || bot.playerId !== p.data.playerId) return c.json({ error: 'not_found' }, 404)
  return serialized(async () => {
    try {
      await tg.deleteWebhook(botToken(bot))
    } catch (e) {
      // токен могли отозвать в BotFather — всё равно удаляем у себя
      console.warn('[bots] deleteWebhook failed:', describe(e))
    }
    deleteBot(bot.id)
    console.log(`[bots] удалён бот ${bot.id}`)
    return c.json({ ok: true })
  })
})

botsRoutes.get('/bots/:botId/leads', (c) => {
  if (!features.bots) return disabled(c)
  const q = check(c, LeadsQuery, { botId: c.req.param('botId'), playerId: c.req.query('playerId') })
  if (!q.ok) return q.res
  const bot = getBot(q.data.botId)
  if (!bot || bot.playerId !== q.data.playerId) return c.json({ error: 'not_found' }, 404)
  return c.json({ leads: listLeads(bot.id), stats: leadStats(bot.id) })
})
