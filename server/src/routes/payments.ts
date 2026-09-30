// Платежи (ЮKassa или демо), выдача покупок, монеты, восстановление покупок по email.
import { randomUUID } from 'node:crypto'
import type { SQLOutputValue } from 'node:sqlite'
import { setTimeout as sleep } from 'node:timers/promises'
import { Hono } from 'hono'
import { z } from 'zod'
import { catalog, getProduct } from '../catalog.ts'
import { db, num, text, textOrNull, tx } from '../db.ts'
import { env } from '../env.ts'
import { check, describe, Email, readJson, Uuid } from '../lib/http.ts'
import { clientIp, RateLimiter, tooMany } from '../lib/ratelimit.ts'
import * as yk from '../lib/yookassa.ts'

export const paymentsRoutes = new Hono()

const MINUTE = 60_000
const HOUR = 60 * MINUTE
/** Не чаще раза в 3 секунды сверяемся с ЮKassa по одному платежу */
const CHECK_INTERVAL = 3_000

const checkoutByPlayer = new RateLimiter(20, HOUR)
const checkoutByIp = new RateLimiter(60, HOUR)
const restoreByIp = new RateLimiter(5, HOUR)

type Status = 'pending' | 'succeeded' | 'canceled'

interface PaymentRow {
  localId: string
  playerId: string
  sku: string
  amount: number // копейки
  currency: string
  provider: 'yookassa' | 'demo'
  providerId: string | null
  status: Status
  checkedAt: number
}

function toPayment(r: Record<string, SQLOutputValue>): PaymentRow {
  return {
    localId: text(r.local_id),
    playerId: text(r.player_id),
    sku: text(r.sku),
    amount: num(r.amount),
    currency: text(r.currency),
    provider: text(r.provider) === 'yookassa' ? 'yookassa' : 'demo',
    providerId: textOrNull(r.provider_id),
    status: text(r.status) as Status,
    checkedAt: num(r.checked_at),
  }
}

function getPayment(localId: string): PaymentRow | null {
  const r = db.prepare('SELECT * FROM payments WHERE local_id = ?').get(localId)
  return r ? toPayment(r) : null
}

// ---------- права игрока (всё считается из успешных платежей) ----------

export function entitlements(playerId: string) {
  const rows = db
    .prepare(`SELECT grants, credits_left, coins_pending FROM payments WHERE player_id = ? AND status = 'succeeded'`)
    .all(playerId)
  const grants = new Set<string>()
  let credits = 0
  let pendingCoins = 0
  for (const r of rows) {
    for (const g of JSON.parse(text(r.grants)) as string[]) grants.add(g)
    credits += num(r.credits_left)
    pendingCoins += num(r.coins_pending)
  }
  return { grants: [...grants].sort(), credits, pendingCoins }
}

export function creditsOf(playerId: string): number {
  const r = db
    .prepare(`SELECT COALESCE(SUM(credits_left), 0) AS n FROM payments WHERE player_id = ? AND status = 'succeeded'`)
    .get(playerId)
  return num(r?.n)
}

/** Списать один разбор Совы. Возвращает остаток или null, если списывать нечего. */
export function spendCredit(playerId: string): number | null {
  return tx(() => {
    const r = db
      .prepare(
        `SELECT local_id FROM payments WHERE player_id = ? AND status = 'succeeded' AND credits_left > 0
         ORDER BY paid_at, created_at LIMIT 1`,
      )
      .get(playerId)
    if (!r) return null
    db.prepare('UPDATE payments SET credits_left = credits_left - 1 WHERE local_id = ? AND credits_left > 0').run(
      text(r.local_id),
    )
    return creditsOf(playerId)
  })
}

paymentsRoutes.get('/entitlements', (c) => {
  const q = check(c, z.object({ playerId: Uuid }), c.req.query())
  if (!q.ok) return q.res
  return c.json(entitlements(q.data.playerId))
})

// Монеты из покупок забираются в игру один раз
paymentsRoutes.post('/coins/claim', async (c) => {
  const p = await readJson(c, z.object({ playerId: Uuid }))
  if (!p.ok) return p.res
  const coins = tx(() => {
    const r = db
      .prepare(
        `SELECT COALESCE(SUM(coins_pending), 0) AS n FROM payments
         WHERE player_id = ? AND status = 'succeeded' AND coins_pending > 0`,
      )
      .get(p.data.playerId)
    db.prepare(
      `UPDATE payments SET coins_pending = 0 WHERE player_id = ? AND status = 'succeeded' AND coins_pending > 0`,
    ).run(p.data.playerId)
    return num(r?.n)
  })
  return c.json({ coins })
})

// ---------- оформление покупки ----------

