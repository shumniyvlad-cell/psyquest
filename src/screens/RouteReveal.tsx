import { useEffect, useState } from 'react'
import { PlaceIcon } from '../art/icons'
import { Portrait } from '../art/Portrait'
import { Scene } from '../art/Scene'
import { playTheme, sfx } from '../audio/engine'
import { CHAPTER_META } from '../game/chapterMeta'
import { fmtNum, fmtRub } from '../game/planner'
import { useGame, useTextCtx } from '../game/store'
import { fmt } from '../game/text'
import { Button } from '../ui/Button'
import { useInstant } from '../ui/useInstant'
import './setup.css'

function useCountUp(target: number, ms = 1400, delay = 0) {
  const instant = useInstant()
  const [v, setV] = useState(0)
  useEffect(() => {
    if (instant) {
      setV(target)
      return
    }
    let raf = 0
    const t0 = performance.now() + delay
    const tick = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - t0) / ms))
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, delay, instant])
  return v
}

const DIFF_CLASS = { calm: 'badge-mint', normal: '', ambitious: 'badge-ember', heroic: 'badge-ink' } as const

export function RouteReveal() {
  const plan = useGame((s) => s.plan)
  const goal = useGame((s) => s.goal)
  const season = useGame((s) => s.season)
  const ctx = useTextCtx()

  useEffect(() => {
    playTheme('map')
    sfx('magic')
  }, [])

  const reach = useCountUp(plan?.funnel.reach ?? 0, 1500, 200)
  const leads = useCountUp(plan?.funnel.leads ?? 0, 1300, 500)
  const diag = useCountUp(plan?.funnel.diagnostics ?? 0, 1100, 800)
  const clients = useCountUp(plan?.funnel.clients ?? 0, 900, 1100)

  if (!plan || !goal) return null
  const f = plan.funnel
  const rows = [
    { label: 'просмотров контента', value: reach, w: 100 },
    { label: 'заявок: бот, директ, личные сообщения', value: leads, w: 70 },
    { label: 'встреч-знакомств', value: diag, w: 44 },
    { label: 'клиентов', value: clients, w: 24 },
  ]

  return (
    <div className="screen su">
      <Scene id="camp" dim={0.5} />
      <div className="su-scroll scroll">
        <section className="su-route panel panel-pad">
          <div className="su-owl">
            <Portrait who="owl" mood="proud" size={120} talking />
            <p className="su-owl-say anim-fade">
              {fmt(
                season > 1
                  ? 'Сезон {season}. Новая клятва — новый маршрут. Тени запомнили тебя, так что будут сильнее.'
                  : 'Я проложила маршрут под твою клятву, {name}. Вот что нас ждёт — в цифрах и в землях.',
                { ...ctx, season },
              )}
            </p>
          </div>

          <div className="spread su-route-head">
            <h2 className="display t-39">Маршрут проложен</h2>
            <span className={`badge ${DIFF_CLASS[plan.difficulty]}`}>{plan.difficultyLabel}</span>
          </div>

          <div className="su-funnel" aria-label="Воронка до цели">
            {rows.map((r, i) => (
              <div key={r.label} className="su-funnel-row anim-rise" style={{ animationDelay: `${i * 180}ms` }}>
                <div className="su-funnel-bar" style={{ width: `${r.w}%` }}>
                  <span className="display num">{fmtNum(r.value)}</span>
                </div>
                <span className="small muted">{r.label}</span>
              </div>
            ))}
          </div>
          <p className="small faint">
            Конверсии по рынку: из просмотров в заявку около {Math.round(f.rates.reachToLead * 1000) / 10}%, из заявки на встречу {Math.round(f.rates.leadToDiag * 100)}%, из встречи в клиента {Math.round(f.rates.diagToClient * 100)}%. Доход первой волны — {fmtRub(plan.income)}.
          </p>

          <h3 className="display t-25">Земли на пути</h3>
          <ol className="su-lands">
            {plan.route.map((r) => (
              <li key={r.chapter} className="su-land">
                <PlaceIcon id={CHAPTER_META[r.chapter].place} lit size={40} />
                <div className="grow">
                  <b>{CHAPTER_META[r.chapter].name}</b>
                  <p className="tiny faint">{CHAPTER_META[r.chapter].short}</p>
                </div>
                <span className="tiny muted">неделя {r.week}</span>
                {r.mode === 'express' ? <span className="badge badge-mint">быстро</span> : null}
                {!CHAPTER_META[r.chapter].free ? <span className="badge badge-ink">за Вратами</span> : null}
              </li>
            ))}
          </ol>

          <h3 className="display t-25">Заметки Совы</h3>
          <ul className="su-advice">
            {plan.advice.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>

          <div className="su-actions">
            <Button variant="quiet" onClick={() => useGame.getState().go('oath')}>
              Изменить клятву
            </Button>
            <Button
              variant="lit"
              size="lg"
              onClick={() => {
                sfx('whoosh')
                useGame.getState().go('map')
              }}
            >
              Отправиться в путь
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
