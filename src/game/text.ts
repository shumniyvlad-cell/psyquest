// Подстановки в репликах: {name}, {clients}… и родовые формы {готов|готова}.
import type { Gender } from './types'

export type TextCtx = { gender: Gender } & Record<string, string | number | undefined>

export function fmt(text: string, ctx: TextCtx): string {
  return text.replace(/\{([^{}]+)\}/g, (_, key: string) => {
    if (key.includes('|')) {
      const [m, f] = key.split('|')
      return ctx.gender === 'f' ? f : m
    }
    const v = key === 'gender' ? undefined : ctx[key]
    return v === undefined || v === '' ? '…' : String(v)
  })
}

/** Строчная первая буква для вставки в середину фразы — кроме аббревиатур («МГУ») */
export function lcFirst(s: string | undefined) {
  if (!s) return s
  const t = s.trim()
  if (t.length > 1 && t[1] === t[1].toLowerCase() && t[1] !== t[1].toUpperCase()) return t[0].toLowerCase() + t.slice(1)
  return t
}

/** «Название» в кавычках, если своих кавычек в нём ещё нет */
export const q = (name: string) => (/[«»"]/.test(name) ? name : `«${name}»`)

/** Первая буква заглавной */
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** Обрезка длинного пользовательского текста для реплик */
export function short(s: string | undefined, max = 90) {
  if (!s) return ''
  const t = s.trim().replace(/\s+/g, ' ')
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}
