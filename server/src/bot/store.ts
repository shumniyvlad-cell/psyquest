// Хранилище ботов и лидов: SQLite + шифрование ключом BOT_TOKEN_KEY (токен, секрет вебхука, данные лидов).
import type { SQLOutputValue } from 'node:sqlite'
import { db, num, numOrNull, text, textOrNull, tx } from '../db.ts'
import { env } from '../env.ts'
import { decrypt, encrypt } from '../lib/crypto.ts'
import type { BotConfig } from '../types.ts'
import type { Flow, LeadState, Stage } from './funnel.ts'

type Row = Record<string, SQLOutputValue>

export interface BotRow {
  id: string
  playerId: string
  username: string
  adminCode: string
  ownerChatId: number | null
  config: BotConfig
  tokenEnc: string
  secretEnc: string
}

function key(): Buffer {
  if (!env.botTokenKey) throw new Error('BOT_TOKEN_KEY не задан')
  return env.botTokenKey
}

// AAD привязывает шифртекст к конкретной записи
const aad = {
  token: (botId: string) => `bot:${botId}:token`,
  secret: (botId: string) => `bot:${botId}:secret`,
  lead: (botId: string, chatId: number) => `lead:${botId}:${chatId}`,
}

function toBot(r: Row): BotRow {
  return {
    id: text(r.id),
    playerId: text(r.player_id),
    username: text(r.username),
    adminCode: text(r.admin_code),
    ownerChatId: numOrNull(r.owner_chat_id),
    config: JSON.parse(text(r.config)) as BotConfig,
    tokenEnc: text(r.token_enc),
    secretEnc: text(r.secret_enc),
  }
}

export function getBot(id: string): BotRow | null {
  const r = db.prepare('SELECT * FROM bots WHERE id = ?').get(id)
  return r ? toBot(r) : null
}

export function getBotByTokenHash(hash: string): BotRow | null {
  const r = db.prepare('SELECT * FROM bots WHERE token_hash = ?').get(hash)
  return r ? toBot(r) : null
}

export function countBots(playerId: string): number {
  return num(db.prepare('SELECT COUNT(*) AS n FROM bots WHERE player_id = ?').get(playerId)?.n)
}

export function botToken(bot: BotRow): string {
  return decrypt(key(), bot.tokenEnc, aad.token(bot.id))
}

export function botSecret(bot: BotRow): string {
  return decrypt(key(), bot.secretEnc, aad.secret(bot.id))
}

