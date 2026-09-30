// Минимальный клиент Telegram Bot API. Токен есть только в URL запроса — в ошибки и логи он не попадает.
import type { Button } from '../types.ts'

export class TelegramError extends Error {
  /** error_code Telegram (0 — сеть/таймаут) */
  readonly code: number
  readonly retryAfter: number | undefined
  constructor(method: string, code: number, description: string, retryAfter?: number) {
    super(`telegram ${method}: ${code} ${description}`)
    this.code = code
    this.retryAfter = retryAfter
  }
}

interface TgResponse {
  ok?: boolean
  result?: unknown
  error_code?: number
  description?: string
  parameters?: { retry_after?: number }
}

async function call<T>(token: string, method: string, params: Record<string, unknown> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    throw new TelegramError(method, 0, e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'network error')
  }
  const data = (await res.json().catch(() => null)) as TgResponse | null
  if (!data?.ok) {
    throw new TelegramError(
      method,
      data?.error_code ?? res.status,
      String(data?.description ?? 'bad response').slice(0, 200),
      data?.parameters?.retry_after,
    )
  }
  return data.result as T
}

export interface BotInfo {
  id: number
  is_bot: boolean
  username?: string
}

export function getMe(token: string) {
  return call<BotInfo>(token, 'getMe')
}

export function setWebhook(
  token: string,
  p: { url: string; secret: string; dropPending: boolean },
) {
  return call<boolean>(token, 'setWebhook', {
    url: p.url,
    secret_token: p.secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: p.dropPending,
  })
}

export function deleteWebhook(token: string) {
  return call<boolean>(token, 'deleteWebhook', { drop_pending_updates: true })
}

function keyboard(buttons?: Button[][]) {
  if (!buttons?.length) return undefined
  return {
    inline_keyboard: buttons.map((row) =>
      row.map((b) => ('url' in b ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data })),
    ),
  }
}

const clip = (s: string) => (s.length > 4096 ? s.slice(0, 4093) + '...' : s)

export function sendMessage(token: string, chatId: number, text: string, buttons?: Button[][]) {
  return call<{ message_id: number }>(token, 'sendMessage', {
    chat_id: chatId,
    text: clip(text),
    reply_markup: keyboard(buttons),
  })
}

/** Заменяет текст сообщения; без reply_markup кнопки под ним исчезают. */
export function editMessageText(token: string, chatId: number, messageId: number, text: string) {
  return call<unknown>(token, 'editMessageText', { chat_id: chatId, message_id: messageId, text: clip(text) })
}

export function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  return call<boolean>(token, 'answerCallbackQuery', { callback_query_id: callbackQueryId, text })
}
