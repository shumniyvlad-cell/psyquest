// Общие помощники для роутов: разбор JSON через zod, единый формат ошибок.
import type { Context } from 'hono'
import { z } from 'zod'

export type Parsed<T> = { ok: true; data: T } | { ok: false; res: Response }

/** uuid (регистр неважен, приводим к нижнему). */
export const Uuid = z.uuid().transform((s) => s.toLowerCase())

export const Email = z.string().trim().toLowerCase().max(254).pipe(z.email())

export function check<S extends z.ZodType>(c: Context, schema: S, raw: unknown): Parsed<z.output<S>> {
  const r = schema.safeParse(raw)
  if (r.success) return { ok: true, data: r.data }
  const issues = r.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), message: i.message }))
  return { ok: false, res: c.json({ error: 'invalid_request', issues }, 400) }
}

export async function readJson<S extends z.ZodType>(c: Context, schema: S): Promise<Parsed<z.output<S>>> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return { ok: false, res: c.json({ error: 'invalid_json' }, 400) }
  }
  return check(c, schema, raw)
}

/** Короткое описание ошибки для логов (без стеков и без секретов). */
export function describe(e: unknown): string {
  return e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300)
}