export function insertBot(p: {
  id: string
  playerId: string
  token: string
  tokenHash: string
  secret: string
  username: string
  adminCode: string
  config: BotConfig
}) {
  const now = Date.now()
  db.prepare(
    `INSERT INTO bots (id, player_id, token_hash, token_enc, secret_enc, username, admin_code, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    p.id,
    p.playerId,
    p.tokenHash,
    encrypt(key(), p.token, aad.token(p.id)),
    encrypt(key(), p.secret, aad.secret(p.id)),
    p.username,
    p.adminCode,
    JSON.stringify(p.config),
    now,
    now,
  )
}

export function updateBot(id: string, p: { config: BotConfig; username?: string }) {
  if (p.username) {
    db.prepare('UPDATE bots SET config = ?, username = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(p.config),
      p.username,
      Date.now(),
      id,
    )
  } else {
    db.prepare('UPDATE bots SET config = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(p.config), Date.now(), id)
  }
}

export function setOwner(botId: string, chatId: number) {
  db.prepare('UPDATE bots SET owner_chat_id = ?, updated_at = ? WHERE id = ?').run(chatId, Date.now(), botId)
}

/** Удаляет бота вместе с лидами (персональные данные не остаются). */
export function deleteBot(botId: string) {
  tx(() => {
    db.prepare('DELETE FROM leads WHERE bot_id = ?').run(botId)
    db.prepare('DELETE FROM bots WHERE id = ?').run(botId)
  })
}

// ---------- лиды ----------

interface Pii {
  name: string | null
  username: string | null
  answers: string[]
}

function toLead(botId: string, r: Row): LeadState {
  let pii: Pii | null = null
  const enc = textOrNull(r.pii)
  if (enc) {
    try {
      pii = JSON.parse(decrypt(key(), enc, aad.lead(botId, num(r.chat_id)))) as Pii
    } catch {
      console.error(`[leads] не удалось расшифровать данные лида ${num(r.id)} (bot ${botId})`)
    }
  }
  return {
    stage: text(r.stage) as Stage,
    flow: text(r.flow) as Flow,
    quizIndex: num(r.quiz_index),
    bookShown: num(r.book_shown) === 1,
    answers: Array.isArray(pii?.answers) ? pii.answers : [],
    name: pii?.name ?? null,
    username: pii?.username ?? null,
    consentAt: numOrNull(r.consent_at),
    magnetAt: numOrNull(r.magnet_at),
    quizDoneAt: numOrNull(r.quiz_done_at),
    offerAt: numOrNull(r.offer_at),
    bookingAt: numOrNull(r.booking_at),
    laterAt: numOrNull(r.later_at),
    followUpAt: numOrNull(r.followup_at),
    crisis: num(r.crisis) === 1,
    createdAt: num(r.created_at),
  }
}

export function loadLead(botId: string, chatId: number): LeadState | null {
  const r = db.prepare('SELECT * FROM leads WHERE bot_id = ? AND chat_id = ?').get(botId, chatId)
  return r ? toLead(botId, r) : null
}

export function saveLead(botId: string, chatId: number, lead: LeadState) {
  const hasPii = lead.name !== null || lead.username !== null || lead.answers.length > 0
  const pii = hasPii
    ? encrypt(
        key(),
        JSON.stringify({ name: lead.name, username: lead.username, answers: lead.answers } satisfies Pii),
        aad.lead(botId, chatId),
      )
    : null
  db.prepare(
    `INSERT INTO leads (bot_id, chat_id, pii, stage, flow, quiz_index, book_shown, crisis, blocked, consent_at, magnet_at,
                        quiz_done_at, offer_at, booking_at, later_at, followup_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (bot_id, chat_id) DO UPDATE SET
       pii = excluded.pii, stage = excluded.stage, flow = excluded.flow, quiz_index = excluded.quiz_index,
       book_shown = excluded.book_shown, crisis = excluded.crisis, blocked = 0, consent_at = excluded.consent_at,
       magnet_at = excluded.magnet_at, quiz_done_at = excluded.quiz_done_at, offer_at = excluded.offer_at,
       booking_at = excluded.booking_at, later_at = excluded.later_at, followup_at = excluded.followup_at,
       updated_at = excluded.updated_at`,
  ).run(
    botId,
    chatId,
    pii,
    lead.stage,
    lead.flow,
    lead.quizIndex,
    lead.bookShown ? 1 : 0,
    lead.crisis ? 1 : 0,
    lead.consentAt,
    lead.magnetAt,
    lead.quizDoneAt,
    lead.offerAt,
    lead.bookingAt,
    lead.laterAt,
    lead.followUpAt,
    lead.createdAt,
    Date.now(),
  )
}

export function deleteLead(botId: string, chatId: number) {
  db.prepare('DELETE FROM leads WHERE bot_id = ? AND chat_id = ?').run(botId, chatId)
}

/** Лид заблокировал бота — больше ему не пишем (сбросится, когда он снова напишет). */
export function markBlocked(botId: string, chatId: number) {
  db.prepare('UPDATE leads SET blocked = 1, updated_at = ? WHERE bot_id = ? AND chat_id = ?').run(Date.now(), botId, chatId)
}

export function listLeads(botId: string) {
  const rows = db.prepare('SELECT * FROM leads WHERE bot_id = ? ORDER BY created_at DESC LIMIT 500').all(botId)
  return rows.map((r) => {
    const lead = toLead(botId, r)
    return {
      id: String(num(r.id)),
      name: lead.name,
      username: lead.username,
      answers: lead.answers,
      stage: lead.stage,
      consent: lead.consentAt !== null,
      crisis: lead.crisis,
      createdAt: lead.createdAt,
    }
  })
}

export function leadStats(botId: string) {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS started, COUNT(consent_at) AS consented, COUNT(magnet_at) AS got_magnet,
              COUNT(quiz_done_at) AS finished_quiz, COUNT(booking_at) AS clicked_booking
       FROM leads WHERE bot_id = ?`,
    )
    .get(botId)
  return {
    started: num(r?.started),
    consented: num(r?.consented),
    gotMagnet: num(r?.got_magnet),
    finishedQuiz: num(r?.finished_quiz),
    clickedBooking: num(r?.clicked_booking),
  }
}

/** Кандидаты на напоминание: «Пока подумаю» нажато от 24 до 72 ч назад и с тех пор ничего не изменилось. */
export function followUpCandidates(now: number, delayMs: number) {
  const rows = db
    .prepare(
      `SELECT * FROM leads
       WHERE followup_at IS NULL AND later_at IS NOT NULL AND flow = 'later'
         AND later_at <= ? AND later_at > ? AND crisis = 0 AND blocked = 0
       ORDER BY later_at LIMIT 200`,
    )
    .all(now - delayMs, now - 3 * delayMs)
  return rows.map((r) => {
    const botId = text(r.bot_id)
    return { id: num(r.id), botId, chatId: num(r.chat_id), lead: toLead(botId, r) }
  })
}

export function markFollowUp(leadId: number, now: number) {
  db.prepare('UPDATE leads SET followup_at = ?, updated_at = ? WHERE id = ?').run(now, now, leadId)
}
