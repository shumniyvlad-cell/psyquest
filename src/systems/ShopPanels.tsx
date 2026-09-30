import { useState } from 'react'
import { Check, Coins, Coffee, Feather, HeartHandshake } from 'lucide-react'
import { PlaceIcon } from '../art/icons'
import { PRODUCTS, isDemo, product, restorePurchases, errorText, type Product } from '../api/client'
import { sfx } from '../audio/engine'
import { CONSUMABLES, type ConsumableId } from '../game/items'
import { fmtRub } from '../game/planner'
import { LANTERNS } from '../game/progression'
import { useGame } from '../game/store'
import { Button } from '../ui/Button'
import { buyProduct, syncEntitlements } from './checkout'

const CONS_ICON: Record<ConsumableId, typeof Coffee> = { hint: Feather, tea: Coffee, supervision: HeartHandshake }

function isOwned(p: Product, owned: string[]) {
  return p.grants.length > 0 && p.grants.every((g) => owned.includes(g))
}

function BuyBox({ sku, compact }: { sku: string; compact?: boolean }) {
  const p = product(sku)
  const owned = useGame((s) => s.owned)
  const savedEmail = useGame((s) => (s.flags.email_saved ? localStorageEmail() : ''))
  const [email, setEmail] = useState(savedEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [askEmail, setAskEmail] = useState(false)
  if (!p) return null
  const has = isOwned(p, owned)

  const buy = async () => {
    setError('')
    if (!isDemo) {
      if (!askEmail) {
        setAskEmail(true)
        return
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setError('Нужен email — на него придёт чек, по нему же можно восстановить покупки.')
        return
      }
      rememberEmail(email)
    }
    setBusy(true)
    const r = await buyProduct(sku, email)
    setBusy(false)
    if (!r.ok) {
      sfx('error')
      setError(r.error)
    }
  }

  if (has) {
    return (
      <span className="badge badge-mint">
        <Check size={14} /> Уже у тебя
      </span>
    )
  }
  return (
    <div className={`stack sh-buy ${compact ? 'is-compact' : ''}`}>
      {askEmail && !isDemo ? (
        <input className="input" type="email" autoComplete="email" placeholder="Email для чека" value={email} onChange={(e) => setEmail(e.target.value)} />
      ) : null}
      <Button variant="lit" onClick={buy} disabled={busy}>
        {busy ? 'Открываем оплату…' : isDemo ? `Получить (демо, ${fmtRub(p.price)})` : askEmail ? `Оплатить ${fmtRub(p.price)}` : `Купить за ${fmtRub(p.price)}`}
      </Button>
      {isDemo ? <p className="tiny faint">Демо-режим: деньги не списываются, покупка открывается сразу.</p> : null}
      {error ? <p className="small ember">{error}</p> : null}
    </div>
  )
}

function localStorageEmail() {
  try {
    return localStorage.getItem('psyquest-email') ?? ''
  } catch {
    return ''
  }
}
function rememberEmail(e: string) {
  try {
    localStorage.setItem('psyquest-email', e)
    useGame.getState().setFlag('email_saved')
  } catch {
    /* не критично */
  }
}

export function ShopPanel() {
  const tab = useGame((s) => s.shopTab)
  const coins = useGame((s) => s.coins)
  const consumables = useGame((s) => s.consumables)
  const owned = useGame((s) => s.owned)
  const hero = useGame((s) => s.hero)
  const credits = useGame((s) => s.aiCredits)
  const setTab = (t: 'coins' | 'treasury' | 'looks') => useGame.setState({ shopTab: t })

  return (
    <div className="stack sh">
      <div className="sh-tabs" role="tablist">
        {(
          [
            ['coins', 'За монеты'],
            ['treasury', 'Сокровищница'],
            ['looks', 'Облик'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className="chip" aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <span className="grow" />
        <span className="chip sh-wallet" aria-label={`Монеты: ${coins}`}>
          <Coins size={14} /> {coins}
        </span>
      </div>

      {tab === 'coins' ? (
        <div className="stack">
          <p className="small muted">Монеты приходят за главы, бои и реальные шаги. Тратятся на то, что помогает идти дальше.</p>
          {(Object.keys(CONSUMABLES) as ConsumableId[]).map((id) => {
            const c = CONSUMABLES[id]
            const I = CONS_ICON[id]
            return (
              <div key={id} className="card sh-item">
                <span className="relic-icon" style={{ width: 44, height: 44 }}>
                  <I size={20} />
                </span>
                <div className="grow">
                  <div className="spread">
                    <b>{c.name}</b>
                    <span className="small muted">в сумке: {consumables[id] ?? 0}</span>
                  </div>
                  <p className="small faint">{c.desc}</p>
                </div>
                <Button variant="ghost" size="sm" sound={false} disabled={coins < c.price} onClick={() => useGame.getState().buyConsumable(id)}>
                  {c.price} монет
                </Button>
              </div>
            )
          })}
          <div className="card sh-item">
            <div className="grow">
              <b>Не хватает монет?</b>
              <p className="small faint">Мешочек на 600 монет — в Сокровищнице. Но честнее всего монеты зарабатываются реальными шагами из Журнала.</p>
            </div>
            <Button variant="quiet" size="sm" onClick={() => setTab('treasury')}>
              В Сокровищницу
            </Button>
          </div>
        </div>
      ) : null}

      {tab === 'treasury' ? (
        <div className="stack">
          <p className="small muted">
            Разборов Совы: {credits}. {isDemo ? 'Игра сейчас в демо-режиме: покупки открываются без оплаты.' : 'Оплата через ЮKassa, чек придёт на email.'}
          </p>
          {PRODUCTS.map((p) => (
            <article key={p.sku} className={`card sh-product ${p.sku === 'full_path' ? 'is-hero' : ''}`}>
              <div className="spread">
                <h3 className="display t-20">{p.title}</h3>
                <span className="display t-20 gold num">{fmtRub(p.price)}</span>
              </div>
              <p className="small muted">{p.subtitle}</p>
              <ul className="sh-perks">
                {p.perks.map((x) => (
                  <li key={x} className="small">
                    {x}
                  </li>
                ))}
              </ul>
              <BuyBox sku={p.sku} />
            </article>
          ))}
          {!isDemo ? <RestoreBox /> : null}
        </div>
      ) : null}

      {tab === 'looks' ? (
        <div className="stack">
          <p className="small muted">Цвет фонаря виден на карте, в диалогах и в бою.</p>
          <div className="grid-2">
            {(Object.keys(LANTERNS) as (keyof typeof LANTERNS)[]).map((l) => {
              const def = LANTERNS[l]
              const have = def.free || owned.includes(`lantern_${l}`)
              const on = hero?.lantern === l
              return (
                <div key={l} className="card sh-look">
                  <span className="sh-orb" style={{ background: `radial-gradient(circle at 45% 40%, #fff, ${def.color} 55%, transparent 72%)` }} />
                  <b>{def.name}</b>
                  {have ? (
                    <Button variant={on ? 'aurora' : 'ghost'} size="sm" onClick={() => useGame.getState().setLantern(l)} disabled={on}>
                      {on ? 'Горит сейчас' : 'Зажечь'}
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" sound={false} disabled={coins < def.price} onClick={() => useGame.getState().buyLantern(l)}>
                      {def.price} монет
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function RestoreBox() {
  const [email, setEmail] = useState(localStorageEmail())
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="card stack">
      <b className="small">Восстановить покупки</b>
      <p className="tiny faint">Если игра открыта на новом устройстве или браузер очистился — укажи email, указанный при оплате.</p>
      <div className="row">
        <input className="input" type="email" value={email} placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setMsg('')
            try {
              const r = await restorePurchases(useGame.getState().playerId, email)
              await syncEntitlements()
              setMsg(r.restored ? `Восстановлено покупок: ${r.restored}` : 'Покупок с этим email не нашлось.')
            } catch (e) {
              setMsg(errorText(e))
            } finally {
              setBusy(false)
            }
          }}
        >
          Восстановить
        </Button>
      </div>
      {msg ? <p className="small muted">{msg}</p> : null}
    </div>
  )
}

export function PaywallPanel() {
  const p = product('full_path')
  const bundle = product('bundle_all')
  const full = useGame((s) => s.owned.includes('full_path'))
  const close = () => useGame.getState().openPanel(null)
  if (!p) return null
  if (full) {
    return (
      <div className="pw stack">
        <PlaceIcon id="gate" lit size={96} />
        <h2 className="display t-31">Врата открыты</h2>
        <p className="lead">Путь к Маяку свободен. Кузница ждёт.</p>
        <Button variant="lit" onClick={close}>
          К карте
        </Button>
      </div>
    )
  }
  return (
    <div className="pw stack">
      <PlaceIcon id="gate" lit={false} size={96} />
      <h2 className="display t-39">Врата Мастерства</h2>
      <p className="lead">
        Долина и Лес пройдены — это фундамент. За Вратами шесть земель, где собирается всё, что нужно для первых клиентов: продукт, бот, ролики, запуск, продажи и живой счёт клиентов.
      </p>
      <ul className="pw-perks">
        {p.perks.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <div className="pw-price">
        <span className="display t-49 gold num">{fmtRub(p.price)}</span>
        <span className="small muted">один раз, навсегда, включая будущие сезоны</span>
      </div>
      <BuyBox sku="full_path" />
      {bundle ? (
        <div className="card stack pw-bundle">
          <div className="spread">
            <b>{bundle.title}</b>
            <span className="gold num">{fmtRub(bundle.price)}</span>
          </div>
          <p className="small faint">{bundle.subtitle}</p>
          <BuyBox sku="bundle_all" compact />
        </div>
      ) : null}
      <Button variant="quiet" onClick={close}>
        Не сейчас
      </Button>
    </div>
  )
}
