// Типы сервера. BotConfig — копия из src/game/types.ts (фронт не импортируем).

export interface BotQuizQuestion {
  id: string
  text: string
  options: string[]
}

export interface BotConfig {
  botName: string
  welcome: string
  consent: boolean
  consentText: string
  leadMagnetTitle: string
  leadMagnetUrl: string
  quiz: BotQuizQuestion[]
  offerText: string
  offerPrice: number
  bookingText: string
  bookingUrl: string
  followUp: string
  crisisText: string
  /** Заполняется после деплоя через сервер игры (сервер это поле не хранит) */
  deployed?: { botId: string; username: string; adminCode: string; deployedAt: number }
}

/** Inline-кнопка: callback (data) или ссылка (url) */
export type Button = { text: string; data: string } | { text: string; url: string }

// ---------- Telegram Bot API: только то, что читает воронка ----------

export interface TgUser {
  id: number
  is_bot?: boolean
  first_name?: string
  last_name?: string
  username?: string
}

export interface TgChat {
  id: number
  type: string
}

export interface TgMessage {
  message_id: number
  chat: TgChat
  from?: TgUser
  text?: string
}

export interface TgCallbackQuery {
  id: string
  from: TgUser
  message?: TgMessage
  data?: string
}

export interface TgUpdate {
  update_id: number
  message?: TgMessage
  callback_query?: TgCallbackQuery
}
