/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес сервера игры (платежи, AI-наставник, боты). Пусто — демо-режим. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
