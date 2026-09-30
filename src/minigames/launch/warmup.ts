// Логика пазла «Линия прогрева» — без React, чтобы легко проверять.
import { mulberry32 } from './rng.ts'
import { STAGE_EXTRA, WARMUP_STAGES } from './stages.ts'

export interface WarmupState {
  /** Индексы этапов в порядке, в котором карточки лежат на столе */
  deck: number[]
  /** Сколько этапов уже стоит в линии (они всегда 0..placed-1) */
  placed: number
  mistakes: number
}

export type PickResult =
  | { ok: true; state: WarmupState; stage: number; done: boolean }
  | { ok: false; state: WarmupState; stage: number; expected: number; hint: string }

/** Перемешивает этапы так, чтобы на своих местах оказалось не больше одной карточки. */
export function shuffleDeck(seed: number, n = WARMUP_STAGES.length): number[] {
  const rng = mulberry32(seed)
  const base = Array.from({ length: n }, (_, i) => i)
  let best = base
  let bestFixed = n + 1
  for (let attempt = 0; attempt < 24; attempt++) {
    const deck = rng.shuffle(base)
    const fixed = deck.filter((v, i) => v === i).length
    // первая карточка на столе не должна быть правильным первым шагом — иначе слишком легко
    const penalty = fixed + (deck[0] === 0 ? 2 : 0)
    if (penalty < bestFixed) {
      best = deck
      bestFixed = penalty
    }
    if (penalty <= 1) break
  }
  return best
}

export function createWarmup(seed: number): WarmupState {
  return { deck: shuffleDeck(seed), placed: 0, mistakes: 0 }
}

/** Карточки, которые ещё лежат на столе, в порядке раскладки */
export const remaining = (s: WarmupState) => s.deck.filter((i) => i >= s.placed)

export const isSolved = (s: WarmupState) => s.placed >= WARMUP_STAGES.length

export function hintFor(clicked: number, expected: number): string {
  const c = WARMUP_STAGES[clicked]
  const ex = STAGE_EXTRA[WARMUP_STAGES[expected].id]
  const cx = STAGE_EXTRA[c.id]
  return `«${c.title}» — пока рано. ${cx?.early ?? ''} ${ex?.need ?? ''}`.replace(/\s+/g, ' ').trim()
}

export function pick(s: WarmupState, stage: number): PickResult {
  if (isSolved(s) || stage < s.placed) {
    return { ok: true, state: s, stage, done: isSolved(s) }
  }
  if (stage === s.placed) {
    const next = { ...s, placed: s.placed + 1 }
    return { ok: true, state: next, stage, done: isSolved(next) }
  }
  return {
    ok: false,
    state: { ...s, mistakes: s.mistakes + 1 },
    stage,
    expected: s.placed,
    hint: hintFor(stage, s.placed),
  }
}

export function praise(mistakes: number): { title: string; text: string } {
  if (mistakes === 0)
    return {
      title: 'Безупречно',
      text: 'Ни одной ошибки: прогрев выстроен так, что по нему можно учить других. Аудитория пройдёт путь от «кто это?» до «хочу записаться» без рывков.',
    }
  if (mistakes <= 2)
    return {
      title: 'Линия горит',
      text: 'Пара заминок — и логика прогрева уже в руках. Каждый этап отвечает на вопрос, который появляется у человека после предыдущего.',
    }
  if (mistakes <= 5)
    return {
      title: 'Собрано',
      text: 'Порядок найден через пробы — так он запоминается лучше, чем по учебнику. Главное правило: доверие раньше предложения.',
    }
  return {
    title: 'Прогрев выстроен',
    text: 'Путь был извилистым, но линия горит целиком. Ошибки здесь бесплатны — в реальном запуске этот порядок сэкономит недели.',
  }
}
