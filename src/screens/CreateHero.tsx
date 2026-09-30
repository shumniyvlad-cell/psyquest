import { useEffect, useState } from 'react'
import { HeroFigure } from '../art/HeroFigure'
import { Portrait } from '../art/Portrait'
import { Scene } from '../art/Scene'
import { playTheme, sfx } from '../audio/engine'
import { CLASSES, LANTERNS } from '../game/progression'
import { useGame } from '../game/store'
import type { ClassId, Gender, LanternId } from '../game/types'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import './setup.css'

const FREE_LANTERNS = (Object.keys(LANTERNS) as LanternId[]).filter((l) => LANTERNS[l].free)

export function CreateHero() {
  const saved = useGame((s) => s.hero)
  const [name, setName] = useState(saved?.name ?? '')
  const [gender, setGender] = useState<Gender | null>(saved?.gender ?? null)
  const [classId, setClassId] = useState<ClassId>(saved?.classId ?? 'cbt')
  const [lantern, setLantern] = useState<LanternId>(saved?.lantern ?? 'amber')

  useEffect(() => {
    playTheme('map')
  }, [])

  const ready = name.trim().length >= 2 && gender !== null
  const go = () => {
    if (!ready || !gender) return
    useGame.getState().setHero({ name: name.trim(), gender, classId, lantern })
    sfx('unlock')
    useGame.getState().go('prologue')
  }

  return (
    <div className="screen su">
      <Scene id="camp" dim={0.35} />
      <div className="su-scroll scroll">
        <div className="su-layout">
          <aside className="su-preview">
            <HeroFigure light={LANTERNS[lantern].color} level={3} size={300} />
            <p className="display t-25">{name.trim() || 'Фонарщик'}</p>
            <p className="small muted">{CLASSES[classId].name}</p>
          </aside>

          <section className="su-panel panel panel-pad">
            <div className="su-owl">
              <Portrait who="owl" mood="happy" size={120} />
              <p className="su-owl-say">
                Прежде чем идти, скажи, кто ты. Туман любит безымянных — а мы с тобой будем называть всё своими именами.
              </p>
            </div>

            <Field label="Как тебя зовут" htmlFor="su-name">
              <input id="su-name" className="input" value={name} maxLength={28} placeholder="Имя или как тебя называют клиенты" onChange={(e) => setName(e.target.value)} />
            </Field>

            <div className="field">
              <span className="field-label">Как к тебе обращаться</span>
              <div className="row-wrap">
                <button className="chip" aria-pressed={gender === 'f'} onClick={() => setGender('f')}>
                  В женском роде: «ты готова»
                </button>
                <button className="chip" aria-pressed={gender === 'm'} onClick={() => setGender('m')}>
                  В мужском роде: «ты готов»
                </button>
              </div>
            </div>

            <div className="field">
              <span className="field-label">Твой путь в профессии</span>
              <div className="su-classes">
                {(Object.keys(CLASSES) as ClassId[]).map((id) => {
                  const c = CLASSES[id]
                  return (
                    <button
                      key={id}
                      className="choice su-class"
                      aria-pressed={classId === id}
                      onClick={() => {
                        sfx('select')
                        setClassId(id)
                      }}
                    >
                      <b className="display t-20">{c.name}</b>
                      <span className="small muted">{c.method}</span>
                      <span className="small">{c.desc}</span>
                      <span className="tiny mint">{c.bonus}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="field">
              <span className="field-label">Цвет фонаря</span>
              <div className="row-wrap">
                {FREE_LANTERNS.map((l) => (
                  <button
                    key={l}
                    className="chip"
                    aria-pressed={lantern === l}
                    onClick={() => {
                      sfx('select')
                      setLantern(l)
                    }}
                  >
                    <span className="hs-swatch" style={{ background: LANTERNS[l].color }} />
                    {LANTERNS[l].name}
                  </button>
                ))}
              </div>
            </div>

            <div className="su-actions">
              <Button variant="quiet" onClick={() => useGame.getState().go('title')}>
                Назад
              </Button>
              <Button variant="lit" size="lg" disabled={!ready} onClick={go}>
                Дальше — клятва
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
