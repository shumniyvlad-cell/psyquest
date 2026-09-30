import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' — сборка работает из любой подпапки (GitHub Pages, свой хостинг, файл)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    // основной чанк ~1 МБ: React + Tone.js (музыка) + арт; мини-игры грузятся лениво
    chunkSizeWarningLimit: 1200,
  },
})
