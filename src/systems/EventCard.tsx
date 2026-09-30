import { useEffect, useState } from 'react'
import { sfx } from '../audio/engine'
import { eventById, type EventChoice } from '../game/events'
import { useGame, useTextCtx } from '../game/store'
import { fmt } from '../game/text'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import './panels.css'

export function EventCard({ id }: { id: string }) {
  const ev = eventById(id)
  const ctx = useTextCtx()
  const [picked, setPicked] = useState<EventChoice | null>(null)

  useEffect(() => {
    sfx('whoosh')
  }, [])

  if (!ev) return null

  const choose = (c: EventChoice) => {
    const st = useGame.getState()
    c.effect(st)
    st.markEventSeen(ev.id)
    st.log(`Событие «${ev.title}»: ${c.text.toLowerCase()}.`)
    setPicked(c)
    sfx(c.tone === 'good' ? 'success' : c.tone === 'bad' ? 'error' : 'page')
  }

  const close = () => useGame.getState().setPendingEvent(null)

  return (
    <Modal open onClose={picked ? close : undefined} locked={!picked} width={520}>
      <div className="ev">
        <p className="tiny faint">Событие в пути</p>
        <h2 className="display t-31">{ev.title}</h2>
        <p className="lead">{fmt(ev.text, ctx)}</p>
        {!picked ? (
          <div className="stack">
            {ev.choices.map((c) => (
              <button key={c.text} className="choice" onClick={() => choose(c)}>
                {fmt(c.text, ctx)}
              </button>
            ))}
          </div>
        ) : (
          <div className={`ev-outcome is-${picked.tone} anim-rise`}>
            <p>{fmt(picked.outcome, ctx)}</p>
            <Button variant="lit" onClick={close}>
              Идти дальше
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
