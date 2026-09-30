// Точка входа: Hono на @hono/node-server. Запуск: node src/index.ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { catalog } from './catalog.ts'
import { db, DB_PATH } from './db.ts'
import { env, features } from './env.ts'
import { clientIp, RateLimiter, tooMany } from './lib/ratelimit.ts'
import { botsRoutes } from './routes/bots.ts'
import { mentorRoutes } from './routes/mentor.ts'
import { paymentsRoutes, startPaymentReconciler } from './routes/payments.ts'
import { startFollowUps, telegramRoutes } from './routes/telegram.ts'

const app = new Hono()

// Вебхуки Telegram и ЮKassa: без CORS и без лимита по IP
const isHook = (path: string) => path.startsWith('/api/tg/') || path.startsWith('/api/webhooks/')

// Лог запросов — без query-строки (там playerId)
app.use('*', async (c, next) => {
  const t0 = performance.now()
  await next()
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${Math.round(performance.now() - t0)}ms`)
})

app.use('*', bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: 'payload_too_large' }, 413) }))

const corsMw = cors({
  origin: (origin) => (env.allowedOrigins.has(origin) ? origin : null),
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 600,
})

app.use('/api/*', async (c, next) => {
  if (isHook(c.req.path)) return next()
  // Браузерный запрос с чужого origin отклоняем сразу (запросы без Origin — curl, серверы — пропускаем)
  const origin = c.req.header('origin')
  if (origin && !env.allowedOrigins.has(origin)) return c.json({ error: 'origin_not_allowed' }, 403)
  return corsMw(c, next)
})

const perIp = new RateLimiter(300, 60_000)
app.use('/api/*', async (c, next) => {
  if (isHook(c.req.path)) return next()
  const rl = perIp.hit(clientIp(c))
  if (!rl.ok) return tooMany(c, rl.retryAfter)
  return next()
})

app.get('/api/health', (c) =>
  c.json({ ok: true, demoPayments: env.demoPayments, ai: features.ai, bots: features.bots }),
)

app.route('/api', paymentsRoutes)
app.route('/api', mentorRoutes)
app.route('/api', botsRoutes)
app.route('/api', telegramRoutes)

app.notFound((c) => c.json({ error: 'not_found' }, 404))
app.onError((err, c) => {
  console.error(`[http] ${c.req.method} ${c.req.path}:`, err instanceof Error ? err.message : String(err))
  return c.json({ error: 'internal' }, 500)
})

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`PsyQuest server слушает порт ${info.port}`)
  console.log(
    `  платежи: ${env.demoPayments ? 'ДЕМО (покупки выдаются без оплаты)' : 'ЮKassa'}` +
      ` | наставник: ${features.ai ? env.mentorModel : 'выключен'}` +
      ` | боты: ${features.bots ? 'включены' : 'выключены'}`,
  )
  console.log(`  каталог: ${catalog.bySku.size} товаров | БД: ${DB_PATH}`)
  if (features.bots && !env.publicApiUrl?.startsWith('https://')) {
    console.warn('  внимание: Telegram принимает вебхуки только по https — проверьте PUBLIC_API_URL')
  }
})

startPaymentReconciler()
startFollowUps()

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 5_000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
