import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Portrait, type Mood, type NpcId } from '../art/Portrait'
import { HeroFigure } from '../art/HeroFigure'
import { sfx } from '../audio/engine'
import { lanternOf, useGame, useTextCtx } from '../game/store'
import { fmt } from '../game/text'
import './dialogue.css'

export type Speaker = NpcId | 'hero' | 'narrator'

export interface SayLine {
  who: Speaker
  text: string
  mood?: Mood
}

export interface ChoiceOption {
  text: string
  reply?: SayLine[]
  effect?: () => void
}

export interface ChoiceLine {
  choice: ChoiceOption[]
  prompt?: string
}

export type Line = SayLine | ChoiceLine

export const SPEAKER_NAMES: Record<Speaker, string> = {
  owl: 'Сова Юнга',
  bear: 'Бер',
  robot: 'Бип',
  fox: 'Рыжая',
  raven: 'Карл',
  lion: 'Старый Лев',
  hero: '',
  narrator: '',
}

const SPEED = { slow: 30, normal: 17, fast: 7, instant: 0 } as const

const isChoice = (l: Line): l is ChoiceLine => 'choice' in l

interface Props {
  lines: Line[]
  onDone: () => void
  /** NPC, который стоит слева, даже когда говорит герой */
  npc?: NpcId
  allowSkip?: boolean
}

export function Dialogue({ lines, onDone, npc, allowSkip = true }: Props) {
  const hero = useGame((s) => s.hero)
  const level = useGame((s) => s.level)
  const speed = useGame((s) => s.settings.textSpeed)
  const ctx = useTextCtx()
  const light = useGame((s) => lanternOf(s).color)

  // Очередь реплик: выбор может вставить ответные реплики
  const [queue, setQueue] = useState<Line[]>(lines)
  const [idx, setIdx] = useState(0)
  const [shown, setShown] = useState(0)
  const doneRef = useRef(false)

  useEffect(() => {
    setQueue(lines)
    setIdx(0)
    setShown(0)
    doneRef.current = false
  }, [lines])

  const line = queue[idx]
  const text = useMemo(() => (line && !isChoice(line) ? fmt(line.text, ctx) : ''), [line, ctx])
  const heroName = hero?.name ?? 'Фонарщик'

  const lastNpc = useMemo(() => {
    for (let i = idx; i >= 0; i--) {
      const l = queue[i]
      if (l && !isChoice(l) && l.who !== 'hero' && l.who !== 'narrator') return l.who
    }
    return npc
  }, [queue, idx, npc])

  const lastMood = useMemo(() => {
    for (let i = idx; i >= 0; i--) {
      const l = queue[i]
      if (l && !isChoice(l) && l.who === lastNpc) return l.mood ?? 'neutral'
    }
    return 'neutral' as Mood
  }, [queue, idx, lastNpc])

  // печатная машинка
  useEffect(() => {
    if (!line || isChoice(line)) return
    const ms = SPEED[speed]
    if (ms === 0) {
      setShown(text.length)
      return
    }
    setShown(0)
    let i = 0
    const t = setInterval(() => {
      i += 1
      setShown(i)
      if (i % 2 === 0 && text[i] !== ' ') sfx('type')
      if (i >= text.length) clearInterval(t)
    }, ms)
    return () => clearInterval(t)
  }, [line, text, speed])

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }, [onDone])

  const advance = useCallback(() => {
    if (!line) return finish()
    if (isChoice(line)) return
    if (shown < text.length) {
      setShown(text.length)
      return
    }
    if (idx + 1 >= queue.length) finish()
    else {
      sfx('page')
      setIdx(idx + 1)
    }
  }, [line, shown, text.length, idx, queue.length, finish])

  const pick = (opt: ChoiceOption) => {
    sfx('select')
    opt.effect?.()
    const reply = opt.reply ?? []
    const heroSays: SayLine = { who: 'hero', text: opt.text }
    const next = [...queue.slice(0, idx), heroSays, ...reply, ...queue.slice(idx + 1)]
    setQueue(next)
    setShown(0)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance])

  if (!line) return null

  const speaking = isChoice(line) ? 'hero' : line.who
  const name = speaking === 'hero' ? heroName : SPEAKER_NAMES[speaking]

  return (
    <div className="dlg" onClick={advance}>
      <div className="dlg-stage">
        {lastNpc ? (
          <div className={`dlg-actor dlg-left ${speaking === lastNpc ? 'is-speaking' : 'is-quiet'}`}>
            <Portrait who={lastNpc} mood={lastMood} talking={speaking === lastNpc && shown < text.length} size={340} />
          </div>
        ) : null}
        <div className={`dlg-actor dlg-right ${speaking === 'hero' ? 'is-speaking' : 'is-quiet'}`}>
          <HeroFigure light={light} level={level} facing="left" size={330} />
        </div>
      </div>

      <div className={`dlg-box panel ${speaking === 'narrator' ? 'is-narrator' : ''}`} onClick={(e) => e.stopPropagation()}>
        {name ? <div className={`dlg-name ${speaking === 'hero' ? 'is-hero' : ''}`}>{name}</div> : null}
        {isChoice(line) ? (
          <div className="dlg-choices">
            {line.prompt ? <p className="dlg-text">{fmt(line.prompt, ctx)}</p> : null}
            {line.choice.map((c, i) => (
              <button key={i} className="choice dlg-choice" onClick={() => pick(c)}>
                {fmt(c.text, ctx)}
              </button>
            ))}
          </div>
        ) : (
          <button className="dlg-textbtn" onClick={advance} aria-label="Дальше">
            <p className="dlg-text">
              {text.slice(0, shown)}
              <span className="dlg-ghost" aria-hidden="true">
                {text.slice(shown)}
              </span>
            </p>
            <span className={`dlg-next ${shown >= text.length ? 'is-ready' : ''}`} aria-hidden="true" />
          </button>
        )}
        {allowSkip ? (
          <button
            className="btn btn-quiet btn-sm dlg-skip"
            onClick={(e) => {
              e.stopPropagation()
              sfx('click')
              finish()
            }}
          >
            Пропустить
          </button>
        ) : null}
      </div>
    </div>
  )
}
