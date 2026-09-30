// Переменные окружения: читаем один раз при старте, ошибки конфигурации — сразу падаем.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// server/.env, если есть (уже заданные переменные окружения не перезаписываются)
const envFile = path.join(SERVER_ROOT, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

function str(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

function flag(name: string): boolean {
  return /^(1|true|yes|on)$/i.test(str(name) ?? '')
}

function int(name: string, def: number): number {
  const v = str(name)
  if (!v) return def
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0 || n > 65535) throw new Error(`${name}: нужен номер порта`)
  return n
}

function httpUrl(name: string): URL | undefined {
  const v = str(name)
  if (!v) return undefined
  let u: URL
  try {
    u = new URL(v)
  } catch {
    throw new Error(`${name}: некорректный URL`)
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`${name}: нужен http(s)-адрес`)
  return u
}

// Ключ шифрования: 32 байта в hex (64 символа) или base64/base64url
function key32(name: string): Buffer | undefined {
  const v = str(name)
  if (!v) return undefined
  let buf: Buffer | undefined
  if (/^[0-9a-f]{64}$/i.test(v)) buf = Buffer.from(v, 'hex')
  else if (/^[A-Za-z0-9+/_-]{43}=?$/.test(v)) buf = Buffer.from(v, 'base64')
  if (!buf || buf.length !== 32) {
    throw new Error(`${name}: нужен ключ 32 байта — hex (64 символа) или base64. Сгенерировать: openssl rand -hex 32`)
  }
  return buf
}

function origins(name: string): Set<string> {
  const v = str(name)
  // По умолчанию — только локальный Vite (dev и preview)
  if (!v) {
    return new Set([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
    ])
  }
  const out = new Set<string>()
  for (const raw of v.split(',')) {
    const o = raw.trim()
    if (!o) continue
    try {
      out.add(new URL(o).origin)
    } catch {
      throw new Error(`${name}: некорректный origin «${o}»`)
    }
  }
  return out
}

const shopId = str('YOOKASSA_SHOP_ID')
const secretKey = str('YOOKASSA_SECRET_KEY')
const demoPayments = flag('DEMO_PAYMENTS') || !shopId || !secretKey

const publicApi = httpUrl('PUBLIC_API_URL')
const publicGame = httpUrl('PUBLIC_GAME_URL')

if (!demoPayments && !publicGame) {
  throw new Error('PUBLIC_GAME_URL обязателен для реальных платежей: туда ЮKassa возвращает игрока')
}

export const env = {
  port: int('PORT', 8787),
  /** Без слэша в конце: к нему дописываем /api/tg/<botId> */
  publicApiUrl: publicApi ? publicApi.href.replace(/\/+$/, '') : undefined,
  publicGameUrl: publicGame?.href,
  allowedOrigins: origins('ALLOWED_ORIGINS'),
  trustProxy: flag('TRUST_PROXY'),
  demoPayments,
  yookassa: demoPayments || !shopId || !secretKey ? null : { shopId, secretKey, receipts: flag('YOOKASSA_RECEIPTS') },
  anthropicApiKey: str('ANTHROPIC_API_KEY'),
  // «Актуальная модель класса Sonnet»
  mentorModel: str('MENTOR_MODEL') ?? 'claude-sonnet-5-5',
  botTokenKey: key32('BOT_TOKEN_KEY'),
  dataDir: path.resolve(SERVER_ROOT, str('DATA_DIR') ?? 'data'),
}

export const features = {
  ai: Boolean(env.anthropicApiKey),
  bots: Boolean(env.botTokenKey && env.publicApiUrl),
}
