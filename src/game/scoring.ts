// Оценка «остроты» позиционирования — эвристика, которая учит, а не судит.

export interface PosParts {
  who: string
  pain: string
  result: string
  method: string
}

export interface PosScore {
  score: number
  good: string[]
  tips: string[]
  vague: string[]
  promises: string[]
}

const VAGUE = ['всем', 'всех', 'любым', 'любые', 'любых', 'разными', 'разные', 'разных', 'гармони', 'счасть', 'лучшей версией', 'жизнь мечты', 'в целом']
const PROMISES = ['гарантир', '100%', 'навсегда', 'за одну сессию', 'за 1 сессию', 'избавлю', 'вылечу', 'излечу', 'навсегда']
const RESULT_MARKERS = /(чтобы|научить|вернуть|перестать|выйти|начать|обрести|справ|снизить|наладить|чувствова|найти|пережить|восстановить|выстро|спокойн|перестал|вернул|стало)/i

function stems(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .map((w) => w.slice(0, Math.max(4, Math.min(6, w.length - 2))))
}

function mentions(text: string, part: string) {
  const low = text.toLowerCase()
  const st = stems(part)
  if (!st.length) return false
  return st.some((s) => low.includes(s))
}

export function scorePositioning(text: string, parts: PosParts): PosScore {
  const t = text.trim()
  const low = t.toLowerCase()
  const good: string[] = []
  const tips: string[] = []
  let score = 10

  if (t.length < 40) tips.push('Пока слишком коротко. Одна-две фразы: кому, с чем и к какому результату.')
  else if (t.length <= 260) {
    score += 15
    good.push('Хорошая длина — помещается в шапку профиля.')
  } else {
    score += 5
    tips.push('Длинновато для шапки. Главное должно поместиться в 1–2 предложения.')
  }

  if (/помога|сопровожда|работаю с/.test(low)) {
    score += 10
    good.push('Ясно, что ты делаешь.')
  } else tips.push('Начни с действия: «Помогаю…» или «Работаю с…».')

  if (parts.who && mentions(t, parts.who)) {
    score += 20
    good.push('Клиент назван — он сможет узнать себя.')
  } else tips.push('Назови своего клиента так, чтобы он узнал себя: возраст, ситуация, роль.')

  if (parts.pain && mentions(t, parts.pain)) {
    score += 15
    good.push('Боль клиента на месте.')
  } else tips.push('Добавь, с чем именно приходят: какое состояние или ситуация.')

  if (RESULT_MARKERS.test(t)) {
    score += 15
    good.push('Есть результат — понятно, что изменится.')
  } else tips.push('Добавь результат: что станет по-другому после работы.')

  if (parts.method && mentions(t, parts.method)) {
    score += 8
    good.push('Метод вызывает доверие.')
  }

  if (/\d|недел|месяц|встреч/.test(low)) {
    score += 7
    good.push('Конкретика во времени или формате.')
  }

  const vague = VAGUE.filter((w) => low.includes(w))
  if (vague.length) {
    score -= Math.min(36, vague.length * 12)
    tips.push(`Слова ${vague.map((v) => `«${v}…»`).join(', ')} размывают фокус — их слышат все и никто.`)
  }
  const promises = [...new Set(PROMISES.filter((w) => low.includes(w)))]
  if (promises.length) {
    score -= 20 * promises.length
    tips.push('Обещание результата нарушает этику: психолог не может гарантировать итог. Опиши процесс и типичные изменения.')
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), good, tips, vague, promises }
}
