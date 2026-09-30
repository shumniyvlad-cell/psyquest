// «Собрать из сценария»: хук, проблема, инсайт и призыв раскладываются по времени.
import type { ReelScript } from '../../game/types'
import { DEFAULT_HOOK_SEC, MAX_TOTAL_SEC, STILL_MAX_SEC, STILL_MIN_SEC, type BgClip, type BgPreset, type Caption } from './types'
import { round1, uid } from './util'

export const CHARS_PER_SEC = 14
export const MIN_CAPTION_SEC = 2
/** Тишина после последней фразы, чтобы её успели дочитать */
const TAIL_SEC = 0.6

export const SAMPLE_SCRIPT: ReelScript = {
  id: 'sample',
  hook: 'Вы не ленивы. Вы устали',
  problem: 'Кажется, что нужно просто собраться. Но силы не возвращаются даже после выходных.',
  insight: 'Усталость — не слабость характера. Это сигнал: психика слишком долго жила в напряжении.',
  cta: 'Напишите «ресурс» в директ — пришлю упражнение на пять минут.',
}

export const captionSec = (text: string) => Math.max(MIN_CAPTION_SEC, round1(text.trim().length / CHARS_PER_SEC))

export interface ScriptBuild {
  hook: string
  hookSec: number
  captions: Caption[]
  total: number
  /** Отрезки хука и каждой фразы — под них подбираются «живые фоны» */
  segments: [number, number][]
}

export function buildFromScript(s: ReelScript, hookSec = DEFAULT_HOOK_SEC): ScriptBuild {
  const hook = s.hook.trim()
  const parts = [s.problem, s.insight, s.cta].map((x) => x.trim()).filter(Boolean)
  let at = hook ? hookSec : 0
  const segments: [number, number][] = hook ? [[0, at]] : []
  const captions: Caption[] = []
  for (const text of parts) {
    if (at >= MAX_TOTAL_SEC - 0.5) break
    const d = captionSec(text)
    const end = Math.min(MAX_TOTAL_SEC, round1(at + d))
    captions.push({ id: uid('cap'), text, start: round1(at), end })
    segments.push([round1(at), end])
    at = end
  }
  const total = round1(Math.min(MAX_TOTAL_SEC, Math.max(at + TAIL_SEC, hook ? hookSec : STILL_MIN_SEC)))
  // последняя фраза держится до конца ролика
  if (captions.length) captions[captions.length - 1].end = total
  if (segments.length) segments[segments.length - 1][1] = total
  else segments.push([0, total])
  return { hook, hookSec, captions, total, segments }
}

/** Режет отрезок на куски по 1–15 с без «огрызков» короче секунды. */
export function splitDuration(len: number): number[] {
  const out: number[] = []
  let rest = round1(len)
  while (rest > 0.05) {
    if (rest <= STILL_MAX_SEC) {
      out.push(Math.max(STILL_MIN_SEC, rest))
      break
    }
    const n = Math.ceil(rest / STILL_MAX_SEC)
    const piece = round1(rest / n)
    out.push(piece)
    rest = round1(rest - piece)
  }
  return out
}

export function backgroundsFor(segments: [number, number][], preset: BgPreset): BgClip[] {
  const clips: BgClip[] = []
  for (const [a, b] of segments) {
    for (const d of splitDuration(b - a)) {
      clips.push({ id: uid('clip'), kind: 'bg', preset, duration: d, kenBurns: false })
    }
  }
  return clips
}
