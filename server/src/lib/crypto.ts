// Шифрование токенов и персональных данных (AES-256-GCM), хэши и сравнение за постоянное время.
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

const VERSION = 'v1'

/** Шифрует строку. aad привязывает шифртекст к записи (например, к botId), чтобы его нельзя было переставить. */
export function encrypt(key: Buffer, plain: string, aad: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.')
}

export function decrypt(key: Buffer, packed: string, aad: string): string {
  const [version, iv, tag, ct] = packed.split('.')
  if (version !== VERSION || !iv || !tag || ct === undefined) throw new Error('decrypt: неизвестный формат')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
  decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8')
}

export function sha256hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

/** Сравнение строк за постоянное время (сравниваем хэши — длина не утекает). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

/** Случайный секрет в base64url (32 байта → 43 символа). */
export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function randomDigits(n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) s += String(randomInt(0, 10))
  return s
}
