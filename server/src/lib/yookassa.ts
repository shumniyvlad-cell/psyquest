// Клиент API ЮKassa v3: создание платежа и получение его статуса. Ключи — только из env, в логи не попадают.
import { setTimeout as sleep } from 'node:timers/promises'
import { z } from 'zod'

const API = 'https://api.yookassa.ru/v3'

export interface YooKassaConfig {
  shopId: string
  secretKey: string
}

const Amount = z.object({ value: z.string(), currency: z.string() })

const PaymentSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'waiting_for_capture', 'succeeded', 'canceled']),
  paid: z.boolean(),
  amount: Amount,
  confirmation: z.object({ type: z.string(), confirmation_url: z.string().optional() }).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type YooKassaPayment = z.infer<typeof PaymentSchema>

export class YooKassaError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, description?: string) {
    super(`yookassa ${status} ${code}${description ? `: ${description}` : ''}`)
    this.status = status
    this.code = code
  }
}

/** 2990 → '2990.00' */
export function rubToValue(rub: number): string {
  return rub.toFixed(2)
}

/** '2990.00' → 299000 (копейки), без плавающей точки. null — если формат неожиданный. */
export function valueToKopecks(value: string): number | null {
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value)
  if (!m) return null
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
}

// Retry — только для безопасных случаев: сеть, 5xx и 202 «ещё обрабатывается» (с тем же Idempotence-Key)
async function request(cfg: YooKassaConfig, method: 'GET' | 'POST', path: string, body?: unknown, idempotenceKey?: string) {
  const headers: Record<string, string> = {
    authorization: 'Basic ' + Buffer.from(`${cfg.shopId}:${cfg.secretKey}`).toString('base64'),
    accept: 'application/json',
  }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (idempotenceKey) headers['idempotence-key'] = idempotenceKey

  let lastError: YooKassaError | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(700 * attempt)
    let res: Response
    try {
      res = await fetch(API + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      })
    } catch (e) {
      lastError = new YooKassaError(0, e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'network')
      continue
    }
    const data: unknown = await res.json().catch(() => null)
    const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
    if (res.status === 202 || obj.type === 'processing') {
      lastError = new YooKassaError(res.status, 'processing')
      continue
    }
    if (res.status >= 500) {
      lastError = new YooKassaError(res.status, String(obj.code ?? 'server_error'))
      continue
    }
    if (!res.ok) {
      throw new YooKassaError(res.status, String(obj.code ?? 'http_error'), String(obj.description ?? '').slice(0, 200))
    }
    const parsed = PaymentSchema.safeParse(data)
    if (!parsed.success) throw new YooKassaError(res.status, 'bad_response')
    return parsed.data
  }
  throw lastError ?? new YooKassaError(0, 'unknown')
}

export interface CreatePaymentInput {
  localId: string
  amountValue: string
  description: string
  returnUrl: string
  metadata: Record<string, string>
  receipt?: { email: string; itemDescription: string }
}

export function createPayment(cfg: YooKassaConfig, p: CreatePaymentInput): Promise<YooKassaPayment> {
  const amount = { value: p.amountValue, currency: 'RUB' }
  const body: Record<string, unknown> = {
    amount,
    capture: true,
    confirmation: { type: 'redirect', return_url: p.returnUrl },
    description: p.description.slice(0, 128),
    metadata: p.metadata,
  }
  if (p.receipt) {
    body.receipt = {
      customer: { email: p.receipt.email },
      items: [
        {
          description: p.receipt.itemDescription.slice(0, 128),
          quantity: '1.00',
          amount,
          vat_code: 1,
          payment_mode: 'full_payment',
          payment_subject: 'service',
        },
      ],
    }
  }
  // Idempotence-Key = наш localId: повтор запроса не создаст второй платёж
  return request(cfg, 'POST', '/payments', body, p.localId)
}

export function getPayment(cfg: YooKassaConfig, id: string): Promise<YooKassaPayment> {
  return request(cfg, 'GET', `/payments/${encodeURIComponent(id)}`)
}
