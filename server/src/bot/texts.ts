// Тексты и форматтеры воронки. Первая часть — копия эталона из src/minigames/bot/model.ts
// (FLOW_TEXT, DEFAULT_*_TEXT, quoteTitle, formatPrice, priceLine, magnetMessage, offerMessage, checkUrl):
// превью в игре и живой бот должны писать одно и то же. Фронт не импортируем — при правке там перенести сюда.
import type { BotConfig } from '../types.ts'

/** Служебные тексты воронки, которые не настраиваются. */
export const FLOW_TEXT = {
  start: 'Запустить',
  consentYes: 'Даю согласие',
  consentNo: 'Не сейчас',
  magnetOpen: 'Открыть материал',
  quizStart: 'Ответить на вопросы',
  skipQuiz: 'Узнать о встрече',
  later: 'Пока подумаю',
  declinedIntro: 'Хорошо, ответы сохранять не буду.',
  declinedOffer:
    'Если захочется разобрать свою ситуацию со специалистом, запись по кнопке ниже. Больше ничего присылать не буду.',
  laterReply: 'Конечно, без спешки. Материал остаётся у тебя.',
  laterReplyFollow: 'Конечно, без спешки. Материал остаётся у тебя, а завтра я один раз коротко напомню о себе.',
  fallback: 'Я бот и понимаю только кнопки под сообщениями. Всё главное, включая стоимость, будет через пару шагов.',
} as const

export const DEFAULT_CRISIS_TEXT =
  'Мне очень жаль, что тебе сейчас так тяжело. Я бот и не могу помочь в такой ситуации, но помощь есть прямо сейчас. Экстренные службы: 112. Экстренная психологическая помощь МЧС: +7 (495) 989-50-50. Телефон доверия для детей, подростков и родителей: 8-800-2000-122, бесплатно и круглосуточно. Если рядом есть близкий человек, напиши или позвони ему. Твой психолог увидит это сообщение.'

export const DEFAULT_CONSENT_TEXT =
  'Прежде чем задать пару вопросов, нужно твоё согласие. Бот сохранит имя в Telegram и ответы, чтобы психолог мог подготовиться к встрече. Данные не передаются третьим лицам, а удалить их можно в любой момент — просто напиши об этом. Нажимая «Даю согласие», ты соглашаешься на обработку персональных данных по 152-ФЗ.'

/** «Название» — без двойных кавычек, если они уже есть внутри. */
export function quoteTitle(t: string): string {
  const s = t.trim()
  if (!s) return '«без названия»'
  return /[«»"„“]/.test(s) ? s : `«${s}»`
}

export function formatPrice(price: number): string {
  return `${Math.round(price).toLocaleString('ru-RU')} ₽`
}

export function priceLine(price: number): string {
  return Number.isFinite(price) && price > 0 ? `Стоимость: ${formatPrice(price)}` : 'Стоимость: бесплатно'
}

function questionsWord(n: number): string {
  if (n === 1) return 'один короткий вопрос'
  if (n === 2) return 'два коротких вопроса'
  if (n === 3) return 'три коротких вопроса'
  if (n === 4) return 'четыре коротких вопроса'
  return `${n} коротких вопросов`
}

export function magnetMessage(cfg: BotConfig, withQuiz: boolean, declined = false): string {
  const head = `${declined ? `${FLOW_TEXT.declinedIntro} ` : ''}Держи материал: ${quoteTitle(cfg.leadMagnetTitle)}. Он твой в любом случае, без условий.`
  if (!withQuiz || cfg.quiz.length === 0) return head
  return `${head}\n\nА если хочешь, ответь на ${questionsWord(cfg.quiz.length)} — подскажу, какой шаг будет следующим.`
}

export function offerMessage(cfg: BotConfig): string {
  const body = cfg.offerText.trim()
  return body ? `${body}\n\n${priceLine(cfg.offerPrice)}` : priceLine(cfg.offerPrice)
}

const TG_USERNAME = /^[A-Za-z][A-Za-z0-9_]{4,31}$/

export interface UrlCheck {
  ok: boolean
  /** Нормализованный адрес, который откроет бот */
  url: string | null
  insecure: boolean
  reason?: 'empty' | 'format' | 'tg-user'
}

/** Разбирает ссылку: https://…, t.me/username, @username, домен без протокола. */
export function checkUrl(raw: string): UrlCheck {
  const s = raw.trim()
  if (!s) return { ok: false, url: null, insecure: false, reason: 'empty' }
  if (/\s/.test(s)) return { ok: false, url: null, insecure: false, reason: 'format' }
  if (s.startsWith('@')) {
    const u = s.slice(1)
    return TG_USERNAME.test(u)
      ? { ok: true, url: `https://t.me/${u}`, insecure: false }
      : { ok: false, url: null, insecure: false, reason: 'tg-user' }
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) && !/^[^/:]+:\d/.test(s) ? s : `https://${s}`
  let u: URL
  try {
    u = new URL(withScheme)
  } catch {
    return { ok: false, url: null, insecure: false, reason: 'format' }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, url: null, insecure: false, reason: 'format' }
  const host = u.hostname.toLowerCase()
  if (!/^[a-z0-9.-]+$/.test(host) || !/\.([a-z]{2,}|xn--[a-z0-9-]{2,})$/.test(host) || host.includes('..')) {
    return { ok: false, url: null, insecure: false, reason: 'format' }
  }
  if (host === 't.me' || host === 'telegram.me' || host === 'www.t.me') {
    const first = u.pathname.split('/').filter(Boolean)[0] ?? ''
    const invite = first.startsWith('+') || first === 'joinchat'
    if (!invite && !TG_USERNAME.test(first)) return { ok: false, url: null, insecure: false, reason: 'tg-user' }
  }
  return { ok: true, url: u.toString(), insecure: u.protocol === 'http:' }
}

// ---------- Только на сервере: в превью этих шагов нет (Telegram, владелец, 152-ФЗ) ----------

export const SERVER_TEXT = {
  /** Так отмечаем нажатую кнопку: превью показывает её как реплику человека */
  answer: (choice: string) => `Твой ответ: ${choice}`,
  bookingDefault: 'Записаться',
  bookingLink: 'Запись — по кнопке ниже.',
  bookingBroken: 'Ссылка для записи сейчас не работает — загляни чуть позже.',
  stale: 'Эта кнопка уже неактуальна',
  emptyQuestion: 'Пустое сообщение',
  emptyOption: 'Пустой вариант',
  forgotten: 'Готово: твои данные удалены из бота. Чтобы начать заново, нажми /start.',
  adminOk: 'Готово! Теперь сюда будут приходить карточки новых лидов, их сообщения и срочные уведомления.',
  adminBad: 'Код не подошёл. Проверь его в игре и попробуй ещё раз.',
  adminFormat: 'Отправь команду с кодом из игры, например: /admin 123456',
  adminLocked: 'Слишком много попыток. Попробуй позже.',
  ownerMoved: 'Уведомления этого бота переключены на другой аккаунт Telegram.',
}
