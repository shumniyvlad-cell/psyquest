import { useEffect, useState, type ReactNode } from 'react'
import { Portrait, type Mood } from '../art/Portrait'
import { Scene } from '../art/Scene'
import { playTheme, sfx, stinger } from '../audio/engine'
import { AUDIENCE_LABEL, CHANNEL_LABEL, fmtRub, plural } from '../game/planner'
import { useGame, useTextCtx } from '../game/store'
import { fmt } from '../game/text'
import type { AudienceSize, Channel, Goal } from '../game/types'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import './setup.css'

const today = () => new Date().toISOString().slice(0, 10)

const HAS: { key: keyof Goal['has']; label: string }[] = [
  { key: 'niche', label: 'Понятная ниша и позиционирование' },
  { key: 'product', label: 'Линейка услуг с ценами' },
  { key: 'bot', label: 'Бот или автоворонка' },
  { key: 'content', label: 'Регулярный контент' },
]

export function Oath() {
  const prev = useGame((s) => s.goal)
  const season = useGame((s) => s.season)
  const lighthouseDone = useGame((s) => s.chapters.lighthouse.status === 'done')
  const ctx = useTextCtx()
  const isNewSeason = lighthouseDone && !!prev
  const [step, setStep] = useState(0)
  const [g, setG] = useState<Goal>(() => ({
    clients: isNewSeason && prev ? prev.clients * 2 : prev?.clients ?? 10,
    weeks: prev?.weeks ?? 8,
    check: prev?.check ?? 20000,
    niche: prev?.niche ?? '',
    channel: prev?.channel ?? 'instagram',
    audience: prev?.audience ?? 'small',
    has: prev?.has ?? { niche: false, product: false, bot: false, content: false },
    currentClients: prev?.currentClients ?? 0,
    hoursPerWeek: prev?.hoursPerWeek ?? 5,
    startDate: today(),
  }))

  useEffect(() => {
    playTheme('map')
  }, [])

  const set = <K extends keyof Goal>(k: K, v: Goal[K]) => setG((cur) => ({ ...cur, [k]: v }))

  const steps: { title: string; owl: string; mood: Mood; body: ReactNode }[] = [
    {
      title: 'Цель',
      mood: 'thinking',
      owl: isNewSeason
        ? 'Маяк горит. Но на горизонте ещё корабли. Какую цель берём в новом сезоне?'
        : 'Клятва Фонарщика — это настоящая цель из жизни. Сколько новых клиентов ты хочешь привести к себе?',
      body: (
        <>
          <div className="su-big">
            <span className="display num">{g.clients}</span>
            <span className="muted">{plural(g.clients, 'новый клиент', 'новых клиента', 'новых клиентов')}</span>
          </div>
          <input type="range" min={1} max={50} value={g.clients} onChange={(e) => set('clients', Number(e.target.value))} aria-label="Сколько новых клиентов" />
          <div className="row-wrap">
            {[3, 5, 10, 15, 20, 30].map((n) => (
              <button key={n} className="chip" aria-pressed={g.clients === n} onClick={() => set('clients', n)}>
                {n}
              </button>
            ))}
          </div>
          <Field label="За какой срок">
            <div className="row-wrap">
              {[4, 6, 8, 12, 16].map((w) => (
                <button key={w} className="chip" aria-pressed={g.weeks === w} onClick={() => set('weeks', w)}>
                  {w} {plural(w, 'неделя', 'недели', 'недель')}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Когда начинаем" htmlFor="oath-start">
            <input id="oath-start" className="input" type="date" value={g.startDate} onChange={(e) => set('startDate', e.target.value || today())} />
          </Field>
        </>
      ),
    },
    {
      title: 'Цена',
      mood: 'neutral',
      owl: 'Теперь о деньгах. Не пугайся — это просто цифра. Сколько стоит твой основной пакет встреч или курс терапии?',
      body: (
        <>
          <Field label="Средний чек пакета, ₽" hint="Если продаёшь разовые встречи — умножь цену встречи на обычное число встреч с клиентом." htmlFor="oath-check">
            <input id="oath-check" className="input num" type="number" min={500} step={500} value={g.check} onChange={(e) => set('check', Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <div className="row-wrap">
            {[8000, 15000, 25000, 40000, 60000].map((n) => (
              <button key={n} className="chip" aria-pressed={g.check === n} onClick={() => set('check', n)}>
                {fmtRub(n)}
              </button>
            ))}
          </div>
          <p className="su-sum">
            {g.clients} × {fmtRub(g.check)} = <b className="gold">{fmtRub(g.clients * g.check)}</b>
          </p>
        </>
      ),
    },
    {
      title: 'Где ты сейчас',
      mood: 'thinking',
      owl: 'Мне нужно знать, откуда мы стартуем. Честно — так маршрут получится правильным.',
      body: (
        <>
          <Field label="Главная площадка">
            <div className="row-wrap">
              {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
                <button key={c} className="chip" aria-pressed={g.channel === c} onClick={() => set('channel', c)}>
                  {CHANNEL_LABEL[c]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Аудитория">
            <div className="row-wrap">
              {(Object.keys(AUDIENCE_LABEL) as AudienceSize[]).map((a) => (
                <button key={a} className="chip" aria-pressed={g.audience === a} onClick={() => set('audience', a)}>
                  {AUDIENCE_LABEL[a]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Что уже есть" hint="Отмеченные главы пройдутся быстрее.">
            <div className="su-has">
              {HAS.map((h) => (
                <label key={h.key} className="choice su-check" aria-pressed={g.has[h.key]}>
                  <input type="checkbox" checked={g.has[h.key]} onChange={(e) => set('has', { ...g.has, [h.key]: e.target.checked })} />
                  {h.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Сколько клиентов сейчас в работе" htmlFor="oath-cur">
            <input id="oath-cur" className="input num" type="number" min={0} max={60} value={g.currentClients} onChange={(e) => set('currentClients', Math.max(0, Number(e.target.value) || 0))} />
          </Field>
        </>
      ),
    },
    {
      title: 'Силы',
      mood: 'happy',
      owl: 'И последнее. Сколько часов в неделю {готов|готова} вкладывать в развитие практики — не считая самих сессий?',
      body: (
        <>
          <div className="row-wrap">
            {[3, 5, 10, 15, 20].map((h) => (
              <button key={h} className="chip" aria-pressed={g.hoursPerWeek === h} onClick={() => set('hoursPerWeek', h)}>
                {h} {plural(h, 'час', 'часа', 'часов')}
              </button>
            ))}
          </div>
          <Field label="Ниша или тема, если уже есть" hint="Можно оставить пустым — разберёмся в Лесу Смыслов." htmlFor="oath-niche">
            <input id="oath-niche" className="input" value={g.niche} placeholder="Например: тревога у айтишников" onChange={(e) => set('niche', e.target.value)} />
          </Field>
        </>
      ),
    },
  ]

  const s = steps[step]
  const last = step === steps.length - 1

  const swear = () => {
    const st = useGame.getState()
    stinger('unlock')
    if (isNewSeason) st.startNewSeason(g)
    else {
      st.swearOath(g)
      st.go('route')
    }
  }

  return (
    <div className="screen su">
      <Scene id="camp" dim={0.4} />
      <div className="su-scroll scroll">
        <section className="su-oath panel panel-pad">
          <ol className="su-steps" aria-label="Шаги клятвы">
            {steps.map((x, i) => (
              <li key={x.title} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}>
                {x.title}
              </li>
            ))}
          </ol>
          <div className="su-owl" key={step}>
            <Portrait who="owl" mood={s.mood} size={120} talking />
            <p className="su-owl-say anim-fade">{fmt(s.owl, ctx)}</p>
          </div>
          <div className="stack" style={{ gap: 14 }}>
            {s.body}
          </div>
          <div className="su-actions">
            <Button
              variant="quiet"
              onClick={() => {
                sfx('page')
                if (step === 0) useGame.getState().go(isNewSeason ? 'map' : 'create')
                else setStep(step - 1)
              }}
            >
              Назад
            </Button>
            {last ? (
              <Button variant="lit" size="lg" onClick={swear} disabled={g.check <= 0}>
                {isNewSeason ? `Начать сезон ${season + 1}` : 'Принести клятву'}
              </Button>
            ) : (
              <Button
                variant="lit"
                size="lg"
                onClick={() => {
                  sfx('page')
                  setStep(step + 1)
                }}
              >
                Дальше
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
