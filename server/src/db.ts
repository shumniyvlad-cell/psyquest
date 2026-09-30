// SQLite (встроенный node:sqlite): схема + миграции при старте. Файл DATA_DIR/psyquest.db, WAL.
import { chmodSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync, type SQLOutputValue } from 'node:sqlite'
import { env } from './env.ts'

mkdirSync(env.dataDir, { recursive: true, mode: 0o700 })
export const DB_PATH = path.join(env.dataDir, 'psyquest.db')
export const db = new DatabaseSync(DB_PATH)
try {
  chmodSync(DB_PATH, 0o600) // там токены (зашифрованы) и персональные данные лидов
} catch {
  // не критично (например, Windows)
}

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
`)

// Миграции по порядку; номер применённой — в PRAGMA user_version. Старые не менять — только дописывать новые.
const MIGRATIONS: string[] = [
  `
  -- Платежи. Всё, что даёт покупка, хранится в строке платежа: так restore просто перепривязывает строки.
  CREATE TABLE payments (
    local_id      TEXT PRIMARY KEY,           -- наш id (uuid)
    player_id     TEXT NOT NULL,
    sku           TEXT NOT NULL,
    email         TEXT,                       -- lower-case
    amount        INTEGER NOT NULL,           -- копейки, из каталога на момент создания
    currency      TEXT NOT NULL,
    provider      TEXT NOT NULL,              -- 'yookassa' | 'demo'
    provider_id   TEXT UNIQUE,                -- id платежа в ЮKassa
    status        TEXT NOT NULL,              -- 'pending' | 'succeeded' | 'canceled'
    grants        TEXT NOT NULL,              -- JSON-массив, снимок каталога
    credits_left  INTEGER NOT NULL,           -- остаток разборов Совы
    coins_pending INTEGER NOT NULL,           -- монеты, ещё не забранные в игру
    created_at    INTEGER NOT NULL,
    paid_at       INTEGER,
    checked_at    INTEGER NOT NULL DEFAULT 0  -- последняя сверка с ЮKassa
  );
  CREATE INDEX payments_player ON payments (player_id, status);
  CREATE INDEX payments_email ON payments (email, status);
  CREATE INDEX payments_pending ON payments (status, created_at);

  -- Боты игроков
  CREATE TABLE bots (
    id            TEXT PRIMARY KEY,           -- botId (uuid), он же в URL вебхука
    player_id     TEXT NOT NULL,
    token_hash    TEXT NOT NULL UNIQUE,       -- sha256(token) для поиска дублей
    token_enc     TEXT NOT NULL,              -- AES-256-GCM
    secret_enc    TEXT NOT NULL,              -- secret_token вебхука, AES-256-GCM
    username      TEXT NOT NULL,
    admin_code    TEXT NOT NULL,
    owner_chat_id INTEGER,
    config        TEXT NOT NULL,              -- JSON BotConfig
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );
  CREATE INDEX bots_player ON bots (player_id);

  -- Лиды ботов: состояние воронки по chat_id. Имя/username/ответы — только после согласия и зашифрованы.
  CREATE TABLE leads (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id       TEXT NOT NULL REFERENCES bots (id) ON DELETE CASCADE,
    chat_id      INTEGER NOT NULL,
    pii          TEXT,
    stage        TEXT NOT NULL,
    quiz_index   INTEGER NOT NULL DEFAULT -1,
    crisis       INTEGER NOT NULL DEFAULT 0,
    blocked      INTEGER NOT NULL DEFAULT 0,
    consent_at   INTEGER,
    magnet_at    INTEGER,
    quiz_done_at INTEGER,
    offer_at     INTEGER,
    booking_at   INTEGER,
    followup_at  INTEGER,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    UNIQUE (bot_id, chat_id)
  );
  CREATE INDEX leads_followup ON leads (magnet_at) WHERE followup_at IS NULL AND offer_at IS NULL;
  `,
  `
  -- Воронка как в превью игры: текущий шаг, показана ли кнопка записи, «Пока подумаю» (от него — напоминание)
  ALTER TABLE leads ADD COLUMN flow TEXT NOT NULL DEFAULT 'consent';
  ALTER TABLE leads ADD COLUMN book_shown INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE leads ADD COLUMN later_at INTEGER;
  DROP INDEX IF EXISTS leads_followup;
  CREATE INDEX leads_later ON leads (later_at) WHERE followup_at IS NULL AND later_at IS NOT NULL;
  `,
]

function migrate() {
  const row = db.prepare('PRAGMA user_version').get()
  const current = Number(row?.user_version ?? 0)
  for (let v = current; v < MIGRATIONS.length; v++) {
    tx(() => {
      db.exec(MIGRATIONS[v]!)
      db.exec(`PRAGMA user_version = ${v + 1}`)
    })
  }
}

/** Транзакция: BEGIN IMMEDIATE сразу берёт блокировку записи. Вложенные не поддерживаются. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

// Приведение значений из SQLite
export function num(v: SQLOutputValue | undefined): number {
  return typeof v === 'number' ? v : typeof v === 'bigint' ? Number(v) : 0
}

export function numOrNull(v: SQLOutputValue | undefined): number | null {
  return v === null || v === undefined ? null : num(v)
}

export function text(v: SQLOutputValue | undefined): string {
  return typeof v === 'string' ? v : ''
}

export function textOrNull(v: SQLOutputValue | undefined): string | null {
  return typeof v === 'string' ? v : null
}

migrate()