const CheckoutBody = z.object({
  playerId: Uuid,
  sku: z.string().refine((s) => catalog.bySku.has(s), 'неизвестный sku'),
  email: z.preprocess((v) => (v === '' || v === null ? undefined : v), Email.optional()),
})

function insertPayment(p: {
  localId: string
  playerId: string
  sku: string
  email: string | undefined
  provider: 'yookassa' | 'demo'
  status: Status
}) {
  const product = getProduct(p.sku)!
  const now = Date.now()
  // Снимок каталога: цена, гранты, разборы и монеты фиксируются на момент покупки
  db.prepare(
    `INSERT INTO payments (local_id, player_id, sku, email, amount, currency, provider, status, grants, credits_left,
                           coins_pending, created_at, paid_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    p.localId,
    p.playerId,
    p.sku,
    p.email ?? null,
    product.price * 100,
    catalog.currency,
    p.provider,
    p.status,
    JSON.stringify(product.grants),
    product.credits,
    product.coins,
    now,
    p.status === 'succeeded' ? now : null,
  )
}

paymentsRoutes.post('/checkout', async (c) => {
  const p = await readJson(c, CheckoutBody)
  if (!p.ok) return p.res
  const { playerId, sku, email } = p.data
  const product = getProduct(sku)!
  const byPlayer = checkoutByPlayer.hit(playerId)
  const byIp = checkoutByIp.hit(clientIp(c))
  if (!byPlayer.ok || !byIp.ok) return tooMany(c, Math.max(byPlayer.retryAfter, byIp.retryAfter))
  const localId = randomUUID()

  // Демо: покупка выдаётся сразу, без денег
  if (!env.yookassa) {
    insertPayment({ localId, playerId, sku, email, provider: 'demo', status: 'succeeded' })
    return c.json({ mode: 'demo', localId })
  }

  const cfg = env.yookassa
  if (!email) return c.json({ error: 'email_required' }, 400)
  insertPayment({ localId, playerId, sku, email, provider: 'yookassa', status: 'pending' })

  const returnUrl = new URL(env.publicGameUrl!)
  returnUrl.searchParams.set('payment', 'return')
  returnUrl.searchParams.set('pid', localId)
  try {
    const payment = await yk.createPayment(cfg, {
      localId,
      amountValue: yk.rubToValue(product.price),
      description: `PsyQuest: ${product.title}`,
      returnUrl: returnUrl.href,
      metadata: { playerId, sku, localId },
      receipt: cfg.receipts ? { email, itemDescription: product.title } : undefined,
    })
    db.prepare('UPDATE payments SET provider_id = ?, checked_at = ? WHERE local_id = ?').run(
      payment.id,
      Date.now(),
      localId,
    )
    const url = payment.confirmation?.confirmation_url
    if (!url) throw new Error('в ответе нет confirmation_url')
    return c.json({ mode: 'redirect', url, localId })
  } catch (e) {
    db.prepare(`UPDATE payments SET status = 'canceled' WHERE local_id = ? AND status = 'pending'`).run(localId)
    console.error(`[payments] ${localId}: не удалось создать платёж:`, describe(e))
    return c.json({ error: 'payment_unavailable' }, 502)
  }
})

// ---------- сверка с ЮKassa ----------

const syncing = new Map<string, Promise<void>>()

/** Сверить платёж с ЮKassa и выдать покупку, если он действительно оплачен. Параллельные вызовы склеиваются. */
function syncPayment(localId: string): Promise<void> {
  const running = syncing.get(localId)
  if (running) return running
  const job = (async () => {
    const cfg = env.yookassa
    const row = getPayment(localId)
    if (!cfg || !row || row.provider !== 'yookassa' || !row.providerId || row.status === 'succeeded') return
    db.prepare('UPDATE payments SET checked_at = ? WHERE local_id = ?').run(Date.now(), localId)
    applyRemote(row, await yk.getPayment(cfg, row.providerId))
  })().finally(() => syncing.delete(localId))
  syncing.set(localId, job)
  return job
}

function applyRemote(row: PaymentRow, remote: yk.YooKassaPayment) {
  if (remote.id !== row.providerId) {
    console.error(`[payments] ${row.localId}: ЮKassa вернула другой id платежа`)
    return
  }
  if (remote.status === 'succeeded') {
    // sku и сумма — из нашей БД (цена каталога на момент создания), не из metadata
    const paid = yk.valueToKopecks(remote.amount.value)
    if (remote.paid !== true || paid !== row.amount || remote.amount.currency !== row.currency) {
      db.prepare(`UPDATE payments SET status = 'canceled' WHERE local_id = ? AND status != 'succeeded'`).run(row.localId)
      console.error(
        `[payments] ${row.localId}: сумма/валюта не совпали с каталогом (${remote.amount.value} ${remote.amount.currency}) — покупка НЕ выдана, нужна ручная проверка`,
      )
      return
    }
    const r = db
      .prepare(`UPDATE payments SET status = 'succeeded', paid_at = ? WHERE local_id = ? AND status != 'succeeded'`)
      .run(Date.now(), row.localId)
    if (num(r.changes) > 0) console.log(`[payments] ${row.localId}: оплачен ${row.sku}, покупка выдана`)
  } else if (remote.status === 'canceled') {
    db.prepare(`UPDATE payments SET status = 'canceled' WHERE local_id = ? AND status = 'pending'`).run(row.localId)
  }
}

// Клиент опрашивает статус после возврата с оплаты
const PaymentQuery = z.object({ localId: Uuid, playerId: Uuid })

paymentsRoutes.get('/payments/:localId', async (c) => {
  const q = check(c, PaymentQuery, { localId: c.req.param('localId'), playerId: c.req.query('playerId') })
  if (!q.ok) return q.res
  const { localId, playerId } = q.data
  let row = getPayment(localId)
  if (!row || row.playerId !== playerId) return c.json({ error: 'not_found' }, 404)
  if (row.status === 'pending' && row.provider === 'yookassa' && row.providerId && Date.now() - row.checkedAt >= CHECK_INTERVAL) {
    // ждём сверку не дольше 8 с, дальше она доработает в фоне
    await Promise.race([
      syncPayment(localId).catch((e) => console.warn(`[payments] ${localId}: сверка не удалась:`, describe(e))),
      sleep(8_000),
    ])
    row = getPayment(localId) ?? row
  }
  return c.json({ status: row.status, sku: row.sku })
})

// Уведомления ЮKassa не подписаны: берём только id и сами спрашиваем статус у ЮKassa
const Notification = z.object({ object: z.object({ id: z.string().regex(/^[\w-]{8,64}$/) }) })
const scheduled = new Set<string>()

paymentsRoutes.post('/webhooks/yookassa', async (c) => {
  const n = Notification.safeParse(await c.req.json().catch(() => null))
  if (n.success && env.yookassa) {
    const r = db.prepare('SELECT * FROM payments WHERE provider_id = ?').get(n.data.object.id)
    const row = r ? toPayment(r) : null
    // неизвестные id игнорируем — не ходим в ЮKassa по чужим запросам
    if (row && row.status !== 'succeeded' && !scheduled.has(row.localId)) {
      scheduled.add(row.localId)
      const wait = Math.max(0, row.checkedAt + CHECK_INTERVAL - Date.now())
      setTimeout(() => {
        scheduled.delete(row.localId)
        syncPayment(row.localId).catch((e) => console.warn(`[payments] ${row.localId}: сверка по вебхуку:`, describe(e)))
      }, wait)
    }
  }
  return c.json({ ok: true }) // отвечаем сразу, сверка идёт в фоне
})

/** Страховка: раз в 5 минут досверяем «зависшие» pending-платежи за последние 48 часов. */
export function startPaymentReconciler() {
  if (!env.yookassa) return
  let busy = false
  setInterval(async () => {
    if (busy) return
    busy = true
    try {
      const now = Date.now()
      const rows = db
        .prepare(
          `SELECT local_id FROM payments
           WHERE status = 'pending' AND provider = 'yookassa' AND provider_id IS NOT NULL
             AND created_at > ? AND checked_at < ?
           ORDER BY created_at LIMIT 50`,
        )
        .all(now - 48 * HOUR, now - 5 * MINUTE)
      for (const r of rows) {
        await syncPayment(text(r.local_id)).catch((e) => console.warn('[payments] досверка:', describe(e)))
      }
    } finally {
      busy = false
    }
  }, 5 * MINUTE).unref()
}

// ---------- восстановление покупок ----------

const RestoreBody = z.object({ playerId: Uuid, email: Email })

// Перепривязывает успешные покупки с этим email к playerId. Кредиты и монеты живут в строках платежей — не дублируются.
paymentsRoutes.post('/restore', async (c) => {
  const rl = restoreByIp.hit(clientIp(c))
  if (!rl.ok) return tooMany(c, rl.retryAfter)
  const p = await readJson(c, RestoreBody)
  if (!p.ok) return p.res
  const { playerId, email } = p.data
  const { moved, restored } = tx(() => {
    const u = db
      .prepare(`UPDATE payments SET player_id = ? WHERE email = ? AND status = 'succeeded' AND player_id != ?`)
      .run(playerId, email, playerId)
    const r = db
      .prepare(`SELECT COUNT(*) AS n FROM payments WHERE email = ? AND status = 'succeeded' AND player_id = ?`)
      .get(email, playerId)
    return { moved: num(u.changes), restored: num(r?.n) }
  })
  if (moved > 0) console.log(`[payments] restore: перепривязано покупок: ${moved}`)
  return c.json({ restored })
})
