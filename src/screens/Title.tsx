import { useEffect, useRef, useState } from 'react'
import { HeroFigure } from '../art/HeroFigure'
import { Scene } from '../art/Scene'
import { isAudioReady, playTheme, sfx, unlockAudio } from '../audio/engine'
import { lanternOf, useGame } from '../game/store'
import { Button } from '../ui/Button'
import './title.css'

export function Title() {
  const hero = useGame((s) => s.hero)
  const plan = useGame((s) => s.plan)
  const light = useGame((s) => lanternOf(s).color)
  const level = useGame((s) => s.level)
  const [lit, setLit] = useState(isAudioReady())
  const [confirmNew, setConfirmNew] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (lit) playTheme('title')
  }, [lit])

  // свет фонаря за курсором
  useEffect(() => {
    const el = rootRef.current
    if (!el || lit) return
    const move = (e: PointerEvent) => {
      el.style.setProperty('--mx', `${e.clientX}px`)
      el.style.setProperty('--my', `${e.clientY}px`)
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [lit])

  const ignite = async () => {
    try {
      await unlockAudio()
    } catch {
      /* без звука тоже можно играть */
    }
    sfx('magic')
    setLit(true)
  }

  const canContinue = !!hero && !!plan

  return (
    <div className={`screen tt ${lit ? 'is-lit' : ''}`} ref={rootRef}>
      <Scene id="title" />
      <div className="tt-hero" aria-hidden="true">
        <HeroFigure light={light} level={lit ? Math.max(level, 6) : 1} pose={lit ? 'raise' : 'idle'} size={260} />
      </div>
      <div className="tt-dark" aria-hidden="true" />

      <main className="tt-center">
        <h1 className="tt-logo">PsyQuest</h1>
        <p className="tt-sub display">Путь к Маяку</p>
        <p className="tt-lead">Игра, в которой психолог строит свою практику: от первой уверенности до реальных клиентов.</p>
        {!lit ? (
          <Button variant="lit" size="lg" onClick={ignite} sound={false} className="tt-ignite">
            Зажечь фонарь
          </Button>
        ) : (
          <div className="tt-menu anim-rise">
            {canContinue ? (
              <Button variant="lit" size="lg" onClick={() => useGame.getState().go('map')}>
                Продолжить путь
              </Button>
            ) : null}
            {confirmNew ? (
              <div className="tt-confirm panel anim-rise">
                <p className="small">Текущий путь сбросится. Покупки, монеты и разборы Совы останутся.</p>
                <div className="row-wrap" style={{ justifyContent: 'center' }}>
                  <Button variant="danger" onClick={() => useGame.getState().newGame()}>
                    Начать заново
                  </Button>
                  <Button variant="quiet" onClick={() => setConfirmNew(false)}>
                    Оставить
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant={canContinue ? 'ghost' : 'lit'}
                size="lg"
                onClick={() => {
                  if (canContinue) setConfirmNew(true)
                  else useGame.getState().go('create')
                }}
              >
                {canContinue ? 'Начать новый путь' : 'Начать путь'}
              </Button>
            )}
            <Button variant="quiet" onClick={() => useGame.getState().openPanel('settings')}>
              Настройки
            </Button>
          </div>
        )}
        {!lit ? <p className="tt-hint tiny">Со звуком — лучше. Музыка создаётся прямо в браузере.</p> : null}
      </main>
      <footer className="tt-foot tiny">Vlad March Media</footer>
    </div>
  )
}
