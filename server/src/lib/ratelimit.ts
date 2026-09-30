// Простой in-memory rate limiter (фиксированное окно на ключ). Один процесс — одна память, для MVP хватает.
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { env } from '../env.ts'

const MAX_KEYS = 100_000
const all = new Set<RateLimiter>()

export class RateLimiter {
  readonly limit: number
  readonly windowMs: number
  #hits = new Map<string, { count: number; resetAt: number }>()

  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
    all.add(this)
  }

  /** Засчитать попытку. ok=false — лимит исчерпан, retryAfter — через сколько секунд окно сбросится. */
  hit(key: string, now = Date.now()): { ok: boolean; retryAfter: number } {
    let e = this.#hits.get(key)
    if (!e || e.resetAt <= now) {
      if (this.#hits.size >= MAX_KEYS) this.sweep(now)
      e = { count: 0, resetAt: now + this.windowMs }
      this.#hits.set(key, e)
    }
    e.count++
    return { ok: e.count <= this.limit, retryAfter: Math.max(1, Math.ceil((e.resetAt - now) / 1000)) }
  }

  /** Исчерпан ли лимит (без новой попытки). */
  blocked(key: string, now = Date.now()): boolean {
    const e = this.#hits.get(key)
    return Boolean(e && e.resetAt > now && e.count >= this.limit)
  }

  sweep(now = Date.now()) {
    for (const [k, e] of this.#hits) if (e.resetAt <= now) this.#hits.delete(k)
    // если все ключи живые, а их слишком много — сбрасываем (защита памяти от флуда)
    if (this.#hits.size >= MAX_KEYS) this.#hits.clear()
  }
}

setInterval(() => {
  const now = Date.now()
  for (const l of all) l.sweep(now)
}, 60_000).unref()

/** 429 с Retry-After. */
export function tooMany(c: Context, retryAfter: number) {
  c.header('Retry-After', String(retryAfter))
  return c.json({ error: 'rate_limited', retryAfter }, 429)
}

const isLoopback = (ip: string) => ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.')

/**
 * IP клиента. Заголовкам прокси (X-Real-IP, последний X-Forwarded-For) верим, если запрос пришёл
 * с loopback (nginx на этой же машине) или включён TRUST_PROXY. Иначе — адрес сокета.
 */
export function clientIp(c: Context): string {
  let peer = 'unknown'
  try {
    peer = getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    // нет сокета (например, app.request в тестах)
  }
  if (env.trustProxy || isLoopback(peer)) {
    const real = c.req.header('x-real-ip')?.trim()
    if (real) return real
    const last = c.req.header('x-forwarded-for')?.split(',').pop()?.trim()
    if (last) return last
  }
  return peer
}
