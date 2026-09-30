/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес сервера игры (платежи, AI-наставник, боты). Пусто — демо-режим. */
  readonly VITE_API_URL?: string
  /** '1' — сборка для Artifact: без скачиваний и печати */
  readonly VITE_ARTIFACT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
