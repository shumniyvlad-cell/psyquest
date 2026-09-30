import { useState } from 'react'
import { Feather, Sparkles } from 'lucide-react'
import { askMentor, errorText, isDemo, type MentorReply, type MentorTask } from '../api/client'
import { sfx } from '../audio/engine'
import { useGame } from '../game/store'
import { Button } from '../ui/Button'
import './helpers.css'

/** «Разбор Совы» — AI-наставник (или шаблонный разбор в демо-режиме) */
export function MentorBox({
  task,
  draft,
  context,
  onApply,
  label = 'Разбор Совы',
}: {
  task: MentorTask
  draft: string
  context: Record<string, string | number | undefined>
  onApply?: (text: string) => void
  label?: string
}) {
  const credits = useGame((s) => s.aiCredits)
  const playerId = useGame((s) => s.playerId)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState<MentorReply | null>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setError('')
    const st = useGame.getState()
    if (st.aiCredits <= 0) {
      sfx('error')
      st.openPanel('shop', { shopTab: 'treasury' })
      return
    }
    if (draft.trim().length < 10) {
      setError('Сначала напиши черновик — Сове нужно, что разбирать.')
      return
    }
    setBusy(true)
    sfx('magic')
    try {
      const r = await askMentor({ playerId, task, context, draft })
      if (isDemo) st.useAiCredit()
      else if (typeof r.creditsLeft === 'number') useGame.setState({ aiCredits: r.creditsLeft })
      setReply(r)
      sfx('success')
    } catch (e) {
      setError(errorText(e))
      sfx('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hp-mentor">
      <div className="row-wrap">
        <Button variant="ghost" size="sm" icon={<Sparkles size={16} />} onClick={run} disabled={busy}>
          {busy ? 'Сова читает…' : label}
        </Button>
        <span className="tiny faint">
          {credits > 0 ? `Разборов осталось: ${credits}` : 'Разборы закончились — пополнить можно в Лавке'}
        </span>
      </div>
      {error ? <p className="small ember">{error}</p> : null}
      {reply ? (
        <div className="hp-reply card anim-rise">
          <div className="spread">
            <span className="small muted">{reply.demo ? 'Разбор по шаблону (демо-режим)' : 'Разбор Совы'}</span>
            <span className="badge">Оценка {reply.score}</span>
          </div>
          <p className="hp-feedback">{reply.feedback}</p>
          {reply.improved ? (
            <>
              <p className="small muted">Как можно сказать:</p>
              <p className="hp-improved">{reply.improved}</p>
              {onApply ? (
                <Button variant="aurora" size="sm" onClick={() => onApply(reply.improved)}>
                  Взять этот вариант
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** «Перо Совы» — открывает примеры за одно перо (один раз на подсказку) */
export function HintReveal({
  id,
  title = 'Примеры от Совы',
  items,
  onUse,
  useLabel = 'Взять за основу',
}: {
  id: string
  title?: string
  items: string[]
  onUse?: (text: string) => void
  useLabel?: string
}) {
  const flag = `hint_${id}`
  const opened = useGame((s) => !!s.flags[flag])
  const feathers = useGame((s) => s.consumables.hint ?? 0)

  const open = () => {
    const st = useGame.getState()
    if (!st.useConsumable('hint')) {
      sfx('error')
      st.openPanel('shop', { shopTab: 'coins' })
      return
    }
    sfx('magic')
    st.setFlag(flag)
  }

  if (!opened) {
    return (
      <div className="hp-hint row-wrap">
        <Button variant="quiet" size="sm" icon={<Feather size={16} />} onClick={open}>
          {title}
        </Button>
        <span className="tiny faint">{feathers > 0 ? `1 перо из ${feathers}` : 'Перья закончились — есть в Лавке'}</span>
      </div>
    )
  }
  return (
    <div className="hp-hint-open card anim-rise">
      <p className="small muted">{title}</p>
      <ul className="hp-examples">
        {items.map((t, i) => (
          <li key={i}>
            <p>{t}</p>
            {onUse ? (
              <button className="btn btn-quiet btn-sm" onClick={() => onUse(t)}>
                {useLabel}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Кнопка «Дальше» внизу мастерской */
export function StepFooter({
  canGo,
  onGo,
  label,
  note,
}: {
  canGo: boolean
  onGo: () => void
  label: string
  note?: string
}) {
  return (
    <div className="hp-footer">
      {note ? <p className="small faint">{note}</p> : <span />}
      <Button variant="lit" size="lg" disabled={!canGo} onClick={onGo}>
        {label}
      </Button>
    </div>
  )
}
